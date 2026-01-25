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
class TeamData:
    """Champion data for one team (blue or red side)"""
    picks: List[str] = field(default_factory=list)  # Champion names in cell order (0-4)
    bans: List[str] = field(default_factory=list)   # Champion names in ban order
    picks_ordered: List[Dict[str, Any]] = field(default_factory=list)  # [{"championId": name, "order": num}]
    bans_ordered: List[Dict[str, Any]] = field(default_factory=list)   # [{"championId": name, "order": num}]


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
                "picks_ordered": self.blue_side.picks_ordered,
                "bans_ordered": self.blue_side.bans_ordered
            },
            "red_side": {
                "picks": self.red_side.picks,
                "bans": self.red_side.bans,
                "picks_ordered": self.red_side.picks_ordered,
                "bans_ordered": self.red_side.bans_ordered
            },
            "dataHash": self.data_hash
        }


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
