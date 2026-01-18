"""
Service classes for the champion scraping system.
Breaks down the monolithic scraping function into focused, testable services.
"""

import time
import random
from typing import Dict, List, Optional, Tuple
from datetime import datetime

from .utils import (
    RiotAPIClient, ChampionNameMapper, PatchManager,
    get_display_name, get_champion_id, get_champion_image_name,
    get_champion_list, normalize_patch_for_lolalytics
)
from .firebase_utils import FirebaseManager
from .logging_utils import get_logger, log_scraping_start, log_scraping_success, log_scraping_error, log_rate_limiting
from .config import get_config
from .models import ChampionData, ScrapingResult, ChampionAbility, ChampionRole, RoleStats, CounterMatchup
from .lolalytics_build_scraper import LolalyticsBuildScraper
from .wiki_scraper import scrape_champion_abilities


class ChampionScraper:
    """Service for scraping champion data from external sources"""

    def __init__(self, config=None):
        self.config = config or get_config()
        self.logger = get_logger(__name__)
        self.lolalytics_scraper = LolalyticsBuildScraper()

    def scrape_champion_data(self, champion_internal: str, target_patch: str) -> Dict:
        """Scrape all data for a single champion"""
        log_scraping_start(champion_internal, "champion data scraping")

        try:
            # Get champion display name
            champion_display = get_display_name(champion_internal)

            # Scrape League Wiki abilities data
            abilities_data = scrape_champion_abilities(champion_display)

            # Scrape Lolalytics build data
            normalized_patch = normalize_patch_for_lolalytics(target_patch)
            build_data = self.lolalytics_scraper.scrape_champion_build(
                champion_internal,
                patch=normalized_patch
            )

            # Get champion metadata
            champion_id = get_champion_id(champion_internal)
            champion_image_name = get_champion_image_name(champion_internal)

            # Combine the data
            combined_data = {
                'id': champion_internal,
                'imageName': champion_image_name,
                'name': champion_display,
                'abilities': abilities_data,
                'patch': target_patch,
                'lastUpdated': datetime.utcnow()
            }

            # Add lolalytics data if available
            if build_data:
                # Remove tier field since it's always diamond_plus
                build_data.pop('tier', None)
                combined_data.update(build_data)

            log_scraping_success(champion_internal, "champion data scraping",
                               f"{len(abilities_data)} abilities, {len(build_data.get('roles', {})) if build_data else 0} roles")
            return combined_data

        except Exception as e:
            log_scraping_error(champion_internal, "champion data scraping", e)
            raise


class DataProcessor:
    """Service for processing and validating scraped data"""

    def __init__(self, config=None):
        self.config = config or get_config()
        self.logger = get_logger(__name__)

    def process_champion_data(self, raw_data: Dict) -> ChampionData:
        """Process raw scraped data into validated ChampionData model"""
        try:
            # Convert abilities
            abilities = []
            for ability_data in raw_data.get('abilities', []):
                ability = ChampionAbility(
                    name=ability_data.get('name', ''),
                    type=ability_data.get('type', ''),
                    cooldown=ability_data.get('cooldown', ''),
                    cost=ability_data.get('cost')
                )
                abilities.append(ability)

            # Convert roles
            roles = {}
            for role_name, role_data in raw_data.get('roles', {}).items():
                # Convert stats
                stats_data = role_data.get('stats', {})
                stats = RoleStats(
                    win_rate=stats_data.get('win_rate', 0.0),
                    pick_rate=stats_data.get('pick_rate', 0.0),
                    games=stats_data.get('games', 0),
                    tier=stats_data.get('tier'),
                    rank=stats_data.get('rank'),
                    ban_rate=stats_data.get('ban_rate')
                )

                # Convert counters
                counters = []
                for counter_data in role_data.get('counters', []):
                    counter = CounterMatchup(
                        champion=counter_data.get('champion', ''),
                        win_rate=counter_data.get('win_rate', 0.0),
                        games=counter_data.get('games')
                    )
                    counters.append(counter)

                roles[role_name] = ChampionRole(stats=stats, counters=counters)

            # Create ChampionData object
            champion_data = ChampionData(
                id=raw_data['id'],
                imageName=raw_data['imageName'],
                name=raw_data['name'],
                abilities=abilities,
                roles=roles,
                patch=raw_data.get('patch'),
                lastUpdated=raw_data.get('lastUpdated')
            )

            return champion_data

        except Exception as e:
            self.logger.error(f"Error processing champion data for {raw_data.get('id', 'unknown')}: {e}")
            raise

    def should_update_champion(self, current_data: Optional[Dict], new_data: Dict) -> Dict:
        """Determine if and how a champion should be updated"""
        # Always update on patch changes
        if new_data.get('patch') != current_data.get('patch') if current_data else True:
            return {
                'update': True,
                'abilities': True,
                'lolalytics': True,
                'reason': f"Patch changed to {new_data['patch']}"
            }

        # Same patch: Only update if abilities changed
        current_abilities = current_data.get('abilities', []) if current_data else []
        new_abilities = new_data.get('abilities', [])

        abilities_changed = self._abilities_changed(current_abilities, new_abilities)

        return {
            'update': abilities_changed,
            'abilities': abilities_changed,
            'lolalytics': True,  # Always update lolalytics (growing sample)
            'reason': f"Same patch: abilities={abilities_changed}, lolalytics=True"
        }

    def _abilities_changed(self, old_abilities: List[Dict], new_abilities: List[Dict]) -> bool:
        """Check if abilities have changed"""
        if len(old_abilities) != len(new_abilities):
            return True

        # Compare each ability
        for old, new in zip(old_abilities, new_abilities):
            if (old.get('name') != new.get('name') or
                old.get('cooldown') != new.get('cooldown') or
                old.get('type') != new.get('type')):
                return True

        return False


