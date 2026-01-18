"""
Data models and schemas for the champion scraping system.
Defines clear data structures with validation.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import json


@dataclass
class ChampionAbility:
    """Represents a champion ability"""
    name: str
    type: str  # 'Passive', 'Q', 'W', 'E', 'R'
    cooldown: str
    cost: Optional[Dict[str, Any]] = None  # {'value': '55/65/75/85/95', 'resource': 'mana'}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = {
            'name': self.name,
            'type': self.type,
            'cooldown': self.cooldown
        }
        if self.cost:
            data['cost'] = self.cost
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ChampionAbility':
        """Create from dictionary"""
        return cls(
            name=data['name'],
            type=data['type'],
            cooldown=data['cooldown'],
            cost=data.get('cost')
        )


@dataclass
class RoleStats:
    """Statistics for a champion role"""
    win_rate: float
    pick_rate: float
    games: int
    tier: Optional[str] = None
    rank: Optional[int] = None
    ban_rate: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = {
            'win_rate': self.win_rate,
            'pick_rate': self.pick_rate,
            'games': self.games
        }
        if self.tier:
            data['tier'] = self.tier
        if self.rank:
            data['rank'] = self.rank
        if self.ban_rate is not None:
            data['ban_rate'] = self.ban_rate
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RoleStats':
        """Create from dictionary"""
        return cls(
            win_rate=data['win_rate'],
            pick_rate=data['pick_rate'],
            games=data['games'],
            tier=data.get('tier'),
            rank=data.get('rank'),
            ban_rate=data.get('ban_rate')
        )


@dataclass
class CounterMatchup:
    """Represents a counter matchup"""
    champion: str
    win_rate: float
    games: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = {
            'champion': self.champion,
            'win_rate': self.win_rate
        }
        if self.games:
            data['games'] = self.games
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CounterMatchup':
        """Create from dictionary"""
        return cls(
            champion=data['champion'],
            win_rate=data['win_rate'],
            games=data.get('games')
        )


@dataclass
class ChampionRole:
    """Data for a champion in a specific role"""
    stats: RoleStats
    counters: List[CounterMatchup] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'stats': self.stats.to_dict(),
            'counters': [counter.to_dict() for counter in self.counters]
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ChampionRole':
        """Create from dictionary"""
        return cls(
            stats=RoleStats.from_dict(data['stats']),
            counters=[CounterMatchup.from_dict(c) for c in data.get('counters', [])]
        )


@dataclass
class ChampionData:
    """Complete champion data structure"""
    id: str  # Internal key (e.g., "Aatrox")
    imageName: str  # Internal key for images
    name: str  # Display name (e.g., "Aatrox")
    abilities: List[ChampionAbility] = field(default_factory=list)
    roles: Dict[str, ChampionRole] = field(default_factory=dict)  # role_name -> role_data
    patch: Optional[str] = None
    tier: Optional[str] = None  # Legacy field
    lastUpdated: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'imageName': self.imageName,
            'name': self.name,
            'abilities': [ability.to_dict() for ability in self.abilities],
            'roles': {role: role_data.to_dict() for role, role_data in self.roles.items()}
        }

        if self.patch:
            data['patch'] = self.patch
        if self.tier:
            data['tier'] = self.tier
        if self.lastUpdated:
            data['lastUpdated'] = self.lastUpdated.isoformat()

        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ChampionData':
        """Create from dictionary"""
        # Handle legacy format compatibility
        roles = {}
        if 'roles' in data:
            roles = {role: ChampionRole.from_dict(role_data)
                    for role, role_data in data['roles'].items()}

        last_updated = None
        if 'lastUpdated' in data:
            if isinstance(data['lastUpdated'], str):
                last_updated = datetime.fromisoformat(data['lastUpdated'])
            else:
                last_updated = data['lastUpdated']

        return cls(
            id=data['id'],
            imageName=data['imageName'],
            name=data['name'],
            abilities=[ChampionAbility.from_dict(a) for a in data.get('abilities', [])],
            roles=roles,
            patch=data.get('patch'),
            tier=data.get('tier'),
            lastUpdated=last_updated
        )

    def merge_scraped_data(self, scraped_data: Dict[str, Any]) -> 'ChampionData':
        """Merge newly scraped data into existing champion data"""
        # Update abilities if provided
        if 'abilities' in scraped_data:
            self.abilities = [ChampionAbility.from_dict(a) for a in scraped_data['abilities']]

        # Update roles if provided
        if 'roles' in scraped_data:
            for role_name, role_data in scraped_data['roles'].items():
                self.roles[role_name] = ChampionRole.from_dict(role_data)

        # Update metadata
        if 'patch' in scraped_data:
            self.patch = scraped_data['patch']
        if 'tier' in scraped_data:
            self.tier = scraped_data['tier']

        self.lastUpdated = datetime.utcnow()
        return self


@dataclass
class RoleContainer:
    """Container for role-based champion data"""
    champions: List[str] = field(default_factory=list)  # List of champion IDs
    count: int = 0
    lastUpdated: Optional[datetime] = None
    patch: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = {
            'champions': self.champions,
            'count': self.count
        }

        if self.lastUpdated:
            data['lastUpdated'] = self.lastUpdated.isoformat()
        if self.patch:
            data['patch'] = self.patch

        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RoleContainer':
        """Create from dictionary"""
        last_updated = None
        if 'lastUpdated' in data:
            if isinstance(data['lastUpdated'], str):
                last_updated = datetime.fromisoformat(data['lastUpdated'])
            else:
                last_updated = data['lastUpdated']

        return cls(
            champions=data.get('champions', []),
            count=data.get('count', len(data.get('champions', []))),
            lastUpdated=last_updated,
            patch=data.get('patch')
        )

    def add_champion(self, champion_id: str):
        """Add champion to role container"""
        if champion_id not in self.champions:
            self.champions.append(champion_id)
            self.count = len(self.champions)
            self.lastUpdated = datetime.utcnow()

    def sort_by_pickrate(self, champion_data: Dict[str, ChampionData]):
        """Sort champions by pick rate in this role"""
        def get_pickrate(champ_id: str) -> float:
            if champ_id in champion_data and self.role_name in champion_data[champ_id].roles:
                return champion_data[champ_id].roles[self.role_name].stats.pick_rate
            return 0.0

        self.champions.sort(key=get_pickrate, reverse=True)


@dataclass
class ScrapingResult:
    """Result of a scraping operation"""
    champion: str
    success: bool
    data: Optional[ChampionData] = None
    error: Optional[str] = None
    scraped_at: Optional[datetime] = None

    def __post_init__(self):
        if self.scraped_at is None:
            self.scraped_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = {
            'champion': self.champion,
            'success': self.success,
            'scraped_at': self.scraped_at.isoformat()
        }

        if self.data:
            data['data'] = self.data.to_dict()
        if self.error:
            data['error'] = self.error

        return data


# Validation functions
def validate_champion_data(data: Dict[str, Any]) -> bool:
    """Validate champion data structure and statistical ranges"""
    required_fields = ['id', 'imageName', 'name']
    for field in required_fields:
        if field not in data:
            return False

    # Validate abilities
    if 'abilities' in data:
        for ability in data['abilities']:
            if not isinstance(ability, dict) or 'name' not in ability or 'type' not in ability:
                return False

    # Validate roles and their statistics
    if 'roles' in data:
        for role_name, role_data in data['roles'].items():
            if not isinstance(role_data, dict) or 'stats' not in role_data:
                return False
            stats = role_data['stats']
            # Use the dedicated role stats validator
            if not validate_role_stats(stats):
                return False

    return True


def validate_role_stats(stats: Dict[str, Any]) -> bool:
    """Validate role statistics"""
    required_fields = ['win_rate', 'pick_rate', 'games']
    for field in required_fields:
        if field not in stats:
            return False

    # Validate ranges
    if not (0 <= stats['win_rate'] <= 100):
        return False
    if not (0 <= stats['pick_rate'] <= 100):
        return False
    if stats['games'] < 0:
        return False

    return True
