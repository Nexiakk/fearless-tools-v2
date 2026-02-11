"""
Champion ID to name mapping using Riot API data.
"""

import os
import json
import time
import logging
from typing import Dict, Optional, List, Any
from datetime import datetime, timedelta

import requests

try:
    from .models import DraftData, TeamData
except ImportError:
    from models import DraftData, TeamData

logger = logging.getLogger(__name__)


class ChampionMapper:
    """Handles champion ID to name mapping with caching"""

    RIOT_API_BASE = "https://ddragon.leagueoflegends.com"
    CHAMPION_DATA_URL = f"{RIOT_API_BASE}/cdn/{{version}}/data/en_US/champion.json"

    def __init__(self, cache_duration_hours: int = 24):
        self.champion_map: Dict[int, str] = {}  # id -> name
        self.reverse_map: Dict[str, int] = {}  # name -> id
        self.last_updated: Optional[datetime] = None
        self.cache_duration = timedelta(hours=cache_duration_hours)
        self.current_version: Optional[str] = None

    def _is_cache_valid(self) -> bool:
        """Check if cached data is still valid"""
        if not self.last_updated or not self.champion_map:
            return False
        return datetime.now() - self.last_updated < self.cache_duration

    def _get_latest_version(self) -> str:
        """Get the latest Riot API version"""
        try:
            response = requests.get(f"{self.RIOT_API_BASE}/api/versions.json", timeout=10)
            response.raise_for_status()
            versions = response.json()
            return versions[0]  # Latest version
        except Exception as e:
            logger.warning(f"Failed to get latest version: {e}")
            return "15.5.1"  # Fallback version

    def _load_champion_data(self, version: str) -> bool:
        """Load champion data from Riot API"""
        try:
            url = self.CHAMPION_DATA_URL.format(version=version)
            response = requests.get(url, timeout=15)
            response.raise_for_status()

            data = response.json()
            champions = data.get('data', {})

            # Clear existing maps
            self.champion_map.clear()
            self.reverse_map.clear()

            # Build mappings
            for champ_key, champ_data in champions.items():
                try:
                    champ_id = int(champ_data['key'])
                    champ_name = champ_data['id']

                    self.champion_map[champ_id] = champ_name
                    self.reverse_map[champ_name] = champ_id

                except (ValueError, KeyError) as e:
                    logger.warning(f"Invalid champion data for {champ_key}: {e}")
                    continue

            self.last_updated = datetime.now()
            self.current_version = version

            logger.info(f"Loaded {len(self.champion_map)} champions from Riot API v{version}")
            return True

        except Exception as e:
            logger.error(f"Failed to load champion data: {e}")
            return False

    def _ensure_data_loaded(self) -> bool:
        """Ensure champion data is loaded and fresh"""
        if self._is_cache_valid():
            return True

        # Try to load latest version
        version = self._get_latest_version()
        if self._load_champion_data(version):
            return True

        # If that fails and we have stale data, use it
        if self.champion_map:
            logger.warning("Using stale champion data due to API failure")
            return True

        return False

    def get_champion_name(self, champion_id: int) -> Optional[str]:
        """Get champion name by ID"""
        if not self._ensure_data_loaded():
            return None

        return self.champion_map.get(champion_id)

    def get_champion_id(self, champion_name: str) -> Optional[int]:
        """Get champion ID by name"""
        if not self._ensure_data_loaded():
            return None

        return self.reverse_map.get(champion_name)

    def map_champion_ids_to_names(self, champion_ids: List[int]) -> List[str]:
        """Convert a list of champion IDs to names"""
        if not self._ensure_data_loaded():
            return []

        names = []
        for champ_id in champion_ids:
            if isinstance(champ_id, str):
                try:
                    champ_id = int(champ_id)
                except ValueError:
                    continue

            name = self.get_champion_name(champ_id)
            if name:
                names.append(name)

        return names

    def map_champion_names_to_ids(self, champion_names: List[str]) -> List[int]:
        """Convert a list of champion names to IDs"""
        if not self._ensure_data_loaded():
            return []

        ids = []
        for name in champion_names:
            champ_id = self.get_champion_id(name)
            if champ_id is not None:
                ids.append(champ_id)

        return ids

    def update_draft_with_names(self, draft: DraftData) -> bool:
        """Update a draft object to use champion names instead of IDs"""
        try:
            # Update blue side
            if draft.blue_side:
                # Convert picks
                pick_ids = [int(pid) for pid in draft.blue_side.picks if pid and pid != '0']
                draft.blue_side.picks = self.map_champion_ids_to_names(pick_ids)

                # Convert bans
                ban_ids = [int(bid) for bid in draft.blue_side.bans if bid and bid != '0']
                draft.blue_side.bans = self.map_champion_ids_to_names(ban_ids)

                # Update pick events with champion names
                for event in draft.blue_side.pick_events:
                    if event.champion_id:
                        try:
                            champ_id = int(event.champion_id)
                            name = self.get_champion_name(champ_id)
                            if name:
                                event.champion_id = name
                        except (ValueError, TypeError):
                            pass

                # Update ban events with champion names
                for event in draft.blue_side.ban_events:
                    if event.champion_id:
                        try:
                            champ_id = int(event.champion_id)
                            name = self.get_champion_name(champ_id)
                            if name:
                                event.champion_id = name
                        except (ValueError, TypeError):
                            pass

            # Update red side
            if draft.red_side:
                # Convert picks
                pick_ids = [int(pid) for pid in draft.red_side.picks if pid and pid != '0']
                draft.red_side.picks = self.map_champion_ids_to_names(pick_ids)

                # Convert bans
                ban_ids = [int(bid) for bid in draft.red_side.bans if bid and bid != '0']
                draft.red_side.bans = self.map_champion_ids_to_names(ban_ids)

                # Update pick events with champion names
                for event in draft.red_side.pick_events:
                    if event.champion_id:
                        try:
                            champ_id = int(event.champion_id)
                            name = self.get_champion_name(champ_id)
                            if name:
                                event.champion_id = name
                        except (ValueError, TypeError):
                            pass

                # Update ban events with champion names
                for event in draft.red_side.ban_events:
                    if event.champion_id:
                        try:
                            champ_id = int(event.champion_id)
                            name = self.get_champion_name(champ_id)
                            if name:
                                event.champion_id = name
                        except (ValueError, TypeError):
                            pass

            return True

        except Exception as e:
            logger.error(f"Failed to update draft with champion names: {e}")
            return False

    def get_all_champions(self) -> Dict[int, str]:
        """Get all champions as ID -> name mapping"""
        if not self._ensure_data_loaded():
            return {}
        return self.champion_map.copy()

    def get_champion_count(self) -> int:
        """Get total number of champions loaded"""
        return len(self.champion_map)


# Global instance
_champion_mapper = ChampionMapper()

def get_champion_mapper() -> ChampionMapper:
    """Get the global champion mapper instance"""
    return _champion_mapper
