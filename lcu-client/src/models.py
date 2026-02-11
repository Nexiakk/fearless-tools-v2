"""
Data models for LCU draft data processing.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime
import hashlib
import json


@dataclass
class ChampionAction:
    """Represents a champion pick or ban action"""
    champion_id: str
    order: int
    actor_cell_id: Optional[int] = None
    is_ally_action: bool = True
    completed: bool = False


@dataclass
class ChampionEvent:
    """Represents a champion pick or ban event with timestamp"""
    champion_id: str
    order: int
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "championId": self.champion_id,
            "order": self.order,
            "timestamp": self.timestamp.isoformat()  # ISO format for JSON serialization
        }


@dataclass
class TeamData:
    """Champion data for one team (blue or red side)"""
    picks: List[str] = field(default_factory=list)  # Champion names in cell order (0-4)
    bans: List[str] = field(default_factory=list)   # Champion names in ban order
    pick_events: List[ChampionEvent] = field(default_factory=list)  # Timestamped pick events with championId, order, timestamp
    ban_events: List[ChampionEvent] = field(default_factory=list)   # Timestamped ban events with championId, order, timestamp


@dataclass
class DraftData:
    """Complete draft session data"""
    lobby_id: str
    workspace_id: str
    phase: str = "UNKNOWN"
    is_new_game: bool = False
    blue_side: TeamData = field(default_factory=TeamData)
    red_side: TeamData = field(default_factory=TeamData)
    data_hash: str = ""

    def calculate_hash(self) -> str:
        """Calculate MD5 hash of key data fields for change detection"""
        # Create a normalized representation of the key data
        hash_data = {
            "lobbyId": self.lobby_id,
            "phase": self.phase,
            "bluePicks": self.blue_side.picks,
            "blueBans": self.blue_side.bans,
            "redPicks": self.red_side.picks,
            "redBans": self.red_side.bans
        }

        # Sort keys for consistent hashing
        hash_string = json.dumps(hash_data, sort_keys=True)
        return hashlib.md5(hash_string.encode()).hexdigest()

    def update_hash(self):
        """Update the data hash"""
        self.data_hash = self.calculate_hash()

    def has_changes(self, other: 'DraftData') -> bool:
        """Check if this draft has changes compared to another"""
        if not other:
            return True
        return self.calculate_hash() != other.calculate_hash()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format for transmission"""
        return {
            "lobbyId": self.lobby_id,
            "workspaceId": self.workspace_id,
            "phase": self.phase,
            "isNewGame": self.is_new_game,
            "blue_side": {
                "picks": self.blue_side.picks,
                "bans": self.blue_side.bans,
                "pick_events": [e.to_dict() for e in self.blue_side.pick_events],
                "ban_events": [e.to_dict() for e in self.blue_side.ban_events]
            },
            "red_side": {
                "picks": self.red_side.picks,
                "bans": self.red_side.bans,
                "pick_events": [e.to_dict() for e in self.red_side.pick_events],
                "ban_events": [e.to_dict() for e in self.red_side.ban_events]
            },
            "dataHash": self.data_hash
        }

    def has_meaningful_data(self) -> bool:
        """
        Check if draft has any meaningful data (picks or bans).
        Ghost documents with empty picks and bans should be rejected.
        """
        has_picks = len(self.blue_side.picks) > 0 or len(self.red_side.picks) > 0
        has_bans = len(self.blue_side.bans) > 0 or len(self.red_side.bans) > 0
        return has_picks or has_bans
    
    def is_valid(self) -> bool:
        """
        Validate that this draft data is valid and should be transmitted.
        Rejects drafts with UNKNOWN, empty, or None lobby_id.
        Also rejects ghost documents with no picks or bans.
        """
        # Check lobby_id is not None
        if self.lobby_id is None:
            return False
        
        # Check lobby_id is a string and not empty/whitespace
        if not isinstance(self.lobby_id, str) or not self.lobby_id.strip():
            return False
        
        # Check lobby_id is not "UNKNOWN" (case-insensitive)
        if self.lobby_id.strip().upper() == "UNKNOWN":
            return False
        
        # Check workspace_id is also valid
        if self.workspace_id is None:
            return False
        
        if not isinstance(self.workspace_id, str) or not self.workspace_id.strip():
            return False
        
        # CRITICAL FIX: Check that draft has meaningful data (picks or bans)
        # This prevents ghost documents from being created
        if not self.has_meaningful_data():
            return False
        
        return True
    
    def get_validation_error(self) -> Optional[str]:
        """Get a human-readable validation error message if invalid."""
        if self.lobby_id is None:
            return "lobby_id is None"
        
        if not isinstance(self.lobby_id, str) or not self.lobby_id.strip():
            return f"lobby_id is empty or invalid: {repr(self.lobby_id)}"
        
        if self.lobby_id.strip().upper() == "UNKNOWN":
            return f"lobby_id is UNKNOWN"
        
        if self.workspace_id is None:
            return "workspace_id is None"
        
        if not isinstance(self.workspace_id, str) or not self.workspace_id.strip():
            return f"workspace_id is empty or invalid: {repr(self.workspace_id)}"
        
        # CRITICAL FIX: Check for ghost documents (no picks or bans)
        if not self.has_meaningful_data():
            return f"ghost document - no picks or bans (blue_picks: {len(self.blue_side.picks)}, red_picks: {len(self.red_side.picks)}, blue_bans: {len(self.blue_side.bans)}, red_bans: {len(self.red_side.bans)})"
        
        return None


@dataclass
class GameflowPhase:
    """Represents the current gameflow phase"""
    phase: str
    previous_phase: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class LCUConfig:
    """Configuration for LCU connection"""
    port: int = 21076  # Default live client port
    auth_token: Optional[str] = None
    use_tournament_client: bool = False

    @property
    def tournament_port(self) -> int:
        return 21077

    @property
    def active_port(self) -> int:
        return self.tournament_port if self.use_tournament_client else self.port


@dataclass
class TransmissionBatch:
    """Batch of draft data for transmission"""
    items: List[DraftData] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    max_size: int = 10
    max_age_seconds: int = 1000  # 1 second for champ select

    def add_item(self, item: DraftData) -> bool:
        """Add item to batch. Returns True if batch should be transmitted."""
        self.items.append(item)

        # Check if batch is full or should be sent
        should_transmit = (
            len(self.items) >= self.max_size or
            (datetime.now() - self.created_at).total_seconds() >= self.max_age_seconds
        )

        return should_transmit

    def clear(self):
        """Clear the batch"""
        self.items.clear()
        self.created_at = datetime.now()

    def is_empty(self) -> bool:
        """Check if batch is empty"""
        return len(self.items) == 0
