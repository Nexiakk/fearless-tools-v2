import requests
from bs4 import BeautifulSoup
import re
import time
import random

def scrape_champion_abilities(champion_name):
    """Scrape ability cooldowns for a champion from League Wiki"""
    # Use the correct URL format: https://wiki.leagueoflegends.com/en-us/{Champion}
    url = f"https://wiki.leagueoflegends.com/en-us/{champion_name}"
    print(f"Scraping {url}")

    try:
        response = requests.get(url, timeout=10, allow_redirects=True)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')
        abilities = []

        # Find all skill divs (passive, q, w, e, r)
        skill_divs = soup.find_all('div', class_=re.compile(r'skill_\w+'))

        for skill_div in skill_divs:
            # Extract skill type from CSS class
            skill_type = extract_skill_type(skill_div)
            if not skill_type:
                continue

            # Extract ability name
            ability_name = extract_ability_name(skill_div)
            if not ability_name or ability_name == 'Edit':
                continue

            # Skip generic entries
            if ability_name in ['Active:', 'Passive:', 'Innate:'] or ability_name == champion_name:
                continue

            # Extract cooldown
            cooldown = extract_cooldown(skill_div)
            if not cooldown or cooldown == '.':
                continue

            # Extract cost information
            cost = extract_cost(skill_div)

            # Avoid duplicates by checking if we already have this ability type
            if any(a['type'] == skill_type and a['name'] == ability_name for a in abilities):
                continue

            # Build ability object - only include cost if it exists
            ability_obj = {
                'name': ability_name,
                'type': skill_type,
                'cooldown': cooldown
            }

            # Only add cost field if it has data (not null)
            if cost is not None:
                ability_obj['cost'] = cost

            abilities.append(ability_obj)

        return abilities

    except Exception as e:
        print(f"Error scraping {champion_name}: {e}")
        return []

def extract_ability_name(container):
    """Extract ability name from container"""
    # Look for the specific ability name element
    name_div = container.find('div', class_='ability-info-stats__ability')
    if name_div:
        return name_div.get_text(strip=True)

    # Fallback: Look for h3 or strong tags with ability name
    name_tag = container.find(['h3', 'strong', 'b'])
    if name_tag:
        return name_tag.get_text(strip=True)

    return None

def extract_cooldown(container):
    """Extract cooldown from ability container"""
    # Look for text containing "cooldown" or numbers in specific patterns
    text = container.get_text()

    # Regex to find cooldown patterns like "Cooldown: 10/9/8/7/6 seconds"
    cooldown_match = re.search(r'cooldown[:\s]*([\d./\s]+)', text, re.IGNORECASE)
    if cooldown_match:
        return cooldown_match.group(1).strip()

    # Look for tables with cooldown info
    tables = container.find_all('table')
    for table in tables:
        if 'cooldown' in table.get_text().lower():
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all('td')
                if cells and len(cells) > 1:
                    if 'cooldown' in cells[0].get_text().lower():
                        return cells[1].get_text().strip()

    return None

def parse_alternative(soup):
    """Alternative parsing method if primary fails"""
    abilities = []

    # Look for all tables that might contain ability info
    tables = soup.find_all('table', class_=re.compile(r'skill-table|ability-table'))

    for table in tables:
        rows = table.find_all('tr')
        for row in rows[1:]:  # Skip header
            cells = row.find_all('td')
            if len(cells) >= 2:
                ability_name = cells[0].get_text().strip()
                cooldown = cells[1].get_text().strip() if len(cells) > 1 else None

                if ability_name and cooldown:
                    abilities.append({
                        'name': ability_name,
                        'cooldown': cooldown
                    })

    return abilities

def extract_skill_type(skill_div):
    """Extract skill type (Q, W, E, R, Passive) from CSS classes"""
    classes = skill_div.get('class', [])

    # Map CSS classes to skill types
    class_to_type = {
        'skill_innate': 'Passive',
        'skill_q': 'Q',
        'skill_w': 'W',
        'skill_e': 'E',
        'skill_r': 'R'
    }

    for class_name in classes:
        if class_name in class_to_type:
            return class_to_type[class_name]

    return None

def extract_cost(container):
    """Extract cost information from ability container"""
    # Look for ability-info-stats__stat elements with COST label
    stat_elements = container.find_all('div', class_='ability-info-stats__stat')

    for stat in stat_elements:
        label_elem = stat.find('div', class_='ability-info-stats__stat-label')
        value_elem = stat.find('div', class_='ability-info-stats__stat-value')

        if label_elem and value_elem:
            label_text = label_elem.get_text(strip=True)

            # Check if this is the COST label
            if label_text.upper() == 'COST:':
                value_text = value_elem.get_text(strip=True)

                # Split value and resource type
                # Example: "55 / 65 / 75 / 85 / 95 mana" -> value: "55 / 65 / 75 / 85 / 95", resource: "mana"
                parts = value_text.split()

                if len(parts) >= 2:
                    # Last part is the resource type
                    resource = parts[-1].lower()

                    # Everything before last part is the value
                    value = ' '.join(parts[:-1])

                    # Validate resource type
                    valid_resources = ['mana', 'energy', 'fury', 'health']
                    if resource in valid_resources:
                        return {
                            'value': value,
                            'resource': resource
                        }
                elif len(parts) == 1:
                    # Only one part, might be just a number or "Passive"
                    value = parts[0]
                    if value.isdigit() or '/' in value:
                        # Assume mana if not specified
                        return {
                            'value': value,
                            'resource': 'mana'
                        }

    # No COST label found
    return None
