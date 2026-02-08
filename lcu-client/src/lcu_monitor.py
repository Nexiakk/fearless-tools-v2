"""
Core LCU monitoring service using lcu-driver.
Handles WebSocket connections, event processing, and draft data extraction.
Uses state machine pattern for optimized resource usage.
"""

import asyncio
import logging
from enum import Enum, auto
from typing import Dict, List, Optional, Any, Set
from datetime import datetime

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


class LCUMonitor:
    """Monitors League Client Update API for draft data with state machine"""

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

        # Track whether current draft resulted in a game
        self._game_went_through = False
        
        # Track if we've sent the champ select started notification
        self._champ_select_notification_sent = False

        # Event handlers will be set up when connector is created
        self._event_handlers_setup = False

    def _set_state(self, new_state: MonitorState) -> None:
        """Change monitor state with logging and notification"""
        if self.state != new_state:
            old_state = self.state
            self.state = new_state
            self.notifier.on_state_changed(old_state.value, new_state.value)
            logger.info(f"Monitor state: {old_state.value} → {new_state.value}")

    def _setup_event_handlers(self):
        """Set up LCU event handlers"""

        @self.connector.ready
        async def connect(connection):
            logger.info('LCU connection established')
            self.is_connected = True
            self.workspace_id = self.config_manager.get_workspace_id()
            self.notifier.on_connection_restored()
            
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
            self.notifier.on_connection_lost()

        @self.connector.ws.register(self.CHAMP_SELECT_URL)
        async def champ_select_update(connection, event):
            """Handle champion select session updates - only process in monitoring state"""
            # OPTIMIZATION: Ignore champ select events when not monitoring
            if self.state != MonitorState.MONITORING_CHAMP_SELECT:
                logger.debug(f"Ignoring champ select event in {self.state.value} state")
                return

            if event.data:
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
        """Start the LCU monitor - this will run the event loop"""
        if not self.config_manager.is_configured():
            logger.error("LCU client not properly configured")
            return False

        try:
            logger.info("Starting LCU monitor...")

            # Create new event loop for lcu-driver
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            # Create connector
            self.connector = Connector()
            self._setup_event_handlers()

            # Start the connector - this will run the event loop
            self.connector.start()
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
            # GUARD: Must be in monitoring state
            if self.state != MonitorState.MONITORING_CHAMP_SELECT:
                logger.debug(f"Ignoring champ select data in {self.state.value} state")
                return

            # GUARD: Must have valid lobby_id
            if not self.current_lobby_id:
                # Try to extract from champ select data
                if 'gameId' in champ_select_data:
                    self.current_lobby_id = str(champ_select_data['gameId'])
                    logger.info(f"Set lobby_id from champ select: {self.current_lobby_id}")
                    # Send notification now that we have the lobby ID
                    if not self._champ_select_notification_sent:
                        self.notifier.on_champ_select_started(self.current_lobby_id)
                        self._champ_select_notification_sent = True
                else:
                    logger.warning("No lobby_id available, skipping champ select data")
                    return

            # GUARD: Must have workspace_id
            if not self.workspace_id:
                logger.warning("No workspace_id configured, skipping")
                return

            # GUARD: Validate champ select data isn't empty/stale
            if not self._is_valid_champ_select_data(champ_select_data):
                logger.debug("Invalid or empty champ select data, skipping")
                return

            # Extract draft data
            draft_data = self._extract_draft_data(champ_select_data)

            if draft_data:
                # Check for meaningful changes
                if self._has_draft_changes(draft_data):
                    logger.debug(f"Draft changes detected for lobby {self.current_lobby_id}")

                    # Convert champion IDs to names
                    self.champion_mapper.update_draft_with_names(draft_data)
                    draft_data.update_hash()

                    # Queue for transmission
                    success = await self.data_transmitter.queue_draft_data(draft_data)

                    if success:
                        pick_count = len(draft_data.blue_side.picks) + len(draft_data.red_side.picks)
                        ban_count = len(draft_data.blue_side.bans) + len(draft_data.red_side.bans)
                        self.notifier.on_draft_saved(self.current_lobby_id, pick_count, ban_count)
                        self.last_draft_data = draft_data
                else:
                    logger.debug(f"No draft changes for lobby {self.current_lobby_id}")
            else:
                logger.warning("Failed to extract draft data from champ select session")

        except Exception as e:
            logger.error(f"Error processing champ select data: {e}")

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
        """Extract draft data from champ select session"""
        try:
            # Initialize draft data
            draft_data = DraftData(
                lobby_id=self.current_lobby_id,
                workspace_id=self.workspace_id,
                phase=self._get_champ_select_phase(session_data)
            )

            # Extract actions data (this is where bans and picks are stored)
            actions = session_data.get('actions', [])

            # Process actions to extract bans and picks with timestamps
            blue_bans, blue_picks, red_bans, red_picks, \
            blue_ban_events, blue_pick_events, red_ban_events, red_pick_events = self._extract_actions_data(actions)

            # CRITICAL FIX: Also extract picks from team data (for bots/pre-assigned champions)
            # Bots have champions assigned directly in myTeam/theirTeam, not through actions
            # We need to extract by ACTUAL side (team=1 is blue, team=2 is red), not by my/their team
            my_team = session_data.get('myTeam', [])
            their_team = session_data.get('theirTeam', [])
            
            # Extract picks from both team arrays, respecting actual blue/red side
            my_team_blue, my_team_red = self._extract_team_picks_by_side(my_team)
            their_team_blue, their_team_red = self._extract_team_picks_by_side(their_team)
            
            # Combine picks from both arrays for each side
            all_blue_team_picks = my_team_blue + their_team_blue
            all_red_team_picks = my_team_red + their_team_red
            
            # Merge team picks with action picks (avoid duplicates)
            # Action picks take precedence for players, team picks fill in bots
            blue_picks = self._merge_picks(blue_picks, all_blue_team_picks)
            red_picks = self._merge_picks(red_picks, all_red_team_picks)

            # Set team data
            draft_data.blue_side.bans = blue_bans
            draft_data.blue_side.picks = blue_picks
            draft_data.red_side.bans = red_bans
            draft_data.red_side.picks = red_picks

            # Set timestamped events
            draft_data.blue_side.ban_events = blue_ban_events
            draft_data.blue_side.pick_events = blue_pick_events
            draft_data.red_side.ban_events = red_ban_events
            draft_data.red_side.pick_events = red_pick_events

            # Create ordered data (simplified - just by order they appear)
            draft_data.blue_side.bans_ordered = [{'championId': ban, 'order': i + 1} for i, ban in enumerate(blue_bans)]
            draft_data.blue_side.picks_ordered = [{'championId': pick, 'order': i + 1} for i, pick in enumerate(blue_picks)]
            draft_data.red_side.bans_ordered = [{'championId': ban, 'order': i + 1} for i, ban in enumerate(red_bans)]
            draft_data.red_side.picks_ordered = [{'championId': pick, 'order': i + 1} for i, pick in enumerate(red_picks)]

            # Check if this is a new game
            draft_data.is_new_game = self._is_new_game(draft_data)

            return draft_data

        except Exception as e:
            logger.error(f"Error extracting draft data: {e}")
            return None

    def _extract_team_picks_by_side(self, team_data: List[Dict[str, Any]]) -> tuple:
        """Extract champion picks from team data separated by actual blue/red side
        
        Returns: (blue_picks, red_picks) where each is a list of champion IDs
        In LCU API: team=1 means blue side, team=2 means red side
        """
        blue_picks = []
        red_picks = []
        
        try:
            for player in team_data:
                champion_id = player.get('championId', 0)
                team_id = player.get('team', 0)  # 1 = blue, 2 = red
                
                # championId > 0 means a champion is assigned (including bots)
                if champion_id > 0:
                    champion_str = str(champion_id)
                    if team_id == 1:
                        blue_picks.append(champion_str)
                    elif team_id == 2:
                        red_picks.append(champion_str)
                    else:
                        # Fallback: if team is not specified, log a warning
                        logger.debug(f"Player with champion {champion_id} has unknown team {team_id}")
                        
        except Exception as e:
            logger.error(f"Error extracting team picks by side: {e}")
        
        return blue_picks, red_picks

    def _merge_picks(self, action_picks: List[str], team_picks: List[str]) -> List[str]:
        """Merge picks from actions and team data, avoiding duplicates"""
        # Start with action picks (these are from actual player selections)
        merged = list(action_picks)
        
        # Add team picks that aren't already in the list (these are likely bots)
        for pick in team_picks:
            if pick not in merged:
                merged.append(pick)
        
        return merged

    def _extract_actions_data(self, actions: List[List[Dict[str, Any]]]) -> tuple:
        """Extract bans and picks from actions data with timestamps"""
        blue_bans = []
        blue_picks = []
        red_bans = []
        red_picks = []
        
        # NEW: Timestamped events
        blue_ban_events: List[ChampionEvent] = []
        blue_pick_events: List[ChampionEvent] = []
        red_ban_events: List[ChampionEvent] = []
        red_pick_events: List[ChampionEvent] = []

        try:
            # Actions is an array of arrays, each containing actions of a specific type
            # Typically: actions[0] = phase transitions, actions[1] = bans, actions[2] = picks
            
            # Track order counters for each type
            blue_ban_order = 0
            blue_pick_order = 0
            red_ban_order = 0
            red_pick_order = 0
            
            for action_group in actions:
                for action in action_group:
                    action_type = action.get('type')
                    champion_id = action.get('championId', 0)
                    is_ally_action = action.get('isAllyAction', True)
                    completed = action.get('completed', False)

                    # Only process completed actions with valid champion IDs
                    if completed and champion_id > 0:
                        champion_str = str(champion_id)
                        # Capture current timestamp for this event
                        event_timestamp = datetime.now()

                        if action_type == 'ban':
                            if is_ally_action:
                                blue_ban_order += 1
                                blue_bans.append(champion_str)
                                blue_ban_events.append(ChampionEvent(
                                    champion_id=champion_str,
                                    order=blue_ban_order,
                                    timestamp=event_timestamp
                                ))
                            else:
                                red_ban_order += 1
                                red_bans.append(champion_str)
                                red_ban_events.append(ChampionEvent(
                                    champion_id=champion_str,
                                    order=red_ban_order,
                                    timestamp=event_timestamp
                                ))
                        elif action_type == 'pick':
                            if is_ally_action:
                                blue_pick_order += 1
                                blue_picks.append(champion_str)
                                blue_pick_events.append(ChampionEvent(
                                    champion_id=champion_str,
                                    order=blue_pick_order,
                                    timestamp=event_timestamp
                                ))
                            else:
                                red_pick_order += 1
                                red_picks.append(champion_str)
                                red_pick_events.append(ChampionEvent(
                                    champion_id=champion_str,
                                    order=red_pick_order,
                                    timestamp=event_timestamp
                                ))

        except Exception as e:
            logger.error(f"Error extracting actions data: {e}")

        return (blue_bans, blue_picks, red_bans, red_picks,
                blue_ban_events, blue_pick_events, red_ban_events, red_pick_events)

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

        # Create ordered picks
        team.picks_ordered = [
            {'championId': pick[0], 'order': i + 1}
            for i, pick in enumerate(pick_data)
        ]

        # Sort bans (typically by ban order, but LCU structure varies)
        ban_data.sort(key=lambda x: x[1])
        team.bans = [ban[0] for ban in ban_data]

        # Create ordered bans
        team.bans_ordered = [
            {'championId': ban[0], 'order': i + 1}
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
