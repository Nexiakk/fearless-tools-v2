import os
import json
import time
from lolalytics_build_scraper import LolalyticsBuildScraper
from wiki_scraper import scrape_champion_abilities
from datetime import datetime

# Firebase will be initialized only when needed
firebase_initialized = False
db = None

# Simple in-memory cache for Riot API data
riot_cache = {}

def init_firebase():
    """Initialize Firebase if not already done"""
    global firebase_initialized, db
    if not firebase_initialized:
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH', 'firebase-key.json')
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            firebase_initialized = True
        except Exception as e:
            print(f"Firebase initialization failed: {e}")
            return False
    return firebase_initialized

def scrape_and_store_data():
    """Main function to scrape data and store in Firebase"""
    print("Starting data scraping...")

    # Get current patch for all scraping operations
    current_patch = get_current_patch()
    print(f"Using current patch: {current_patch}")

    champions = get_champion_list()

    # Process each champion
    for champion in champions:
        try:
            print(f"\n=== Processing {champion} ===")

            # Scrape League Wiki abilities data
            print(f"Scraping wiki abilities for {champion}...")
            abilities_data = scrape_champion_abilities(champion)
            print(f"Found {len(abilities_data)} abilities")

            # Scrape Lolalytics build data with current patch
            print(f"Scraping lolalytics data for {champion} (patch {current_patch})...")
            lolalytics_scraper = LolalyticsBuildScraper()
            build_data = lolalytics_scraper.scrape_champion_build(champion.lower(), patch=current_patch)

            # Combine the data
            combined_data = {
                'name': champion,
                'abilities': abilities_data,
                'lastUpdated': datetime.utcnow()
            }

            # Add lolalytics data if available (flattened structure)
            if build_data:
                combined_data.update(build_data)
                print(f"Combined data: {len(build_data.get('roles', {}))} roles")
            else:
                print("No build data available")

            # Store combined data
            store_combined_champion_data(champion.lower(), combined_data)
            print(f"✅ Successfully stored data for {champion}")

        except Exception as e:
            print(f"❌ Error processing {champion}: {e}")
            import traceback
            traceback.print_exc()

    # Update role containers for optimized queries
    print("\n🔄 Updating role containers...")
    update_role_containers()

    # Clean up old patch data to save space
    print("\n🧹 Cleaning up old patch data...")
    cleanup_old_patch_data()

    print("\n🎉 Data scraping, optimization, and cleanup completed!")

