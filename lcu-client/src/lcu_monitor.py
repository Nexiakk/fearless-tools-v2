"""
Core LCU monitoring service using lcu-driver.
Handles WebSocket connections, event processing, and draft data extraction.
Uses state machine pattern for optimized resource usage.
"""

import asyncio
import logging
from enum import Enum, auto
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime
import json
import time
import psutil

from PySide6.QtCore import QObject, Signal
import lcu_driver.utils
from lcu_driver import Connector
from lcu_driver.events.responses import WebsocketEventResponse

try:
    from .models import DraftData, GameflowPhase, TeamData, ChampionAction, ChampionEvent
    from .champion_mapper import get_champion_mapper
    from .data_transmitter import get_data_transmitter
    from .config_manager import get_config_manager
    from .notifications import get_notifier, NotificationType
except ImportError:
    from models import DraftData, GameflowPhase, TeamData, ChampionAction, ChampionEvent
    from champion_mapper import get_champion_mapper
    from data_transmitter import get_data_transmitter
    from config_manager import get_config_manager
    from notifications import get_notifier, NotificationType

logger = logging.getLogger(__name__)

# Event counter for tracking event frequency
_event_counter = {"count": 0, "last_reset": time.time()}

def _log_event_frequency(event_type: str):
    """Log event frequency to detect spam"""
    _event_counter["count"] += 1
    elapsed = time.time() - _event_counter["last_reset"]
    if elapsed >= 5.0:  # Log every 5 seconds
        rate = _event_counter["count"] / elapsed
        logger.info(f"[EVENT_RATE] {event_type}: {_event_counter['count']} events in {elapsed:.1f}s ({rate:.1f}/sec)")
        _event_counter["count"] = 0
        _event_counter["last_reset"] = time.time()

def _truncate_data(data: Any, max_len: int = 500) -> str:
    """Truncate data for logging"""
    try:
        json_str = json.dumps(data, default=str, indent=None)
        if len(json_str) > max_len:
            return json_str[:max_len] + f"... [truncated, total: {len(json_str)} chars]"
        return json_str
    except:
        return str(data)[:max_len]


class MonitorState(Enum):
    """
    Monitor states for optimized resource usage:
    - IDLE: Only listening for gameflow phase changes (minimal resource usage)
    - MONITORING_CHAMP_SELECT: Actively tracking draft data
    - GAME_STARTED: Game went through, draft is locked in database
    """
    IDLE = "idle"
    MONITORING_CHAMP_SELECT = "monitoring_champ_select"
    GAME_STARTED = "game_started"