class StorageService:
    """Service for storing champion data in Firebase"""

    def __init__(self, firebase_manager: FirebaseManager, config=None):
        self.firebase = firebase_manager
        self.config = config or get_config()
        self.logger = get_logger(__name__)

    def get_champion_data(self, champion_key: str) -> Optional[Dict]:
        """Get champion data from storage"""
        return self.firebase.get_champion_data(champion_key)

    def store_champion_data(self, champion_key: str, data: Dict) -> bool:
        """Store champion data"""
        return self.firebase.store_champion_data(champion_key, data)

    def update_role_containers(self, role_data: Dict) -> bool:
        """Update role container data"""
        return self.firebase.update_role_containers(role_data)

    def cleanup_old_patches(self, current_patch: str) -> int:
        """Clean up old patch data"""
        return self.firebase.cleanup_old_patches(current_patch)


class ScrapingOrchestrator:
    """Orchestrates the entire champion scraping process"""

    def __init__(self, config=None):
        self.config = config or get_config()
        self.logger = get_logger(__name__)

        # Initialize services
        firebase_config = self.config.firebase
        self.firebase_manager = FirebaseManager(firebase_config)
        self.firebase_available = self.firebase_manager.initialize()

        if not self.firebase_available:
            self.logger.warning("Firebase not available - running in offline mode")

        self.scraper = ChampionScraper(self.config)
        self.processor = DataProcessor(self.config)
        self.storage = StorageService(self.firebase_manager, self.config) if self.firebase_available else None

    def scrape_and_store_champion(self, champion: str, target_patch: str) -> ScrapingResult:
        """Scrape and store data for a single champion"""
        try:
            # Scrape data
            raw_data = self.scraper.scrape_champion_data(champion, target_patch)

            # Process data
            processed_data = self.processor.process_champion_data(raw_data)

            # Get current data for smart updates
            current_data = self.storage.get_champion_data(champion)

            # Determine update strategy
            update_decision = self.processor.should_update_champion(current_data, raw_data)

            # Apply selective updates
            if update_decision['update']:
                final_data = self._apply_selective_updates(current_data or {}, raw_data, update_decision)

                # Store the data
                success = self.storage.store_champion_data(champion, final_data)
                if not success:
                    raise Exception(f"Failed to store data for {champion}")

                self.logger.info(f"✅ Successfully updated data for {champion}")
            else:
                self.logger.info(f"⏭️ Skipping update for {champion}")

            # Rate limiting
            self._apply_rate_limiting()

            return ScrapingResult(
                champion=champion,
                success=True,
                data=processed_data if update_decision['update'] else None
            )

        except Exception as e:
            self.logger.error(f"❌ Error processing {champion}: {e}")
            return ScrapingResult(
                champion=champion,
                success=False,
                error=str(e)
            )

    def update_role_containers(self):
        """Update role containers for optimized queries"""
        self.logger.info("Updating role containers for optimized queries...")

        try:
            # Get all champion data
            all_champions = {}
            champions_list = get_champion_list()

            for champion_key in champions_list:
                data = self.storage.get_champion_data(champion_key)
                if data:
                    all_champions[champion_key] = data

            # Build role containers
            role_champions = {
                'top': [],
                'jungle': [],
                'middle': [],
                'bottom': [],
                'support': []
            }

            for champion_key, champ_data in all_champions.items():
                roles = champ_data.get('roles', {})
                for role in roles:
                    if role in role_champions:
                        role_champions[role].append({
                            'id': champion_key,
                            'name': champ_data.get('name', ''),
                            'pickRate': roles[role].get('stats', {}).get('pick_rate', 0)
                        })

            # Sort by pick rate
            for role in role_champions:
                role_champions[role].sort(key=lambda x: x['pickRate'], reverse=True)

            # Extract just champion IDs for storage
            role_data = {
                'roles': {role: [champ['id'] for champ in champions]
                         for role, champions in role_champions.items()},
                'lastUpdated': datetime.utcnow()
            }

            # Get current patch from first champion if available
            if all_champions:
                first_champion = next(iter(all_champions.values()))
                current_patch = first_champion.get('patch')
                if current_patch:
                    role_data['patch'] = current_patch

            # Store role data
            self.storage.update_role_containers(role_data)
            total_champions = sum(len(champs) for champs in role_champions.values())
            self.logger.info(f"✅ Updated role data: {total_champions} total champions")

        except Exception as e:
            self.logger.error(f"❌ Error updating role containers: {e}")

    def _apply_selective_updates(self, current_data: Dict, new_data: Dict, update_decision: Dict) -> Dict:
        """Apply selective updates based on decision"""
        final_data = current_data.copy() if current_data else {}

        if update_decision['abilities']:
            final_data['abilities'] = new_data.get('abilities', [])

        if update_decision['lolalytics']:
            lolalytics_fields = ['patch', 'roles']
            for field in lolalytics_fields:
                if field in new_data:
                    final_data[field] = new_data[field]

        final_data['lastUpdated'] = datetime.utcnow()
        return final_data

    def _apply_rate_limiting(self):
        """Apply rate limiting between requests"""
        delay = random.uniform(
            self.config.scraping.rate_limit_delay,
            self.config.scraping.rate_limit_delay * 2
        )
        log_rate_limiting(delay)
        time.sleep(delay)