class SmartUpdateEngine:
    """Intelligent update system for champion data"""

    def __init__(self):
        self.tier_thresholds = {
            'S': {'min_percent': 0.4, 'min_absolute': 15000},  # 40% of old or 15K
            'A': {'min_percent': 0.5, 'min_absolute': 10000},  # 50% of old or 10K
            'B': {'min_percent': 0.6, 'min_absolute': 7500},   # 60% of old or 7.5K
            'C': {'min_percent': 0.7, 'min_absolute': 5000},   # 70% of old or 5K
        }

    def calculate_champion_tier(self, total_games):
        """Categorize champion by historical play rate"""
        if total_games >= 150000:
            return 'S'
        elif total_games >= 75000:
            return 'A'
        elif total_games >= 25000:
            return 'B'
        else:
            return 'C'

    def calculate_adaptive_threshold(self, old_total_games):
        """Calculate switching threshold based on champion's tier"""
        tier = self.calculate_champion_tier(old_total_games)
        config = self.tier_thresholds[tier]

        return max(
            old_total_games * config['min_percent'],
            config['min_absolute']
        )

    def should_update_champion(self, current_data, new_data):
        """Master decision engine for champion updates"""

        # Handle patch changes vs same patch differently
        if new_data.get('patch') != current_data.get('patch'):
            return self._handle_patch_change(current_data, new_data)
        else:
            return self._handle_same_patch(current_data, new_data)

    def _handle_patch_change(self, current, new):
        """New patch: check if new data meets adaptive threshold"""
        old_games = self._calculate_total_games(current)
        new_games = self._calculate_total_games(new)

        if old_games == 0:  # No historical data
            threshold = self.tier_thresholds['C']['min_absolute']  # 5K minimum
        else:
            threshold = self.calculate_adaptive_threshold(old_games)

        tier = self.calculate_champion_tier(old_games)

        if new_games >= threshold:
            return {
                'update': True,
                'abilities': True,  # Always update abilities on patch change
                'lolalytics': True,
                'reason': f"New patch {new['patch']} ready: {new_games} ≥ {threshold} (tier {tier})"
            }
        else:
            return {
                'update': False,
                'reason': f"New patch {new['patch']} not ready: {new_games} < {threshold} (tier {tier})"
            }

    def _handle_same_patch(self, current, new):
        """Same patch: always update lolalytics (growing sample), check abilities"""
        abilities_changed = self._abilities_changed(
            current.get('abilities', []),
            new.get('abilities', [])
        )

        return {
            'update': True,  # Always update in same patch (lolalytics sample grows)
            'abilities': abilities_changed,
            'lolalytics': True,
            'reason': f"Same patch {current.get('patch')}: abilities={abilities_changed}, lolalytics=True"
        }

    def _calculate_total_games(self, data):
        """Sum games across all roles"""
        return sum(
            role_data.get('stats', {}).get('games', 0)
            for role_data in data.get('roles', {}).values()
        )

    def _abilities_changed(self, old_abilities, new_abilities):
        """Check if abilities actually changed"""
        if len(old_abilities) != len(new_abilities):
            return True

        # Compare each ability
        for old, new in zip(old_abilities, new_abilities):
            if (old.get('name') != new.get('name') or
                old.get('cooldown') != new.get('cooldown') or
                old.get('type') != new.get('type')):
                return True

        return False

    def get_viable_roles(self, scraped_data, historical_roles=None):
        """Get all roles that should be stored (current + historical + emerging)"""
        viable_roles = set()

        # Add current viable roles (≥9% playrate)
        for role_name, role_data in scraped_data.get('roles', {}).items():
            pick_rate = role_data.get('stats', {}).get('pick_rate', 0)
            games = role_data.get('stats', {}).get('games', 0)

            # Include if: ≥9% OR (≥3% + ≥2000 games) for emerging roles
            if pick_rate >= 9.0 or (pick_rate >= 3.0 and games >= 2000):
                viable_roles.add(role_name)

        # Add historically viable roles
        if historical_roles:
            viable_roles.update(historical_roles)

        return list(viable_roles)

def test_data_integration():
    """Test the data integration with smart updates"""
    print("🧪 Testing data integration with smart updates...")

    champion = "Aatrox"
    update_engine = SmartUpdateEngine()

    try:
        print(f"\n=== Testing {champion} Integration ===")

        # Scrape League Wiki abilities data
        print("Scraping wiki abilities...")
        abilities_data = scrape_champion_abilities(champion)
        print(f"✅ Found {len(abilities_data)} abilities")

        # Scrape Lolalytics build data
        print("Scraping lolalytics data...")
        lolalytics_scraper = LolalyticsBuildScraper()
        build_data = lolalytics_scraper.scrape_champion_build(champion.lower())

        # Simulate current data (what would be in database)
        current_data = {
            'name': champion,
            'abilities': abilities_data,  # Same abilities for testing
            'patch': '15.23',  # Simulate old patch
            'tier': 'diamond_plus',
            'roles': {
                'top': {'stats': {'games': 95000, 'pick_rate': 45.0}},
                'jungle': {'stats': {'games': 75000, 'pick_rate': 38.0}}
            }
        }

        # Decide what to update
        update_decision = update_engine.should_update_champion(current_data, build_data)

        print(f"\n📊 Update Decision: {update_decision}")

        # Apply selective updates
        final_data = current_data.copy()  # Start with current

        if update_decision['abilities']:
            final_data['abilities'] = abilities_data

        if update_decision['lolalytics']:
            # Update with new build data
            final_data.update(build_data)
            # Filter to viable roles only
            viable_roles = update_engine.get_viable_roles(build_data)
            final_data['roles'] = {
                role: final_data['roles'][role]
                for role in viable_roles
                if role in final_data['roles']
            }

        # Show results
        print("\n📈 Final Data Summary:")
        print(f"  - Abilities: {len(final_data.get('abilities', []))} abilities")
        print(f"  - Patch: {final_data.get('patch')} (was {current_data.get('patch')})")
        print(f"  - Roles: {list(final_data.get('roles', {}).keys())}")
        print(f"  - Total Games: {update_engine._calculate_total_games(final_data)}")

        champion_tier = update_engine.calculate_champion_tier(
            update_engine._calculate_total_games(current_data)
        )
        threshold = update_engine.calculate_adaptive_threshold(
            update_engine._calculate_total_games(current_data)
        )
        print(f"  - Champion Tier: {champion_tier} (threshold: {threshold})")

        print("\n✅ Smart integration test successful!")
        return final_data, update_decision

    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def store_combined_champion_data(champion_key: str, data: dict):
    """Store combined champion data in Firebase"""
    if not init_firebase():
        raise Exception("Firebase not available")
    doc_ref = db.collection('champions').document(f'all/{champion_key}')
    doc_ref.set(data)