class LCUMonitor(QObject):
    """Monitors League Client Update API for draft data with state machine"""
    
    # GUI Signals
    status_changed = Signal(str, str) # (system, status_text) like ("LCU", "Connected")
    workspace_updated = Signal(str)
    
    # LCU API endpoints
    CHAMP_SELECT_URL = '/lol-champ-select/v1/session'
    GAMEFLOW_URL = '/lol-gameflow/v1/gameflow-phase'
    LOBBY_URL = '/lol-lobby/v1/lobby'

    # Gameflow phases
    PHASE_LOBBY = 'Lobby'
    PHASE_CHAMP_SELECT = 'ChampSelect'
    PHASE_IN_PROGRESS = 'InProgress'
    PHASE_GAME_START = 'GameStart'
    PHASE_NONE = 'None'
    PHASE_END_GAME = 'EndOfGame'  # Sometimes seen after game ends
    PHASE_PRE_END_GAME = 'PreEndOfGame'

    def __init__(self):
        super().__init__()
        # Defer connector creation until start() to avoid event loop issues
        self.connector = None
        self.champion_mapper = get_champion_mapper()
        self.data_transmitter = get_data_transmitter()
        self.config_manager = get_config_manager()
        self.notifier = get_notifier()

        # State tracking
        self.is_connected = False
        self.state = MonitorState.IDLE
        self.current_lobby_id: Optional[str] = None
        self.current_phase: Optional[str] = None
        self.last_draft_data: Optional[DraftData] = None
        self.workspace_id: Optional[str] = None
        self.target_pid: Optional[int] = None # Filter to a specific LCU instance

        # Track whether current draft resulted in a game
        self._game_went_through = False
        
        # Track if we've sent the champ select started notification
        self._champ_select_notification_sent = False

        # Event handlers will be set up when connector is created
        self._event_handlers_setup = False
        
        # CRITICAL FIX: Store raw ID-based draft data for proper change detection
        # This prevents the bug where names are compared against IDs
        self._last_raw_draft_data: Optional[DraftData] = None
        
        # Track initial timestamps for draft actions
        self._action_timestamps: Dict[int, datetime] = {}
        
        # Track initial picks for cells so swaps don't override the drafted champion
        self._initial_picks: Dict[int, str] = {}

    def _set_state(self, new_state: MonitorState) -> None:
        """Change monitor state with logging and notification"""
        if self.state != new_state:
            old_state = self.state
            self.state = new_state
            self.notifier.on_state_changed(old_state.value, new_state.value)
            logger.info(f"Monitor state: {old_state.value} → {new_state.value}")

    def set_target_pid(self, pid: Optional[int]):
        self.target_pid = pid
        # Restart connector if necessary
        if self.connector:
            pass # Usually requires restarting the connector entirely, best handled at app level

    def _setup_event_handlers(self):
        """Set up LCU event handlers"""

        @self.connector.ready
        async def connect(connection):
            logger.info('LCU connection established')
            self.is_connected = True
            self.workspace_id = self.config_manager.get_workspace_id()
            self.notifier.on_connection_restored()
            self.status_changed.emit("LCU", f"Connected to {self.workspace_id}")
            self.status_changed.emit("Netlify", "Ready")
            if self.workspace_id:
                self.workspace_updated.emit(self.workspace_id)
            
            # Store connection reference for use in other methods
            self._connection = connection

            # Start data transmitter
            await self.data_transmitter.start()

            # Get current phase to set initial state
            try:
                phase_response = await connection.request('get', self.GAMEFLOW_URL)
                if phase_response.status == 200:
                    # Handle both aiohttp ClientResponse and lcu-driver wrapped responses
                    try:
                        current_phase = await phase_response.json()
                    except (AttributeError, TypeError):
                        current_phase = getattr(phase_response, 'data', None)
                    
                    if current_phase:
                        if isinstance(current_phase, str):
                            current_phase = current_phase.strip('"')
                        logger.info(f"Initial gameflow phase: {current_phase}")
                        await self._process_gameflow_phase(current_phase)
            except Exception as e:
                logger.warning(f"Could not get initial phase: {e}")

        @self.connector.close
        async def disconnect(connection):
            logger.info('LCU connection closed')
            self.is_connected = False
            self.status_changed.emit("LCU", "Disconnected")
            self.notifier.on_connection_lost()

        @self.connector.ws.register(self.CHAMP_SELECT_URL)
        async def champ_select_update(connection, event):
            """Handle champion select session updates - only process in monitoring state"""
            # Log event frequency to detect spam
            _log_event_frequency("champ_select")
            
            # OPTIMIZATION: Ignore champ select events when not monitoring
            if self.state != MonitorState.MONITORING_CHAMP_SELECT:
                logger.debug(f"[CHAMP_SELECT_EVENT] Ignoring event - current state: {self.state.value}")
                return

            if event.data:
                # Log key info about the event
                timer = event.data.get('timer', {})
                phase = timer.get('phase', 'UNKNOWN')
                internal_phase = event.data.get('internalPhase', 'UNKNOWN')
                logger.debug(f"[CHAMP_SELECT_EVENT] Phase: {phase}, InternalPhase: {internal_phase}")
                
                # Log actions summary
                actions = event.data.get('actions', [])
                total_actions = sum(len(ag) for ag in actions) if actions else 0
                logger.debug(f"[CHAMP_SELECT_EVENT] Actions groups: {len(actions)}, Total actions: {total_actions}")
                
                await self._process_champ_select_data(event.data)

        @self.connector.ws.register(self.GAMEFLOW_URL)
        async def gameflow_update(connection, event):
            """Handle gameflow phase changes - always process for state machine"""
            if event.data:
                await self._process_gameflow_phase(event.data)

        @self.connector.ws.register(self.LOBBY_URL)
        async def lobby_update(connection, event):
            """Handle lobby updates - only process when relevant"""
            # Only process lobby updates when idle or starting to monitor
            if self.state == MonitorState.IDLE:
                if event.data:
                    await self._process_lobby_data(event.data)
            # In other states, lobby data is handled via gameflow transitions

    def start(self) -> bool:
        """Start the LCU monitor - meant to be called within an existing event loop"""
        if not self.config_manager.is_configured():
            logger.warning("LCU client not configured, waiting for workspace setup")
            return False

        # If already running or starting, don't start again
        if hasattr(self, '_bg_task') and self._bg_task and not self._bg_task.done():
            logger.debug("LCU monitor already running")
            return True

        try:
            logger.info("Starting LCU monitor...")

            # We DO NOT create a new event loop here. 
            # qasync provides the loop and lcu-driver will use it.
            
            # Monkeypatch lcu_driver to filter by PID if targeted
            import lcu_driver.utils
            from psutil import process_iter, STATUS_ZOMBIE
            
            original_return_ux_process = lcu_driver.utils._return_ux_process
            
            def custom_return_ux_process():
                for process in process_iter(attrs=["cmdline"]):
                    if process.status() == STATUS_ZOMBIE:
                        continue
                    if self.target_pid and process.pid != self.target_pid:
                        continue
                    if process.name() in ["LeagueClientUx.exe", "LeagueClientUx"]:
                        yield process
                    cmdline = process.info.get("cmdline", [])
                    if cmdline and cmdline[0].endswith("LeagueClientUx.exe"):
                        yield process
            
            lcu_driver.utils._return_ux_process = custom_return_ux_process

            # Create connector
            self.connector = Connector()
            self._setup_event_handlers()

            # We must run it as a task because Connector.start() blocks
            import asyncio
            
            # Rather than calling connector.start() which blocks with run_forever
            # we just start it asynchronously matching its internal logic.
            async def background_start():
                try:
                    import lcu_driver.utils
                    from lcu_driver.connection import Connection
                    
                    while self.connector._repeat_flag:
                        process = next(lcu_driver.utils._return_ux_process(), None)
                        if process:
                            # We found a process, create connection and init it
                            # Force lcu_driver to use the current qt loop
                            connection = Connection(self.connector, process)
                            self.connector.register_connection(connection)
                            
                            # Safely await the initialization without crashing the loop 
                            await connection.init()
                            
                        await asyncio.sleep(0.5)
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Connector bg loop error: {e}", exc_info=True)
                    
            # Use asyncio to run the async initialization logic of lcu-driver 
            # without blocking the whole thread the way .start() does
            
            # Explicitly capture the qasync loop
            loop = asyncio.get_event_loop()
            self.connector.loop = loop
            
            self._bg_task = loop.create_task(background_start())
            
            return True
        except Exception as e:
            logger.error(f"Failed to start LCU monitor: {e}")
            return False

    async def stop(self):
        """Stop the LCU monitor"""
        logger.info("Stopping LCU monitor...")
        try:
            await self.data_transmitter.stop()
            if self.connector:
                await self.connector.stop()
            
            if hasattr(self, '_bg_task') and self._bg_task:
                self._bg_task.cancel()
        except Exception as e:
            logger.error(f"Error stopping LCU monitor: {e}")

    async def _process_gameflow_phase(self, phase_data: str):
        """Process gameflow phase change with state machine logic"""
        old_phase = self.current_phase
        new_phase = phase_data.strip('"') if isinstance(phase_data, str) else str(phase_data)

        if new_phase == self.current_phase:
            return  # No change

        logger.info(f"Gameflow: {self.current_phase} → {new_phase}")
        self.current_phase = new_phase

        # STATE MACHINE TRANSITIONS

        # IDLE → MONITORING_CHAMP_SELECT
        if new_phase == self.PHASE_CHAMP_SELECT:
            self._set_state(MonitorState.MONITORING_CHAMP_SELECT)
            self._game_went_through = False  # Reset flag
            self._champ_select_notification_sent = False  # Reset notification flag
            
            # CRITICAL FIX: Fetch current champ select session immediately
            # This captures any picks/bans that happened before we started monitoring
            # (e.g., starting app mid-champion select, or bot games with pre-selected champions)
            await self._fetch_current_champ_select_session()

        # MONITORING_CHAMP_SELECT → GAME_STARTED (success path)
        elif new_phase in [self.PHASE_IN_PROGRESS, self.PHASE_GAME_START]:
            if self.state == MonitorState.MONITORING_CHAMP_SELECT:
                self._game_went_through = True
                self._set_state(MonitorState.GAME_STARTED)
                self.notifier.on_game_started(self.current_lobby_id or "unknown")
                logger.info(f"Game started successfully from lobby {self.current_lobby_id}")
            else:
                # Came from elsewhere (spectator, replay, etc.)
                self._set_state(MonitorState.GAME_STARTED)
                logger.debug(f"Entered game from state: {self.state.value}")

        # Handle NONE phase (game ended or cancelled)
        elif new_phase == self.PHASE_NONE:
            await self._handle_none_phase(old_phase)

        # Handle LOBBY phase (champ select cancelled via dodge)
        elif new_phase == self.PHASE_LOBBY:
            await self._handle_lobby_phase(old_phase)

        # Handle post-game phases
        elif new_phase in [self.PHASE_END_GAME, self.PHASE_PRE_END_GAME]:
            logger.debug(f"Post-game phase: {new_phase}")

    async def _handle_none_phase(self, old_phase: Optional[str]):
        """Handle transition to NONE phase (game ended or client in limbo)"""
        if self.state == MonitorState.MONITORING_CHAMP_SELECT:
            # We were in champ select but never reached InProgress
            # This means champ select was cancelled
            logger.info(f"Champion select cancelled (went to None from {old_phase})")
            await self._cancel_draft("cancelled")

        elif self.state == MonitorState.GAME_STARTED:
            # Game ended normally - draft stays in database
            logger.info(f"Game ended normally, draft preserved for lobby {self.current_lobby_id}")
            self.notifier.on_game_ended(self.current_lobby_id or "unknown")

        # Reset and go to IDLE
        self._reset_draft_state()
        self._set_state(MonitorState.IDLE)

    async def _handle_lobby_phase(self, old_phase: Optional[str]):
        """Handle transition to LOBBY phase (dodge or normal return)"""
        if self.state == MonitorState.MONITORING_CHAMP_SELECT:
            # We were in champ select but returned to lobby
            # This is a dodge/leave during champ select
            if old_phase == self.PHASE_CHAMP_SELECT:
                logger.info(f"Dodge detected: ChampSelect → Lobby")
                await self._cancel_draft("dodge")
            else:
                logger.info(f"Champion select ended, returning to lobby")
                await self._cancel_draft("cancelled")

            # Reset and go to IDLE
            self._reset_draft_state()
            self._set_state(MonitorState.IDLE)

        elif self.state == MonitorState.GAME_STARTED:
            # Game ended and we're back to lobby
            logger.debug(f"Game ended, returned to lobby")
            self._reset_draft_state()
            self._set_state(MonitorState.IDLE)

    async def _cancel_draft(self, reason: str):
        """Cancel and delete the current draft"""
        if self.current_lobby_id and self.last_draft_data:
            logger.info(f"Deleting draft for lobby {self.current_lobby_id} (reason: {reason})")
            self.notifier.on_champ_select_cancelled(self.current_lobby_id, reason)

            success = await self.data_transmitter.send_deletion_request(
                self.current_lobby_id,
                self.workspace_id
            )

            if success:
                self.notifier.on_draft_deleted(self.current_lobby_id, reason)
        else:
            logger.debug(f"No draft to cancel (lobby: {self.current_lobby_id}, data: {self.last_draft_data is not None})")

    def _reset_draft_state(self):
        """Reset draft tracking state"""
        # CRITICAL FIX: Clear lobby_id to prevent empty document creation
        # This prevents the bug where champ_select_update fires after deletion
        # with stale data and creates an empty document
        self.current_lobby_id = None
        self.last_draft_data = None
        self._game_went_through = False
        self._champ_select_notification_sent = False
        
        # Clear action timestamps
        self._action_timestamps.clear()
        
        # Clear initial picks
        self._initial_picks.clear()

        # Clear blocked lobbies in transmitter to prevent memory growth
        # and allow reuse of lobby IDs if needed
        self.data_transmitter.clear_blocked_lobbies()

        logger.debug("Draft state reset")

    async def _fetch_current_champ_select_session(self):
        """Fetch current champ select session data immediately
        
        This is critical for capturing picks/bans that happened before we started monitoring.
        Called when entering ChampSelect phase to get initial state.
        """
        try:
            # Check if we have a connection
            if not hasattr(self, '_connection') or not self._connection:
                logger.warning("No LCU connection available to fetch champ select session")
                return

            logger.info("Fetching current champ select session data...")
            
            # Make HTTP GET request to fetch current session
            response = await self._connection.request('get', self.CHAMP_SELECT_URL)
            
            if response.status == 200:
                # Read JSON data from the response - handle both aiohttp ClientResponse 
                # and lcu-driver wrapped responses
                try:
                    # Try to get JSON from aiohttp ClientResponse
                    session_data = await response.json()
                except (AttributeError, TypeError):
                    # If that fails, try .data attribute (lcu-driver wrapped response)
                    session_data = getattr(response, 'data', None)
                
                if session_data:
                    logger.info("Successfully fetched current champ select session")
                    # Process the fetched data just like we would process a WebSocket event
                    await self._process_champ_select_data(session_data)
                else:
                    logger.debug("Champ select session data is empty")
            elif response.status == 404:
                # No active champ select session (might have ended already)
                logger.debug("No active champ select session found (404)")
            else:
                logger.warning(f"Failed to fetch champ select session: HTTP {response.status}")
                
        except Exception as e:
            logger.error(f"Error fetching current champ select session: {e}")

    async def _process_lobby_data(self, lobby_data: Dict[str, Any]):
        """Process lobby data to extract lobby ID - only when IDLE"""
        try:
            if 'gameId' in lobby_data:
                new_lobby_id = str(lobby_data['gameId'])

                # Only update if different and we're not currently tracking a game
                if new_lobby_id != self.current_lobby_id and self.state == MonitorState.IDLE:
                    logger.info(f"Lobby ID: {self.current_lobby_id} → {new_lobby_id}")
                    self.current_lobby_id = new_lobby_id

        except Exception as e:
            logger.error(f"Error processing lobby data: {e}")

    async def _process_champ_select_data(self, champ_select_data: Dict[str, Any]):
        """Process champion select session data - only called in MONITORING state"""
        try:
            logger.debug(f"[PROCESS_CHAMP_SELECT] Starting processing for lobby {self.current_lobby_id}")
            
            # GUARD: Must be in monitoring state
            if self.state != MonitorState.MONITORING_CHAMP_SELECT:
                logger.debug(f"[GUARD_FAIL] Not in monitoring state, current: {self.state.value}")
                return

            # GUARD: Must have valid lobby_id (not None, empty, or "UNKNOWN")
            if not self.current_lobby_id or self.current_lobby_id.strip().upper() == "UNKNOWN":
                # Try to extract from champ select data
                if 'gameId' in champ_select_data:
                    extracted_lobby_id = str(champ_select_data['gameId'])
                    # Validate extracted lobby_id is not UNKNOWN
                    if extracted_lobby_id.strip().upper() == "UNKNOWN":
                        logger.warning(f"[GUARD_FAIL] Extracted lobby_id is UNKNOWN, skipping")
                        return
                    self.current_lobby_id = extracted_lobby_id
                    logger.info(f"[LOBBY_ID_SET] Set lobby_id from champ select: {self.current_lobby_id}")
                    # Send notification now that we have the lobby ID
                    if not self._champ_select_notification_sent:
                        self.notifier.on_champ_select_started(self.current_lobby_id)
                        self._champ_select_notification_sent = True
                else:
                    logger.warning("[GUARD_FAIL] No lobby_id available, skipping champ select data")
                    return

            # GUARD: Must have workspace_id
            if not self.workspace_id:
                logger.warning("[GUARD_FAIL] No workspace_id configured, skipping")
                return

            # GUARD: Validate champ select data isn't empty/stale
            if not self._is_valid_champ_select_data(champ_select_data):
                logger.debug("[GUARD_FAIL] Invalid or empty champ select data, skipping")
                return

            # Log raw team data for debugging
            my_team = champ_select_data.get('myTeam', [])
            their_team = champ_select_data.get('theirTeam', [])
            logger.debug(f"[TEAM_DATA] myTeam: {len(my_team)} players, theirTeam: {len(their_team)} players")
            
            # Log each player's champion assignment
            for player in my_team:
                logger.debug(f"[MY_TEAM] cellId={player.get('cellId')}, champId={player.get('championId')}, team={player.get('team')}")
            for player in their_team:
                logger.debug(f"[THEIR_TEAM] cellId={player.get('cellId')}, champId={player.get('championId')}, team={player.get('team')}")

            # Extract draft data
            draft_data = self._extract_draft_data(champ_select_data)

            if draft_data:
                # Log extracted data
                logger.debug(f"[EXTRACTED] Blue picks: {draft_data.blue_side.picks}, Red picks: {draft_data.red_side.picks}")
                logger.debug(f"[EXTRACTED] Blue bans: {draft_data.blue_side.bans}, Red bans: {draft_data.red_side.bans}")
                logger.debug(f"[EXTRACTED] Phase: {draft_data.phase}")
                
                # CRITICAL FIX: Reject ghost documents (no picks or bans)
                if not draft_data.has_meaningful_data():
                    logger.debug(f"[GUARD_FAIL] Draft has no picks or bans - ghost document rejected for lobby {self.current_lobby_id}")
                    return
                
                # CRITICAL FIX: Compare using raw ID-based data (not converted names)
                # This prevents the bug where names are compared against IDs
                has_changes, change_details = self._has_draft_changes_detailed(draft_data)
                
                if has_changes:
                    logger.info(f"[CHANGE_DETECTED] {change_details}")

                    # Store the raw ID-based data for future comparison
                    import copy
                    self._last_raw_draft_data = copy.deepcopy(draft_data)

                    # Convert champion IDs to names
                    self.champion_mapper.update_draft_with_names(draft_data)
                    draft_data.update_hash()
                    
                    logger.debug(f"[HASH] New hash: {draft_data.data_hash}")
                    if self.last_draft_data:
                        logger.debug(f"[HASH] Old hash: {self.last_draft_data.data_hash}")

                    # Queue for transmission
                    success = await self.data_transmitter.queue_draft_data(draft_data)

                    if success:
                        pick_count = len(draft_data.blue_side.picks) + len(draft_data.red_side.picks)
                        ban_count = len(draft_data.blue_side.bans) + len(draft_data.red_side.bans)
                        logger.info(f"[TRANSMIT_QUEUED] Picks: {pick_count}, Bans: {ban_count} for lobby {self.current_lobby_id}")
                        self.notifier.on_draft_saved(self.current_lobby_id, pick_count, ban_count)
                        self.last_draft_data = draft_data
                    else:
                        logger.warning(f"[TRANSMIT_FAIL] Failed to queue draft data for lobby {self.current_lobby_id}")
                else:
                    logger.debug(f"[NO_CHANGE] No meaningful draft changes for lobby {self.current_lobby_id}")
            else:
                logger.warning("[EXTRACTION_FAIL] Failed to extract draft data from champ select session")

        except Exception as e:
            logger.error(f"[ERROR] Error processing champ select data: {e}", exc_info=True)

    def _has_draft_changes_detailed(self, new_draft: DraftData) -> tuple[bool, str]:
        """Check if draft data has changed with detailed reason"""
        monitoring_settings = self.config_manager.get_monitoring_settings()

        if not monitoring_settings.get("enable_change_detection", True):
            return True, "Change detection disabled"

        # CRITICAL FIX: Use _last_raw_draft_data (ID-based) for comparison
        if not self._last_raw_draft_data:
            return True, "No previous data (first transmission)"

        changes = []
        
        # Check phase change
        if new_draft.phase != self._last_raw_draft_data.phase:
            changes.append(f"phase: {self._last_raw_draft_data.phase} -> {new_draft.phase}")
        
        # Check blue picks
        if new_draft.blue_side.picks != self._last_raw_draft_data.blue_side.picks:
            changes.append(f"blue_picks: {self._last_raw_draft_data.blue_side.picks} -> {new_draft.blue_side.picks}")
        
        # Check red picks
        if new_draft.red_side.picks != self._last_raw_draft_data.red_side.picks:
            changes.append(f"red_picks: {self._last_raw_draft_data.red_side.picks} -> {new_draft.red_side.picks}")
        
        # Check blue bans
        if new_draft.blue_side.bans != self._last_raw_draft_data.blue_side.bans:
            changes.append(f"blue_bans: {self._last_raw_draft_data.blue_side.bans} -> {new_draft.blue_side.bans}")
        
        # Check red bans
        if new_draft.red_side.bans != self._last_raw_draft_data.red_side.bans:
            changes.append(f"red_bans: {self._last_raw_draft_data.red_side.bans} -> {new_draft.red_side.bans}")
        
        if changes:
            return True, "; ".join(changes)
        return False, "No changes detected"

    def _is_valid_champ_select_data(self, session_data: Dict[str, Any]) -> bool:
        """Validate that champ select data is meaningful and not empty/stale"""
        # Check for required fields
        if not session_data:
            return False

        # Must have actions or timer
        has_actions = bool(session_data.get('actions'))
        has_timer = bool(session_data.get('timer'))

        if not has_actions and not has_timer:
            return False

        # Check if actions contain any meaningful data
        actions = session_data.get('actions', [])
        has_completed_actions = False

        for action_group in actions:
            if isinstance(action_group, list):
                for action in action_group:
                    if action.get('completed', False) and action.get('championId', 0) > 0:
                        has_completed_actions = True
                        break
            if has_completed_actions:
                break

        # Allow through if we have timer phase (even without completed actions yet)
        timer = session_data.get('timer', {})
        has_valid_phase = timer.get('phase') is not None

        return has_completed_actions or has_valid_phase

    def _extract_draft_data(self, session_data: Dict[str, Any]) -> Optional[DraftData]:
        """Extract draft data from champ select session using chronological actions"""
        try:
            # Initialize draft data
            draft_data = DraftData(
                lobby_id=self.current_lobby_id,
                workspace_id=self.workspace_id,
                phase=self._get_champ_select_phase(session_data)
            )

            # Build a reliable cell -> team map to avoid perspective bugs
            my_team = session_data.get('myTeam', [])
            their_team = session_data.get('theirTeam', [])
            all_players = my_team + their_team
            
            cell_to_team = {}
            for p in all_players:
                cell_id = p.get('cellId')
                team_id = p.get('team')
                if cell_id is not None and team_id is not None:
                    cell_to_team[cell_id] = team_id

            # Extract actions chronologically to ensure strict pick/ban ordering and stable timestamps
            actions = session_data.get('actions', [])
            
            extracted = self._extract_completed_actions_chronological(actions, cell_to_team)
            
            # Set team data
            draft_data.blue_side.picks = extracted['blue_picks']
            draft_data.red_side.picks = extracted['red_picks']
            draft_data.blue_side.bans = extracted['blue_bans']
            draft_data.red_side.bans = extracted['red_bans']
            
            draft_data.blue_side.pick_events = extracted['blue_pick_events']
            draft_data.red_side.pick_events = extracted['red_pick_events']
            draft_data.blue_side.ban_events = extracted['blue_ban_events']
            draft_data.red_side.ban_events = extracted['red_ban_events']

            # Check if this is a new game
            draft_data.is_new_game = self._is_new_game(draft_data)

            return draft_data

        except Exception as e:
            logger.error(f"Error extracting draft data: {e}")
            return None

    def _extract_completed_actions_chronological(self, actions: List[List[Dict[str, Any]]], cell_to_team: Dict[int, int]) -> Dict[str, Any]:
        """Extract firmly locked picks and bans strictly by their chronological action phase."""
        result = {
            'blue_picks': [], 'red_picks': [],
            'blue_bans': [], 'red_bans': [],
            'blue_pick_events': [], 'red_pick_events': [],
            'blue_ban_events': [], 'red_ban_events': []
        }
        
        try:
            blue_pick_order, red_pick_order = 0, 0
            blue_ban_order, red_ban_order = 0, 0
            
            for action_group in actions:
                for action in action_group:
                    # Ignore hovers, we only want firmly locked choices
                    if not action.get('completed', False):
                        continue
                        
                    action_id = action.get('id')
                    action_type = action.get('type')
                    champion_id = action.get('championId', 0)
                    actor_cell_id = action.get('actorCellId')
                    
                    # Stable timestamp generator based on action ID
                    if action_id is not None:
                        if action_id not in self._action_timestamps:
                            self._action_timestamps[action_id] = datetime.now()
                        event_timestamp = self._action_timestamps[action_id]
                    else:
                        event_timestamp = datetime.now()
                        
                    # Rely on true team association (1=Blue, 2=Red) instead of player perspective
                    team_id = cell_to_team.get(actor_cell_id, 0)
                    is_blue = (team_id == 1)
                    is_red = (team_id == 2)
                    
                    if not (is_blue or is_red):
                        logger.debug(f"Action ignored due to unknown team assignment for cell {actor_cell_id}")
                        continue
                        
                    # CRITICAL: Prevent swaps from overriding original pick entirely
                    champion_str = "None"
                    if action_type == 'pick':
                        # If this cell already picked a champion previously, ignore the current action's champion
                        if actor_cell_id in self._initial_picks:
                            champion_str = self._initial_picks[actor_cell_id]
                        else:
                            # If it's the first time they locked in a valid champion
                            if champion_id > 0:
                                champion_str = str(champion_id)
                                self._initial_picks[actor_cell_id] = champion_str
                            else:
                                champion_str = "None"
                    else:
                        champion_str = str(champion_id) if champion_id > 0 else "None"
                    
                    if action_type == 'ban':
                        if is_blue:
                            blue_ban_order += 1
                            result['blue_bans'].append(champion_str)
                            result['blue_ban_events'].append(ChampionEvent(
                                champion_id=champion_str, order=blue_ban_order, timestamp=event_timestamp
                            ))
                        else:
                            red_ban_order += 1
                            result['red_bans'].append(champion_str)
                            result['red_ban_events'].append(ChampionEvent(
                                champion_id=champion_str, order=red_ban_order, timestamp=event_timestamp
                            ))
                    elif action_type == 'pick':
                        # Empty picks (championId <= 0) mean they haven't picked yet
                        if champion_str != "None":
                            if is_blue:
                                blue_pick_order += 1
                                result['blue_picks'].append(champion_str)
                                result['blue_pick_events'].append(ChampionEvent(
                                    champion_id=champion_str, order=blue_pick_order, timestamp=event_timestamp
                                ))
                            else:
                                red_pick_order += 1
                                result['red_picks'].append(champion_str)
                                result['red_pick_events'].append(ChampionEvent(
                                    champion_id=champion_str, order=red_pick_order, timestamp=event_timestamp
                                ))
                                
        except Exception as e:
            logger.error(f"Error chronologically extracting actions: {e}")

        return result

    def _extract_team_data(self, team_data: List[Dict[str, Any]]) -> TeamData:
        """Extract team data from LCU format (fallback method)"""
        team = TeamData()

        # Collect pick data with cell IDs for sorting
        pick_data = []
        ban_data = []

        for player in team_data:
            cell_id = player.get('cellId', 0)
            champion_id = player.get('championId', 0)
            assigned_position = player.get('assignedPosition')

            if champion_id > 0:
                champion_name = str(champion_id)  # Will be converted to name later

                # Check if this is a ban (simplified logic - LCU bans are complex)
                # Bans typically have assignedPosition as 'none' or specific ban positions
                is_ban = assigned_position == 'none' or cell_id >= 10  # Rough heuristic

                if is_ban:
                    ban_data.append((champion_name, cell_id))
                else:
                    pick_data.append((champion_name, cell_id))

        # Sort picks by cell ID (0-4 order for standard 5v5)
        pick_data.sort(key=lambda x: x[1])
        team.picks = [pick[0] for pick in pick_data]

        # Create pick events with order
        from datetime import datetime
        team.pick_events = [
            ChampionEvent(champion_id=pick[0], order=i + 1, timestamp=datetime.now())
            for i, pick in enumerate(pick_data)
        ]

        # Sort bans (typically by ban order, but LCU structure varies)
        ban_data.sort(key=lambda x: x[1])
        team.bans = [ban[0] for ban in ban_data]

        # Create ban events with order
        team.ban_events = [
            ChampionEvent(champion_id=ban[0], order=i + 1, timestamp=datetime.now())
            for i, ban in enumerate(ban_data)
        ]

        return team

    def _get_champ_select_phase(self, session_data: Dict[str, Any]) -> str:
        """Extract current champion select phase"""
        try:
            timer = session_data.get('timer', {})
            phase = timer.get('phase', 'UNKNOWN')
            return phase.upper()
        except:
            return 'UNKNOWN'

    def _is_new_game(self, draft_data: DraftData) -> bool:
        """Determine if this is the start of a new game"""
        if not self.last_draft_data:
            return True

        # Compare lobby IDs
        return draft_data.lobby_id != self.last_draft_data.lobby_id

    def _has_draft_changes(self, new_draft: DraftData) -> bool:
        """Check if draft data has changed"""
        monitoring_settings = self.config_manager.get_monitoring_settings()

        if not monitoring_settings.get("enable_change_detection", True):
            return True  # Always send if change detection disabled

        if not self.last_draft_data:
            return True  # No previous data

        return new_draft.has_changes(self.last_draft_data)

    def get_status(self) -> Dict[str, Any]:
        """Get current monitor status"""
        return {
            "is_connected": self.is_connected,
            "state": self.state.value,
            "current_phase": self.current_phase,
            "current_lobby_id": self.current_lobby_id,
            "workspace_id": self.workspace_id,
            "last_draft_hash": self.last_draft_data.data_hash if self.last_draft_data else None,
            "game_went_through": self._game_went_through,
            "queue_size": self.data_transmitter.get_queue_size()
        }


# Global instance
_lcu_monitor = LCUMonitor()


def get_lcu_monitor() -> LCUMonitor:
    """Get the global LCU monitor instance"""
    return _lcu_monitor
