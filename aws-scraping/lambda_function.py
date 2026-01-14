import os
import json
import time
import random
import requests
from scraper.lolalytics_build_scraper import LolalyticsBuildScraper
from scraper.wiki_scraper import scrape_champion_abilities
from scraper.main import check_patch_viability, normalize_patch_for_lolalytics, get_display_name, get_simplified_key, get_champion_id, get_champion_image_name, encode_champion_name_for_wiki, encode_champion_name_for_lolalytics
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Initialize Firebase (only once per container)
if not firebase_admin._apps:
    # For GitHub Actions / serverless environments, credentials from environment variable
    cred_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
    if cred_json:
        cred = credentials.Certificate(json.loads(cred_json))
    else:
        # Fallback for local testing - use firebase-key.json in current directory
        cred_path = 'firebase-key.json'
        cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Simple in-memory cache for Riot API data
riot_cache = {}

def lambda_handler(event, context):
    """AWS Lambda handler function (kept for compatibility)"""
    try:
        scrape_and_store_data()
        return {
            'statusCode': 200,
            'body': json.dumps('Data scraping completed successfully')
        }
    except Exception as e:
        print(f"Error in lambda_handler: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }

def scrape_and_store_data():
    """Main function to scrape data and store in Firebase using smart update system"""
    print("Starting data scraping with smart updates...")

    # Get current patch and check viability
    try:
        versions_url = "https://ddragon.leagueoflegends.com/api/versions.json"
        versions_response = requests.get(versions_url, timeout=10)
        versions_response.raise_for_status()
        versions = versions_response.json()
        current_patch = versions[0]
    except Exception as e:
        print(f"Error fetching current patch: {e}")
        current_patch = "15.24"  # Fallback

    print(f"Current patch: {current_patch}")

    # Check if current patch has sufficient sample size
    use_current, target_patch, viability_metrics = check_patch_viability(current_patch)

    if use_current:
        print(f"✅ Using current patch {current_patch} for scraping")
    else:
        print(f"⚠️ Current patch {current_patch} has insufficient data")
        print(f"🔄 Falling back to patch {target_patch}")

    champions = get_champion_list()
    update_engine = SmartUpdateEngine()

    # Process each champion
    for i, champion in enumerate(champions):
        try:
            # Get champion display name using unified name mapping
            champion_display = get_display_name(champion)

            print(f"\n=== Processing {champion} (display: {champion_display}) ({i+1}/{len(champions)}) ===")

            # Scrape League Wiki abilities data using display name
            print(f"Scraping wiki abilities for {champion_display}...")
            abilities_data = scrape_champion_abilities(champion_display)
            print(f"Found {len(abilities_data)} abilities")

            # Scrape Lolalytics build data using internal champion key (not display name)
            print(f"Scraping lolalytics data for {champion_display} (patch {target_patch})...")
            lolalytics_scraper = LolalyticsBuildScraper()
            normalized_patch = normalize_patch_for_lolalytics(target_patch)
            build_data = lolalytics_scraper.scrape_champion_build(champion, patch=normalized_patch)

            # Get champion metadata
            champion_id = get_champion_id(champion)
            champion_image_name = get_champion_image_name(champion)

            # Combine the data with new structure
            new_data = {
                'id': champion,                 # Internal champion name (like "KSante")
                'imageName': champion_image_name, # Internal key for images
                'name': champion_display,       # Display name
                'abilities': abilities_data
            }

            # Add lolalytics data if available (flattened structure)
            if build_data:
                new_data.update(build_data)
                print(f"Combined data: {len(build_data.get('roles', {}))} roles")
            else:
                print("No build data available")

            # Get current data from Firebase for smart updates
            current_data = get_current_champion_data(champion.lower())

            # Apply smart update logic
            update_decision = update_engine.should_update_champion(current_data, new_data)

            print(f"📊 Update Decision: {update_decision}")

            # Apply selective updates
            if update_decision['update']:
                store_combined_champion_data_smart(champion, current_data, new_data, update_decision)
                print(f"✅ Successfully updated data for {champion}")
            else:
                print(f"⏭️ Skipping update for {champion}")

            # Rate limiting: wait 1-3 seconds between requests to be respectful
            if i < len(champions) - 1:  # Don't wait after last request
                wait_time = random.uniform(1, 3)
                time.sleep(wait_time)

        except Exception as e:
            print(f"❌ Error processing {champion}: {e}")
            import traceback
            traceback.print_exc()

    # Update role containers for optimized queries
    print("\n🔄 Updating role containers...")
    update_role_containers()

    # Clean up old patch data only if we switched patches
    if target_patch != current_patch:
        print("\n🧹 Patch changed - cleaning up old patch data...")
        cleanup_old_patch_data()
    else:
        print("\n⏭️ Same patch - skipping cleanup")

    print("\n🎉 Data scraping, optimization, and cleanup completed!")

class SmartUpdateEngine:
    """Simplified update system - patch viability already checked globally"""

    def should_update_champion(self, current_data, new_data):
        """Simplified: Patch viability already checked globally"""

        # Always update on patch changes (patch already validated globally as ready)
        if new_data.get('patch') != current_data.get('patch'):
            return {
                'update': True,
                'abilities': True,
                'lolalytics': True,
                'reason': f"Patch changed to {new_data['patch']} (validated globally)"
            }

        # Same patch: Only update if abilities changed
        else:
            abilities_changed = self._abilities_changed(
                current_data.get('abilities', []),
                new_data.get('abilities', [])
            )
            return {
                'update': abilities_changed,  # Only if abilities changed
                'abilities': abilities_changed,
                'lolalytics': True,  # Always update (growing sample)
                'reason': f"Same patch: abilities={abilities_changed}, lolalytics=True"
            }

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
        """Get all roles that should be stored - simplified since we only scrape ≥9% roles"""
        viable_roles = set()

        # All scraped roles are already ≥9% pickrate, so just return them
        viable_roles.update(scraped_data.get('roles', {}).keys())

        # Add historically viable roles (if any exist from before the optimization)
        if historical_roles:
            viable_roles.update(historical_roles)

        return list(viable_roles)

def get_current_champion_data(champion_key):
    """Get current champion data from Firebase (new structure: champions/data/champions/{championId})"""
    try:
        doc_ref = db.collection('champions').document('data').collection('champions').document(champion_key)
        doc = doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        else:
            return {}  # No existing data
    except Exception as e:
        print(f"Error getting current data for {champion_key}: {e}")
        return {}

def store_combined_champion_data_smart(champion, current_data, new_data, update_decision):
    """Store combined champion data using smart update decisions (new structure: champions/data/champions/{championId})"""
    try:
        doc_ref = db.collection('champions').document('data').collection('champions').document(champion)

        # Start with current data or empty dict
        final_data = current_data.copy() if current_data else {}

        # Apply selective updates based on decision
        if update_decision['abilities']:
            final_data['abilities'] = new_data.get('abilities', [])

        if update_decision['lolalytics']:
            # Update with new build data (exclude tier field)
            lolalytics_fields = ['patch', 'roles']
            for field in lolalytics_fields:
                if field in new_data:
                    final_data[field] = new_data[field]

            # Filter to viable roles only
            if 'roles' in final_data:
                update_engine = SmartUpdateEngine()
                viable_roles = update_engine.get_viable_roles(new_data)
                final_data['roles'] = {
                    role: final_data['roles'][role]
                    for role in viable_roles
                    if role in final_data['roles']
                }

        # No archival - single dataset storage

        # Store the updated data
        doc_ref.set(final_data)

    except Exception as e:
        print(f"Error storing smart update data for {champion}: {e}")
        raise

def archive_champion_data(champion_key, data):
    """Archive champion data for fallback system (optimized hierarchical structure)"""
    try:
        patch = data.get('patch')
        if patch:
            doc_ref = db.collection('champions').document('all').collection('champions').document(champion_key).collection('patch_history').document(patch)
            doc_ref.set(data)
            print(f"📦 Archived {champion_key} data for patch {patch}")
    except Exception as e:
        print(f"Error archiving data for {champion_key}: {e}")

def update_role_containers():
    """Store role data in single document at champions/data (new structure)"""
    print("Updating role containers for new structure...")

    try:
        # Get all champions from new structure
        champions_ref = db.collection('champions').document('data').collection('champions')
        champions = []  # list of (champion_key, champ_data)

        # Get all champions from the champions subcollection
        champions_docs = champions_ref.stream()
        for doc in champions_docs:
            champion_key = doc.id
            champ_data = doc.to_dict()
            champions.append((champion_key, champ_data))

        role_champions = {
            'top': [],
            'jungle': [],
            'middle': [],  # Scraper uses 'middle', not 'mid'
            'bottom': [],  # Scraper uses 'bottom', not 'adc'
            'support': []
        }

        for champion_key, champ_data in champions:
            # Check which roles this champion plays
            roles = champ_data.get('roles', {})
            for role in roles:
                if role in role_champions:
                    role_champions[role].append(champion_key)  # Just store champion IDs

        # Sort champions by pick rate (highest first) within each role
        for role in role_champions:
            role_champions[role].sort(key=lambda champ_id: next(
                (champ_data for key, champ_data in champions if key == champ_id), {}
            ).get('roles', {}).get(role, {}).get('stats', {}).get('pick_rate', 0), reverse=True)

        # Store role data in single document
        data_ref = db.collection('champions').document('data')

        role_data = {
            'roles': role_champions,
            'lastUpdated': datetime.utcnow()
        }

        # Get current patch from first champion if available
        if champions:
            first_champion_data = champions[0][1]  # (champion_key, champ_data)
            current_patch = first_champion_data.get('patch')
            if current_patch:
                role_data['patch'] = current_patch

        data_ref.set(role_data, merge=True)  # Merge to preserve other data in the document
        print(f"✅ Updated role data: {sum(len(champs) for champs in role_champions.values())} total champions")

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

def cleanup_old_patch_data():
    """Clean up old patch data, keeping only current + 1 previous patch"""
    print("🧹 Cleaning up old patch data...")

    try:
        # Get current patch from a sample champion
        current_patch = None
        champions_ref = db.collection('champions').document('all').collection('champions')
        sample_champions = champions_ref.stream()

        for doc in sample_champions:
            current_patch = doc.to_dict().get('patch')
            break

        if not current_patch:
            print("⚠️ Could not determine current patch, skipping cleanup")
            return

        print(f"Current active patch: {current_patch}")

        # Collect all patch history data
        old_patches = []

        # Get all champions directly
        champions_docs = champions_ref.stream()
        for doc in champions_docs:
            champion_key = doc.id
            # Check if this champion has patch history subcollection
            patch_history_ref = doc.reference.collection('patch_history')
            patches = patch_history_ref.list_documents()

            for patch_doc in patches:
                patch_version = patch_doc.id
                if patch_version != current_patch:
                    old_patches.append((champion_key, patch_version, patch_doc))

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

def get_champion_list():
    """Get list of all champions from Riot Data Dragon API"""
    try:
        # Get latest version
        versions_url = "https://ddragon.leagueoflegends.com/api/versions.json"
        versions_response = requests.get(versions_url, timeout=10)
        versions_response.raise_for_status()
        versions = versions_response.json()
        latest_version = versions[0]

        # Get champion data
        champions_url = f"https://ddragon.leagueoflegends.com/cdn/{latest_version}/data/en_US/champion.json"
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

# Main execution block for running as standalone script (GitHub Actions)
if __name__ == "__main__":
    try:
        scrape_and_store_data()
        print("✅ Champion scraping completed successfully!")
    except Exception as e:
        print(f"❌ Error during scraping: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
