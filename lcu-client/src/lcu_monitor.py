"""
Core LCU monitoring service using lcu-driver.
Handles WebSocket connections, event processing, and draft data extraction.
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Set
from datetime import datetime

from lcu_driver import Connector
from lcu_driver.events.responses import WebsocketEventResponse

try:
    # Try relative imports first (when run as package)
    from .models import DraftData, GameflowPhase, TeamData, ChampionAction
    from .champion_mapper import get_champion_mapper
    from .data_transmitter import get_data_transmitter
    from .config_manager import get_config_manager
except ImportError:
    # Fall back to absolute imports (when run standalone)
    from models import DraftData, GameflowPhase, TeamData, ChampionAction
    from champion_mapper import get_champion_mapper
    from data_transmitter import get_data_transmitter
    from config_manager import get_config_manager

logger = logging.getLogger(__name__)


class LCUMonitor:
    """Monitors League Client Update API for draft data"""

    # LCU API endpoints
    CHAMP_SELECT_URL = '/lol-champ-select/v1/session'
    GAMEFLOW_URL = '/lol-gameflow/v1/gameflow-phase'
    LOBBY_URL = '/lol-lobby/v1/lobby'

    # Gameflow phases
    PHASE_LOBBY = 'Lobby'
    PHASE_CHAMP_SELECT = 'ChampSelect'
    PHASE_IN_PROGRESS = 'InProgress'
    PHASE_NONE = 'None'

    def __init__(self):
        # Defer connector creation until start() to avoid event loop issues
        self.connector = None
        self.champion_mapper = get_champion_mapper()
        self.data_transmitter = get_data_transmitter()
        self.config_manager = get_config_manager()

        # State tracking
        self.is_connected = False
        self.current_lobby_id: Optional[str] = None
        self.current_phase: Optional[str] = None
        self.last_draft_data: Optional[DraftData] = None
        self.workspace_id: Optional[str] = None

        # Monitoring settings
        self.monitoring_settings = self.config_manager.get_monitoring_settings()
        self.poll_intervals = {
            self.PHASE_CHAMP_SELECT: self.monitoring_settings.get("champ_select_interval", 1),
            self.PHASE_LOBBY: self.monitoring_settings.get("lobby_interval", 10),
            self.PHASE_IN_PROGRESS: self.monitoring_settings.get("active_game_interval", 60),
        }

        # Event handlers will be set up when connector is created
        self._event_handlers_setup = False

    def _setup_event_handlers(self):
        """Set up LCU event handlers"""

        @self.connector.ready
        async def connect(connection):
            logger.info('LCU connection established')
            self.is_connected = True
            self.workspace_id = self.config_manager.get_workspace_id()

            # Start data transmitter
            await self.data_transmitter.start()

        @self.connector.close
        async def disconnect(connection):
            logger.info('LCU connection closed')
            self.is_connected = False

        @self.connector.ws.register(self.CHAMP_SELECT_URL)
        async def champ_select_update(connection, event):
            """Handle champion select session updates"""
            if event.data:
                await self._process_champ_select_data(event.data)

        @self.connector.ws.register(self.GAMEFLOW_URL)
        async def gameflow_update(connection, event):
            """Handle gameflow phase changes"""
            if event.data:
                await self._process_gameflow_phase(event.data)

        @self.connector.ws.register(self.LOBBY_URL)
        async def lobby_update(connection, event):
            """Handle lobby updates"""
            if event.data:
                await self._process_lobby_data(event.data)

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
        """Process gameflow phase change"""
        old_phase = self.current_phase
        new_phase = phase_data.strip('"') if isinstance(phase_data, str) else str(phase_data)

        if new_phase != self.current_phase:
            logger.info(f"Gameflow phase changed: {self.current_phase} -> {new_phase}")
            self.current_phase = new_phase

            # Handle phase-specific logic
            if new_phase == self.PHASE_NONE:
                # Game ended or cancelled
                if self.last_draft_data:
                    await self.data_transmitter.send_deletion_request(
                        self.last_draft_data.lobby_id,
                        self.workspace_id
                    )
                    self.last_draft_data = None
                    self.current_lobby_id = None
            elif old_phase == self.PHASE_CHAMP_SELECT and new_phase not in [self.PHASE_IN_PROGRESS, self.PHASE_CHAMP_SELECT]:
                # Champion select was canceled (exited without starting game)
                logger.info(f"Champion select canceled, deleting draft for lobby {self.current_lobby_id}")
                if self.last_draft_data and self.current_lobby_id:
                    await self.data_transmitter.send_deletion_request(
                        self.current_lobby_id,
                        self.workspace_id
                    )
                    self.last_draft_data = None
                    self.current_lobby_id = None

    async def _process_lobby_data(self, lobby_data: Dict[str, Any]):
        """Process lobby data to extract lobby ID"""
        try:
            if 'gameId' in lobby_data:
                lobby_id = str(lobby_data['gameId'])
                if lobby_id != self.current_lobby_id:
                    logger.info(f"Lobby ID changed: {self.current_lobby_id} -> {lobby_id}")
                    self.current_lobby_id = lobby_id

                    # Reset draft data for new game
                    self.last_draft_data = None

        except Exception as e:
            logger.error(f"Error processing lobby data: {e}")

    async def _process_champ_select_data(self, champ_select_data: Dict[str, Any]):
        """Process champion select session data"""
        try:
            # Extract lobby_id from champ select data if not already set
            if not self.current_lobby_id and 'gameId' in champ_select_data:
                self.current_lobby_id = str(champ_select_data['gameId'])
                logger.info(f"Set lobby_id from champ select data: {self.current_lobby_id}")

            logger.info(f"Processing champ select data for lobby {self.current_lobby_id}, workspace {self.workspace_id}")
            if not self.current_lobby_id or not self.workspace_id:
                logger.warning(f"Missing lobby_id ({self.current_lobby_id}) or workspace_id ({self.workspace_id}), skipping")
                return

            # Extract draft data from champ select session
            draft_data = self._extract_draft_data(champ_select_data)

            if draft_data:
                logger.info(f"Extracted draft data: phase={draft_data.phase}, blue_picks={len(draft_data.blue_side.picks)}, red_picks={len(draft_data.red_side.picks)}")
                # Check for changes
                if self._has_draft_changes(draft_data):
                    logger.info(f"Draft changes detected for lobby {self.current_lobby_id}")

                    # Convert champion IDs to names
                    self.champion_mapper.update_draft_with_names(draft_data)
                    draft_data.update_hash()

                    # Queue for transmission
                    success = await self.data_transmitter.queue_draft_data(draft_data)
                    logger.info(f"Queued draft data for transmission: {success}")
                    self.last_draft_data = draft_data
                else:
                    logger.debug(f"No draft changes for lobby {self.current_lobby_id}")
            else:
                logger.warning(f"Failed to extract draft data from champ select session")

        except Exception as e:
            logger.error(f"Error processing champ select data: {e}")

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

            # Process actions to extract bans and picks
            blue_bans, blue_picks, red_bans, red_picks = self._extract_actions_data(actions)

            # Set team data
            draft_data.blue_side.bans = blue_bans
            draft_data.blue_side.picks = blue_picks
            draft_data.red_side.bans = red_bans
            draft_data.red_side.picks = red_picks

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

    def _extract_actions_data(self, actions: List[List[Dict[str, Any]]]) -> tuple:
        """Extract bans and picks from actions data"""
        blue_bans = []
        blue_picks = []
        red_bans = []
        red_picks = []

        try:
            # Actions is an array of arrays, each containing actions of a specific type
            # Typically: actions[0] = phase transitions, actions[1] = bans, actions[2] = picks
            for action_group in actions:
                for action in action_group:
                    action_type = action.get('type')
                    champion_id = action.get('championId', 0)
                    is_ally_action = action.get('isAllyAction', True)
                    completed = action.get('completed', False)

                    # Only process completed actions with valid champion IDs
                    if completed and champion_id > 0:
                        champion_str = str(champion_id)

                        if action_type == 'ban':
                            if is_ally_action:
                                blue_bans.append(champion_str)
                            else:
                                red_bans.append(champion_str)
                        elif action_type == 'pick':
                            if is_ally_action:
                                blue_picks.append(champion_str)
                            else:
                                red_picks.append(champion_str)

        except Exception as e:
            logger.error(f"Error extracting actions data: {e}")

        return blue_bans, blue_picks, red_bans, red_picks

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
            "current_phase": self.current_phase,
            "current_lobby_id": self.current_lobby_id,
            "workspace_id": self.workspace_id,
            "last_draft_hash": self.last_draft_data.data_hash if self.last_draft_data else None,
            "queue_size": self.data_transmitter.get_queue_size()
        }


# Global instance
_lcu_monitor = LCUMonitor()

def get_lcu_monitor() -> LCUMonitor:
    """Get the global LCU monitor instance"""
    return _lcu_monitor
