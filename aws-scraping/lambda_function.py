import os
import json
import time
import random
import requests
from scraper.lolalytics_wrapper import LolalyticsWrapper
from scraper.wiki_scraper import scrape_champion_abilities
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

def lambda_handler(event, context):
    """AWS Lambda handler function"""
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
    """Main function to scrape data and store in Firebase"""
    print("Starting data scraping...")

    # Scrape Lolalytics data
    print("Scraping Lolalytics data...")
    lolalytics_data = LolalyticsWrapper().get_champion_stats()

    # Scrape League Wiki data for all champions
    print("Scraping League Wiki data...")
    champions = get_champion_list()
    print(f"Found {len(champions)} champions to scrape")

    abilities_data = {}
    for i, champion in enumerate(champions):
        try:
            abilities = scrape_champion_abilities(champion)
            if abilities:  # Only store if we got data
                abilities_data[champion] = abilities
                print(f"[{i+1}/{len(champions)}] Scraped {len(abilities)} abilities for {champion}")
            else:
                print(f"[{i+1}/{len(champions)}] No data found for {champion}")

            # Rate limiting: wait 1-3 seconds between requests to be respectful
            if i < len(champions) - 1:  # Don't wait after last request
                wait_time = random.uniform(1, 3)
                time.sleep(wait_time)

        except Exception as e:
            print(f"[{i+1}/{len(champions)}] Error scraping {champion}: {e}")
            continue

    # Store all data in unified collection
    print(f"Storing data for {len(abilities_data)} champions...")
    store_champion_data(lolalytics_data, abilities_data)

    print("Data scraping completed.")

def store_champion_data(lolalytics_data, abilities_data):
    """Store all champion data in unified Firebase collection"""
    # Prepare data structure
    champions_data = {}
    current_time = datetime.utcnow()

    # Get all champion names from abilities data (more reliable)
    champion_names = list(abilities_data.keys())

    for champion in champion_names:
        champion_lower = champion.lower()

        # Get Lolalytics stats if available
        lolalytics_stats = lolalytics_data.get(champion_lower, {})

        # Get abilities data
        abilities = abilities_data.get(champion, [])

        champions_data[champion_lower] = {
            'name': champion,
            'pickRate': lolalytics_stats.get('pick_rate', 0),
            'roles': lolalytics_stats.get('roles', []),
            'counters': lolalytics_stats.get('counters', []),
            'abilities': abilities
        }

    # Store in unified collection
    doc_ref = db.collection('champions').document('all')
    doc_ref.set({
        'champions': champions_data,
        'lastUpdated': current_time
    })

def get_champion_list():
    """Fetch champion list from Riot Data Dragon API"""
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
            'Ahri', 'Akali', 'Ashe', 'Jinx', 'Lux', 'Miss Fortune', 'Vayne', 'Yuumi'
        ]
