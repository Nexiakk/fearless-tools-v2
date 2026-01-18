#!/usr/bin/env python3
"""Test script for the fixed wiki scraping functionality"""

import sys
import os
sys.path.insert(0, 'aws-scraping')
sys.path.insert(0, 'aws-scraping/scraper')

# Test the fixed wiki scraping functionality
try:
    # Import the required modules
    from bs4 import BeautifulSoup
    import requests
    from datetime import datetime
    import re

    # Import the functions we need
    from main import (
        check_patch_viability,
        get_current_patch,
        get_previous_patch,
        scrape_wiki_patches,
        parse_wiki_date,
        wiki_to_riot_patch
    )

    print("✅ Imports successful!")

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

    print("\n✅ Wiki scraping test completed successfully!")
    print(f"Use current patch: {use_current}")
    print(f"Target patch: {target_patch}")
    print(f"Metrics: {metrics}")

    # Test previous patch detection
    if not use_current:
        print("\n🔄 Testing fallback patch detection...")
        prev_patch = get_previous_patch(current_patch)
        print(f"Previous patch for {current_patch}: {prev_patch}")

except Exception as e:
    print(f"❌ Test failed: {e}")
    import traceback
    traceback.print_exc()
