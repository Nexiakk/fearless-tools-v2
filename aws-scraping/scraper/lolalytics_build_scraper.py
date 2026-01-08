import requests
from bs4 import BeautifulSoup
import json
import re
import time
from typing import Dict, List, Optional

class LolalyticsBuildScraper:
    def __init__(self):
        self.base_url = "https://lolalytics.com"
        self.session = requests.Session()
        # Add headers to look more like a real browser
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })

    def get_champion_roles(self, champion: str, tier: str = "diamond_plus", patch: str = "15.24") -> List[str]:
        """Get roles with playrate >= 9% from main champion page"""
        url = f"{self.base_url}/pl/lol/{champion}/build/?tier={tier}&patch={patch}"
        print(f"Fetching roles from: {url}")

        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')

            # Find the roles container
            roles_container = soup.find('div', class_='flex h-[51px] w-[197px] gap-[3px] pt-[3px]')
            if not roles_container:
                print("Could not find roles container")
                return []

            valid_roles = []
            role_links = roles_container.find_all('a', href=True)

            for link in role_links:
                # Extract percentage
                percentage_div = link.find('div', class_='mt-[8px] text-center text-[9px]')
                if percentage_div:
                    percentage_text = percentage_div.get_text().strip()
                    # Remove % and convert to float
                    try:
                        percentage = float(percentage_text.rstrip('%'))
                        # Extract role from href
                        href = link['href']
                        role_match = re.search(r'/build/\?lane=([^&]+)', href)
                        if role_match:
                            role = role_match.group(1)
                        else:
                            # If no lane parameter, it's the default role (top)
                            role = "top"
                        if percentage >= 9.0:
                            valid_roles.append(role)
                    except ValueError:
                        continue

            return valid_roles

        except Exception as e:
            print(f"Error getting roles for {champion}: {e}")
            return []

    def get_role_stats(self, champion: str, role: str, tier: str = "diamond_plus", patch: str = "15.24") -> Dict:
        """Get win rate, pick rate, tier, rank, ban rate, games for a specific role"""
        url = f"{self.base_url}/pl/lol/{champion}/build/?lane={role}&tier={tier}&patch={patch}"
        print(f"Fetching stats for {champion} {role}: {url}")

        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')

            stats = {}

            # First stats section: Win Rate and Pick Rate
            first_stats = soup.find('div', class_='flex justify-around border border-[#333333] p-2 text-center')
            if first_stats:
                stat_divs = first_stats.find_all('div', recursive=False)
                if len(stat_divs) >= 3:
                    # Win Rate
                    win_rate_div = stat_divs[0]
                    win_rate_text = win_rate_div.find('div', class_='mb-1 font-bold')
                    if win_rate_text:
                        stats['win_rate'] = float(win_rate_text.get_text().strip().rstrip('%'))

                    # Pick Rate (third div)
                    pick_rate_div = stat_divs[2]
                    pick_rate_text = pick_rate_div.find('div', class_='mb-1 font-bold')
                    if pick_rate_text:
                        stats['pick_rate'] = float(pick_rate_text.get_text().strip().rstrip('%'))

            # Second stats section: Tier, Rank, Ban Rate, Games
            second_stats = soup.find('div', class_='mt-2 flex justify-around border border-[#333333] p-2 text-center')
            if second_stats:
                stat_divs = second_stats.find_all('div', recursive=False)
                if len(stat_divs) >= 4:
                    # Tier
                    tier_div = stat_divs[0]
                    tier_text = tier_div.find('div', class_='mb-1 font-bold')
                    if tier_text:
                        stats['tier'] = tier_text.get_text().strip()

                    # Rank
                    rank_div = stat_divs[1]
                    rank_text = rank_div.find('div', class_='mb-1 font-bold')
                    if rank_text:
                        stats['rank'] = rank_text.get_text().strip()

                    # Ban Rate
                    ban_rate_div = stat_divs[2]
                    ban_rate_text = ban_rate_div.find('div', class_='mb-1 font-bold')
                    if ban_rate_text:
                        stats['ban_rate'] = float(ban_rate_text.get_text().strip().rstrip('%'))

                    # Games
                    games_div = stat_divs[3]
                    games_text = games_div.find('div', class_='mb-1 font-bold')
                    if games_text:
                        games_str = games_text.get_text().strip().replace(',', '')
                        stats['games'] = int(games_str)

            return stats

        except Exception as e:
            print(f"Error getting stats for {champion} {role}: {e}")
            return {}

    def get_counter_matchups(self, champion: str, role: str, tier: str = "diamond_plus", patch: str = "15.24") -> List[Dict]:
        """Get counter matchups for a specific role"""
        url = f"{self.base_url}/pl/lol/{champion}/counters/?lane={role}&tier={tier}&patch={patch}"
        print(f"Fetching counters for {champion} {role}: {url}")

        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')

            counters = []

            # Look for JSON data in script tags first
            counters = []
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string:
                    # Look for JSON-like data containing counter information
                    if 'counters' in script.string.lower() or ('champion' in script.string.lower() and 'winrate' in script.string.lower()):
                        try:
                            # Try to find JSON arrays or objects
                            # Look for patterns like: "champions": [...] or similar
                            json_patterns = [
                                r'"counters"\s*:\s*\[([^\]]*)\]',
                                r'"champions"\s*:\s*\[([^\]]*)\]',
                                r'(\{[^{}]*"champion"[^}]*"winrate"[^}]*\})',
                                r'(\{[^{}]*"name"[^}]*"winrate"[^}]*\})'
                            ]

                            for pattern in json_patterns:
                                matches = re.findall(pattern, script.string, re.IGNORECASE | re.DOTALL)
                                if matches:
                                    print(f"Found {len(matches)} potential counter data matches in script")
                                    # Try to parse each match
                                    for match in matches[:10]:  # Limit for debugging
                                        try:
                                            # Clean up the JSON string
                                            json_str = match.strip()
                                            if not json_str.startswith('{'):
                                                json_str = '{' + json_str + '}'
                                            data = json.loads(json_str)

                                            counter_data = {}
                                            # Extract champion name
                                            champ_name = data.get('champion') or data.get('name') or data.get('champ')
                                            if champ_name:
                                                counter_data['champion'] = str(champ_name).replace('-', ' ').title()

                                            # Extract win rate
                                            winrate = data.get('winrate') or data.get('win_rate') or data.get('wr')
                                            if winrate is not None:
                                                try:
                                                    counter_data['win_rate'] = float(winrate)
                                                except:
                                                    pass

                                            # Extract other stats
                                            for key in ['delta_1', 'delta1', 'delta_2', 'delta2', 'pick_rate', 'pickrate', 'games']:
                                                value = data.get(key)
                                                if value is not None:
                                                    try:
                                                        if key in ['delta_1', 'delta1', 'delta_2', 'delta2', 'pick_rate', 'pickrate']:
                                                            counter_data[key.replace('delta1', 'delta_1').replace('delta2', 'delta_2').replace('pickrate', 'pick_rate')] = float(value)
                                                        elif key == 'games':
                                                            counter_data['games'] = int(value)
                                                    except:
                                                        pass

                                            if counter_data.get('champion') and counter_data.get('win_rate') is not None:
                                                counters.append(counter_data)
                                                print(f"Parsed counter from JSON: {counter_data['champion']} - WR: {counter_data['win_rate']}%")

                                        except Exception as e:
                                            print(f"Error parsing JSON match: {e}")
                                            continue

                                    if counters:
                                        return counters  # Return if we found data

                        except Exception as e:
                            print(f"Error processing script: {e}")
                            continue

            # If no JSON found, try HTML parsing
            counter_container = soup.find('div', class_='flex h-[146px] mb-2 border border-[#333] bg-gradient-to-r from-[#010102cc] to-[#222222cc]')
            if not counter_container:
                print("Could not find counter container, checking page structure")
                # Check what the page actually contains
                main_content = soup.find('main') or soup.find('body')
                if main_content:
                    print(f"Page title: {soup.title.get_text() if soup.title else 'No title'}")
                    print(f"Main content length: {len(str(main_content))}")
                # Look for champion matchup data - try different approaches
                champion_divs = main_content.find_all('img', alt=True)
                print(f"Found {len(champion_divs)} images with alt text")

                # Try to find champion containers with links
                matchup_links = main_content.find_all('a', href=lambda x: x and '/lol/aatrox/vs/' in x)
                print(f"Found {len(matchup_links)} matchup links")

                if matchup_links:
                    print("Found matchup links, parsing counter data...")
                    for link in matchup_links[:20]:  # Parse more to get good sample
                        try:
                            counter_data = {}

                            # Get champion name from URL
                            href = link['href']
                            match = re.search(r'/vs/([^/]+)/', href)
                            if match:
                                counter_data['champion'] = match.group(1).replace('-', ' ').title()

                            # The link contains the data directly
                            link_content = link.get_text()

                            # Extract win rate - look for percentage followed by VS
                            winrate_match = re.search(r'(\d+\.?\d*)%\s*VS', link_content)
                            if winrate_match:
                                try:
                                    counter_data['win_rate'] = float(winrate_match.group(1))
                                except:
                                    pass

                            # Extract delta values - look for Δ<sub>1</sub> and Δ<sub>2</sub> patterns
                            delta1_match = re.search(r'Δ<sub>1</sub>\s*(-?\d+\.?\d*)', link_content)
                            if delta1_match:
                                try:
                                    counter_data['delta_1'] = float(delta1_match.group(1))
                                except:
                                    pass

                            delta2_match = re.search(r'Δ<sub>2</sub>\s*(-?\d+\.?\d*)', link_content)
                            if delta2_match:
                                try:
                                    counter_data['delta_2'] = float(delta2_match.group(1))
                                except:
                                    pass

                            # Extract games count - look for number followed by Games
                            games_match = re.search(r'(\d+(?:,\d+)*)\s*Games', link_content)
                            if games_match:
                                try:
                                    games_text = games_match.group(1).replace(',', '')
                                    counter_data['games'] = int(games_text)
                                except:
                                    pass

                            # For pick rate, we might need to calculate or it's not directly available
                            # For now, set it to None or try to find it
                            counter_data['pick_rate'] = None  # Not directly available in this format

                            if counter_data.get('champion') and counter_data.get('win_rate') is not None:
                                counters.append(counter_data)
                                print(f"Parsed counter: {counter_data['champion']} - WR: {counter_data['win_rate']}%, Games: {counter_data.get('games')}")

                        except Exception as e:
                            print(f"Error parsing matchup link: {e}")
                            continue

                    return counters
                else:
                    return []

            # Find the scrollable counter list
            counter_list = counter_container.find('div', class_='cursor-grab overflow-y-hidden overflow-x-scroll')
            if not counter_list:
                print("Could not find counter list")
                return []

            counter_divs = counter_list.find_all('div', recursive=False)
            # Skip the first few divs that might be headers
            data_divs = [div for div in counter_divs if div.find('a', href=True)]

            for div in data_divs:
                try:
                    counter_data = {}

                    # Champion name from alt attribute
                    img = div.find('img', alt=True)
                    if img:
                        counter_data['champion'] = img['alt']

                    # Extract stats - they are in divs with my-1 class
                    stat_divs = div.find_all('div', class_='my-1')
                    print(f"Found {len(stat_divs)} stat divs for {counter_data.get('champion', 'unknown')}")
                    if len(stat_divs) >= 4:
                        # Win Rate - look for span with color style or just get text
                        win_rate_div = stat_divs[0]
                        span = win_rate_div.find('span')
                        if span:
                            win_rate_text = span.get_text().strip()
                        else:
                            win_rate_text = win_rate_div.get_text().strip()
                        try:
                            counter_data['win_rate'] = float(win_rate_text)
                        except ValueError:
                            counter_data['win_rate'] = win_rate_text

                        # Delta 1
                        delta1_div = stat_divs[1]
                        span = delta1_div.find('span')
                        if span:
                            delta1_text = span.get_text().strip()
                        else:
                            delta1_text = delta1_div.get_text().strip()
                        try:
                            counter_data['delta_1'] = float(delta1_text)
                        except ValueError:
                            counter_data['delta_1'] = delta1_text

                        # Delta 2
                        delta2_div = stat_divs[2]
                        span = delta2_div.find('span')
                        if span:
                            delta2_text = span.get_text().strip()
                        else:
                            delta2_text = delta2_div.get_text().strip()
                        try:
                            counter_data['delta_2'] = float(delta2_text)
                        except ValueError:
                            counter_data['delta_2'] = delta2_text

                        # Pick Rate
                        pick_rate_div = stat_divs[3]
                        span = pick_rate_div.find('span')
                        if span:
                            pick_rate_text = span.get_text().strip()
                        else:
                            pick_rate_text = pick_rate_div.get_text().strip()
                        try:
                            counter_data['pick_rate'] = float(pick_rate_text)
                        except ValueError:
                            counter_data['pick_rate'] = pick_rate_text

                    # Games
                    games_div = div.find('div', class_='text-[9px] text-[#bbb]')
                    if games_div:
                        games_text = games_div.get_text().strip().replace(',', '')
                        try:
                            counter_data['games'] = int(games_text)
                        except ValueError:
                            counter_data['games'] = games_text

                    if counter_data:
                        counters.append(counter_data)

                except Exception as e:
                    print(f"Error parsing counter data: {e}")
                    continue

            return counters

        except Exception as e:
            print(f"Error getting counters for {champion} {role}: {e}")
            return []

    def scrape_champion_build(self, champion: str, tier: str = "diamond_plus", patch: str = "15.24") -> Dict:
        """Main method to scrape all champion build data - returns flattened structure"""
        print(f"\n=== Scraping {champion} build data ===")

        # Get valid roles
        roles = self.get_champion_roles(champion, tier, patch)
        if not roles:
            print(f"No valid roles found for {champion}")
            return {}

        result = {
            'tier': tier,
            'patch': patch,
            'roles': {}
        }

        # Get data for each role
        for role in roles:
            print(f"\n--- Processing role: {role} ---")

            # Get stats
            stats = self.get_role_stats(champion, role, tier, patch)

            # Get counters
            counters = self.get_counter_matchups(champion, role, tier, patch)

            result['roles'][role] = {
                'stats': stats,
                'counters': counters
            }

            # Rate limiting
            time.sleep(1)

        return result

def test_aatrox():
    """Test the scraper with Aatrox"""
    scraper = LolalyticsBuildScraper()
    result = scraper.scrape_champion_build("aatrox")

    print("\n=== Test Results ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    return result

if __name__ == "__main__":
    test_aatrox()