def update_role_containers():
    """Create optimized role container indexes for Firebase free tier"""
    if not init_firebase():
        print("Firebase not available, skipping role container update")
        return

    print("Updating role containers for optimized Firebase queries...")

    try:
        # Get all champions
        champions_ref = db.collection('champions').document('all').collection('all')
        champions = champions_ref.stream()

        role_champions = {
            'top': [],
            'jungle': [],
            'mid': [],
            'adc': [],
            'support': []
        }

        for champ_doc in champions:
            champ_data = champ_doc.to_dict()

            # Check which roles this champion plays
            roles = champ_data.get('roles', {})
            for role in roles:
                if role in role_champions:
                    role_champions[role].append({
                        'id': champ_doc.id,
                        'name': champ_data.get('name', ''),
                        'pickRate': roles[role].get('stats', {}).get('pick_rate', 0)
                    })

        # Sort champions by pick rate (highest first) and limit if needed
        for role in role_champions:
            role_champions[role].sort(key=lambda x: x['pickRate'], reverse=True)
            # Keep all champions for now - Firebase can handle it
            # Could limit to top N if storage becomes an issue

        # Store role containers
        roles_ref = db.collection('roles')
        current_patch = None

        for role, champions_list in role_champions.items():
            # Extract just champion IDs for lightweight queries
            champion_ids = [champ['id'] for champ in champions_list]

            # Get current patch from first champion if available
            if not current_patch and champions_list:
                first_champ_data = db.collection('champions').document(f'all/{champions_list[0]["id"]}').get()
                if first_champ_data.exists:
                    current_patch = first_champ_data.to_dict().get('patch')

            role_doc = {
                'champions': champion_ids,  # Lightweight: just IDs
                'count': len(champion_ids),
                'lastUpdated': datetime.utcnow()
            }

            if current_patch:
                role_doc['patch'] = current_patch

            roles_ref.document(role).set(role_doc)
            print(f"✅ Updated {role}: {len(champion_ids)} champions")

        print(f"🎉 Role containers updated successfully!")

    except Exception as e:
        print(f"❌ Error updating role containers: {e}")
        import traceback
        traceback.print_exc()

def get_riot_versions():
    """Fetch and cache Riot API versions for automatic patch detection"""
    cache_key = "riot_versions"
    cached = riot_cache.get(cache_key)

    if cached and time.time() - cached['timestamp'] < 3600:  # 1 hour cache
        return cached['versions']

    try:
        print("Fetching Riot API versions...")
        response = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=10)
        response.raise_for_status()
        versions = response.json()

        # Cache the result
        riot_cache[cache_key] = {
            'versions': versions,
            'timestamp': time.time()
        }

        print(f"✅ Fetched {len(versions)} patch versions from Riot API")
        return versions

    except Exception as e:
        print(f"❌ Failed to fetch Riot versions: {e}")
        # Return cached version if available, otherwise empty list
        return cached['versions'] if cached else []

def get_previous_patch(current_patch):
    """Automatically find the previous patch using Riot API data"""
    versions = get_riot_versions()

    try:
        current_index = versions.index(current_patch)
        if current_index + 1 < len(versions):
            previous_patch = versions[current_index + 1]  # Next item is previous (list is newest first)
            print(f"✅ Detected previous patch: {current_patch} → {previous_patch}")
            return previous_patch
        else:
            print(f"⚠️ No previous patch found for {current_patch}")
    except ValueError:
        print(f"⚠️ Current patch {current_patch} not found in Riot versions")

    return None

