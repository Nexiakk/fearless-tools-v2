#!/usr/bin/env python3
"""Final test script for the fixed wiki scraping functionality"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

def parse_wiki_date(date_text):
    """Parse wiki date format from various possible formats"""
    try:
        import re

        # Remove link references like [1], [2], etc.
        date_text = re.sub(r'\s*\[\d+\]\s*$', '', date_text).strip()

        # Handle the <br> tag creating newlines (if present)
        date_text = date_text.replace('\n', ' ').strip()

        # Handle cases where day and year are concatenated (e.g., "January 82026" -> "January 8 2026")
        # Look for pattern: Month DayYear
        date_match = re.search(r'^([A-Za-z]+)\s+(\d+)(20\d{2})$', date_text)
        if date_match:
            month, day, year = date_match.groups()
            date_text = f"{month} {day} {year}"

        # Parse format like "January 8 2026"
        return datetime.strptime(date_text, '%B %d %Y')
    except ValueError:
        print(f"Could not parse date: '{date_text}'")
        return None

def wiki_to_riot_patch(wiki_version):
    """Convert Wiki patch format V26.01 to Riot format 16.1"""
    if not wiki_version.startswith('V'):
        return None

    try:
        version = wiki_version[1:]  # Remove 'V' -> "26.01"
        year_digit, patch_num = version.split('.')

        # Convert year: 26 -> 16 (1 + last digit of year)
        riot_major = f"1{year_digit[-1]}"  # 6 -> "16"

        # Keep patch number as is
        return f"{riot_major}.{int(patch_num)}"  # "16.1"

    except (ValueError, IndexError):
        print(f"Could not convert wiki version: {wiki_version}")
        return None

def scrape_wiki_patches(current_year):
    """Scrape League Wiki annual cycle page for patches with release dates"""
    url = f"https://wiki.leagueoflegends.com/en-us/Patch/{current_year}_Annual_Cycle"

    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        patches = []

        # Find the patch table
        table = soup.find('table')
        if not table:
            return []

        rows = table.find_all('tr')[1:]  # Skip header row

        for row in rows:
            cells = row.find_all(['th', 'td'])
            if len(cells) < 2:
                continue

            # Extract date from first cell (th)
            date_cell = cells[0]
            date_text = date_cell.get_text().strip()
            print(f"DEBUG: Raw date text: '{repr(date_text)}'")

            # Parse date format: "January 8\n2026" -> datetime
            release_date = parse_wiki_date(date_text)
            if not release_date:
                continue

            # Extract patch from second cell (td)
            patch_cell = cells[1]
            patch_link = patch_cell.find('a')
            if patch_link:
                patch_title = patch_link.get('title') or patch_link.get_text().strip()
                patches.append({
                    'title': patch_title,  # e.g., "V26.01"
                    'release_date': release_date
                })

        return patches

    except Exception as e:
        print(f"Error scraping wiki patches: {e}")
        return []

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

def get_riot_versions():
    """Fetch and cache Riot API versions for automatic patch detection"""
    try:
        print("Fetching Riot API versions...")
        response = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=10)
        response.raise_for_status()
        versions = response.json()
        print(f"✅ Fetched {len(versions)} patch versions from Riot API")
        return versions
    except Exception as e:
        print(f"❌ Failed to fetch Riot versions: {e}")
        return []

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

def check_patch_viability(current_patch_full):
    """
    Check if current patch has been released long enough using Wiki data.
    Returns tuple: (use_current_patch, target_patch, metrics)
    """
    try:
        print(f"🔍 Checking patch {current_patch_full} viability using Wiki data...")

        # Normalize patch format (16.1.1 -> 16.1)
        current_patch_short = current_patch_full.split('.')[0] + '.' + current_patch_full.split('.')[1]
        current_year = datetime.now().year

        # Scrape wiki patches
        wiki_patches = scrape_wiki_patches(current_year)

        if not wiki_patches:
            print("⚠️ No wiki patches found, falling back to previous patch")
            return False, get_previous_patch(current_patch_full), {}

        # Find matching patch
        for wiki_patch in wiki_patches:
            riot_version = wiki_to_riot_patch(wiki_patch['title'])

            if riot_version == current_patch_short:
                days_since_release = (datetime.now() - wiki_patch['release_date']).days

                print(f"✅ Found matching patch {wiki_patch['title']} -> {riot_version}")
                print(f"   Released: {wiki_patch['release_date'].strftime('%Y-%m-%d')}")
                print(f"   Days since release: {days_since_release}")

                # Use current patch if released more than 4 days ago
                if days_since_release >= 4:
                    print("✅ Patch is viable for scraping")
                    return True, current_patch_full, {
                        'days_since_release': days_since_release,
                        'release_date': wiki_patch['release_date'],
                        'wiki_title': wiki_patch['title']
                    }
                else:
                    print(f"⚠️ Patch too new ({days_since_release} days), falling back")
                    return False, get_previous_patch(current_patch_full), {
                        'days_since_release': days_since_release,
                        'release_date': wiki_patch['release_date'],
                        'reason': 'patch_too_new'
                    }

        # Patch not found on wiki
        print(f"⚠️ Patch {current_patch_short} not found on Wiki, falling back")
        return False, get_previous_patch(current_patch_full), {'reason': 'patch_not_on_wiki'}

    except Exception as e:
        print(f"❌ Error checking patch viability: {e}")
        import traceback
        traceback.print_exc()
        return False, get_previous_patch(current_patch_full), {'error': str(e)}

# Test the fixed wiki scraping functionality
try:
    print("✅ Starting final wiki scraping test...")

    # Test date parsing with link reference
    print("\n🧪 Testing date parsing fix...")
    test_date = "January 8 2026 [1]"
    parsed_date = parse_wiki_date(test_date)
    print(f"Input: '{test_date}' -> Parsed: {parsed_date}")

    # Test current patch
    current_patch = get_current_patch()
    print(f"\nCurrent patch: {current_patch}")

    # Test wiki scraping directly
    print("\n🔍 Testing wiki scraping...")
    current_year = datetime.now().year
    wiki_patches = scrape_wiki_patches(current_year)
    print(f"Found {len(wiki_patches)} patches on wiki")
    for patch in wiki_patches:
        riot_version = wiki_to_riot_patch(patch['title'])
        print(f"  {patch['title']} -> {riot_version} (released: {patch['release_date']})")

    # Test patch viability check
    print("\n🔍 Testing patch viability check...")
    use_current, target_patch, metrics = check_patch_viability(current_patch)

    print("\n✅ Final wiki scraping test completed successfully!")
    print(f"Use current patch: {use_current}")
    print(f"Target patch: {target_patch}")
    print(f"Metrics: {metrics}")

except Exception as e:
    print(f"❌ Test failed: {e}")
    import traceback
    traceback.print_exc()
