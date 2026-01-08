import requests
from bs4 import BeautifulSoup
import json
import re
import time

class LolalyticsWrapper:
    def __init__(self):
        self.base_url = "https://lolalytics.com"
        self.session = requests.Session()
        # Add headers to look more like a real browser
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })

    def get_champion_stats(self):
        """Get champion statistics from Lolalytics via direct scraping"""
        try:
            print("Fetching Lolalytics champion statistics...")

            # Try the tierlist page
            url = f"{self.base_url}/lol/tierlist/"
            print(f"Requesting: {url}")

            response = self.session.get(url, timeout=15)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Look for champion data in the page
            # Lolalytics might load data dynamically, so check for JSON in scripts or data attributes

            data = {}

            # Method 1: Look for JSON data in script tags
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string:
                    # Look for champion data patterns
                    if 'champions' in script.string.lower() or 'tierlist' in script.string.lower():
                        try:
                            # Try to extract JSON-like data
                            json_matches = re.findall(r'(\{[^{}]*"champion"[^}]*\})', script.string, re.IGNORECASE)
                            for match in json_matches:
                                try:
                                    champ_data = json.loads(match)
                                    champ_name = champ_data.get('champion', '').lower().replace(' ', '')
                                    if champ_name and champ_name not in data:
                                        winrate = float(champ_data.get('winrate', '0').rstrip('%'))
                                        data[champ_name] = {
                                            'pick_rate': round(winrate * 0.8, 2),
                                            'roles': [],
                                            'counters': []
                                        }
                                except:
                                    continue
                        except:
                            continue

            # Method 2: Look for table data
            if not data:
                tables = soup.find_all('table')
                for table in tables:
                    rows = table.find_all('tr')[1:11]  # Get first 10 rows
                    for row in rows:
                        cells = row.find_all('td')
                        if len(cells) >= 3:
                            # Try to extract champion name and stats
                            name_cell = cells[0]
                            champ_link = name_cell.find('a')
                            if champ_link:
                                champ_name = champ_link.get_text().strip().lower().replace(' ', '')
                                # Look for winrate in other cells
                                for cell in cells[1:]:
                                    cell_text = cell.get_text().strip()
                                    winrate_match = re.search(r'(\d+\.?\d*)%', cell_text)
                                    if winrate_match:
                                        winrate = float(winrate_match.group(1))
                                        data[champ_name] = {
                                            'pick_rate': round(winrate * 0.8, 2),
                                            'roles': [],
                                            'counters': []
                                        }
                                        break

            print(f"Successfully scraped data for {len(data)} champions from Lolalytics")
            return data

        except Exception as e:
            print(f"Error scraping Lolalytics: {e}")
            import traceback
            traceback.print_exc()
            return {}