def get_champion_fallback_data(champion_id, current_patch):
    """Get fallback data from automatically detected previous patch"""
    if not init_firebase():
        return None

    previous_patch = get_previous_patch(current_patch)
    if not previous_patch:
        return None

    try:
        # Look for archived data from previous patch
        fallback_doc = db.collection('champions') \
                        .document(f'all/{champion_id}') \
                        .collection('patch_history') \
                        .document(previous_patch) \
                        .get()

        if fallback_doc.exists:
            data = fallback_doc.to_dict()
            data['_fallback'] = True
            data['_fallback_patch'] = previous_patch
            data['_current_patch'] = current_patch
            print(f"✅ Found fallback data for {champion_id} from patch {previous_patch}")
            return data
        else:
            print(f"⚠️ No archived data found for {champion_id} in patch {previous_patch}")

    except Exception as e:
        print(f"❌ Error retrieving fallback data: {e}")

    return None

def cleanup_old_patch_data():
    """Clean up old patch data, keeping only current + 1 previous patch"""
    if not init_firebase():
        print("Firebase not available, skipping cleanup")
        return

    print("🧹 Cleaning up old patch data...")

    try:
        # Get current patch from a sample champion
        current_patch = None
        champions_ref = db.collection('champions')
        sample_champions = champions_ref.limit(1).get()

        for doc in sample_champions:
            current_patch = doc.to_dict().get('patch')
            break

        if not current_patch:
            print("⚠️ Could not determine current patch, skipping cleanup")
            return

        print(f"Current active patch: {current_patch}")

        # Collect all patch history data
        old_patches = []
        champions_stream = champions_ref.stream()

        for champ_doc in champions_stream:
            patch_history_ref = champ_doc.collection('patch_history')
            patches = patch_history_ref.list_documents()

            for patch_doc in patches:
                patch_version = patch_doc.id
                if patch_version != current_patch:
                    old_patches.append((champ_doc.id, patch_version, patch_doc))

        # Group by patch version
        patches_by_version = {}
        for champ_id, patch_version, doc_ref in old_patches:
            if patch_version not in patches_by_version:
                patches_by_version[patch_version] = []
            patches_by_version[patch_version].append(doc_ref)

        # Sort patches by version (newest first)
        sorted_patches = sorted(patches_by_version.keys(), reverse=True)

        # Keep only the most recent previous patch
        if len(sorted_patches) > 1:
            patches_to_delete = sorted_patches[1:]  # Everything except the newest

            total_deleted = 0
            for old_patch in patches_to_delete:
                print(f"🗑️ Deleting old patch data: {old_patch}")
                for doc_ref in patches_by_version[old_patch]:
                    doc_ref.delete()
                    total_deleted += 1

            print(f"✅ Cleanup complete: deleted {total_deleted} old patch documents")
        else:
            print("ℹ️ No old patch data to clean up")

    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()

def get_current_patch():
    """Get the current League of Legends patch version from Riot API"""
    try:
        versions_url = "https://ddragon.leagueoflegends.com/api/versions.json"
        versions_response = requests.get(versions_url, timeout=10)
        versions_response.raise_for_status()
        versions = versions_response.json()
        return versions[0]  # Latest version is first in the list
    except Exception as e:
        print(f"Error fetching current patch from Riot API: {e}")
        return "15.24"  # Fallback to known recent patch

def get_champion_list():
    """Get list of all champions from Riot Data Dragon API"""
    try:
        # Get latest version
        current_patch = get_current_patch()

        # Get champion data
        champions_url = f"https://ddragon.leagueoflegends.com/cdn/{current_patch}/data/en_US/champion.json"
        champions_response = requests.get(champions_url, timeout=10)
        champions_response.raise_for_status()
        champions_data = champions_response.json()

        # Return sorted list of champion names
        champion_names = list(champions_data['data'].keys())
        champion_names.sort()
        return champion_names

    except Exception as e:
        print(f"Error fetching champion list from Riot API: {e}")
        # Fallback to a smaller static list for testing
        return [
            'Aatrox', 'Ahri', 'Akali', 'Ashe', 'Jinx', 'Lux', 'Miss Fortune', 'Vayne', 'Yuumi',
            'Yasuo', 'Zed', 'Kaisa', 'Caitlyn', 'Ezreal', 'Varus'
        ]

if __name__ == "__main__":
    # Test the integration first
    test_result = test_data_integration()

    # Uncomment to run full scraping with Firebase
    # scrape_and_store_data()
