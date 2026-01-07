# lol_draft_extractor.py
# A background Python script to extract League of Legends Champion Select data (bans/picks)
# using the LCU API and send it to a web app via HTTP POST.

import time
import asyncio
import requests
import hashlib
import json
import os
import logging
import sys
from typing import Dict, List, Optional, Any, Tuple, Set, Generator
from lcu_driver import Connector
from lcu_driver.connector import _return_ux_process
from lcu_driver.connection import Connection
import aiohttp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration - Customize these
WEB_APP_URL = 'https://fearless-tuls.netlify.app/.netlify/functions/lcuDraft'  # Netlify function endpoint
AUTH_URL = 'https://fearless-tuls.netlify.app/.netlify/functions/authenticateWorkspace'  # Workspace authentication endpoint
WEB_APP_HEADERS = {'Content-Type': 'application/json'}

# Configuration file path - for frozen executables, use exe directory
if getattr(sys, 'frozen', False):
    # Running as frozen executable
    CONFIG_FILE = os.path.join(os.path.dirname(sys.executable), 'workspace_config.json')
else:
    # Running as Python script
    CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'workspace_config.json')

# Workspace credentials (loaded from config or prompt)
workspace_id = None
workspace_password = None
workspace_authenticated = False

# Fix for Python 3.10+: Create event loop before initializing connector
# In Python 3.10+, get_event_loop() doesn't create a loop automatically
try:
    loop = asyncio.get_event_loop()
except RuntimeError:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

# Sleep configuration
SLEEP_INTERVAL = 10  # seconds to sleep when not in champ select
SLEEP_CHECK_INTERVAL = 1  # seconds to check for champ select while sleeping
SLEEP_IN_GAME_INTERVAL = 60  # seconds to sleep when in active game

def load_workspace_config():
    """Load workspace credentials from config file if it exists"""
    global workspace_id, workspace_password
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                workspace_id = config.get('workspaceId')
                workspace_password = config.get('password')
                return True
        except Exception as e:
            print(f"Error loading config file: {e}")
    return False

def save_workspace_config(workspace_id, password):
    """Save workspace credentials to config file"""
    try:
        config = {
            'workspaceId': workspace_id,
            'password': password
        }
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f)
        # Set file permissions to be readable only by owner (security)
        os.chmod(CONFIG_FILE, 0o600)
        print(f"Workspace credentials saved to {CONFIG_FILE}")
    except Exception as e:
        print(f"Error saving config file: {e}")

def authenticate_workspace(workspace_id, password):
    """Authenticate workspace ID and password with the server"""
    try:
        response = requests.post(
            AUTH_URL,
            json={'workspaceId': workspace_id, 'password': password},
            headers=WEB_APP_HEADERS,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                return True, data.get('workspaceName', workspace_id)
            else:
                return False, data.get('error', 'Authentication failed')
        elif response.status_code == 401:
            return False, 'Incorrect password'
        elif response.status_code == 404:
            return False, 'Workspace not found'
        else:
            # Try to get error message from response body
            try:
                error_data = response.json()
                error_msg = error_data.get('error') or error_data.get('message', f'Server error: {response.status_code}')
                return False, error_msg
            except:
                return False, f"Server error: {response.status_code} - {response.text[:200]}"
    except Exception as e:
        return False, f"Connection error: {str(e)}"

def detect_league_clients():
    """Detect all running League of Legends client instances"""
    clients = []
    seen_ports = set()  # Track ports to avoid duplicates (since PIDs might not be unique)

    try:
        for process in _return_ux_process():
            try:
                # Parse command line arguments to get client info
                cmdline = process.info.get("cmdline", [])
                if not cmdline:
                    continue

                # Parse arguments like lcu_driver does
                from lcu_driver.connection import parse_cmdline_args
                args = parse_cmdline_args(cmdline)

                port = args.get('app-port')
                if not port or not str(port).isdigit():
                    continue  # Skip if no valid port found

                port = int(port)

                # Skip if we've already processed this port
                if port in seen_ports:
                    continue

                # Additional validation: League clients should be on reasonable port ranges
                # Allow ports from 1000 to 65535 (most ports above 1000 are reasonable)
                if port < 1000 or port > 65535:
                    continue  # Skip invalid port ranges

                client_info = {
                    'process': process,
                    'pid': process.pid,
                    'port': port,
                    'auth_token': args.get('remoting-auth-token', ''),
                    'install_dir': args.get('install-directory', ''),
                    'cmdline': cmdline
                }

                # Mark this port as processed
                seen_ports.add(port)

                # Try to identify client type based on port, region, or other indicators
                cmdline_str = ' '.join(cmdline)

                # Check for tournament indicators
                if ('loltmnt' in cmdline_str.lower() or
                    'tournament' in cmdline_str.lower() or
                    port == 21077):
                    client_info['type'] = 'Tournament Client'
                    client_info['description'] = f"Tournament Client (Port: {port}, PID: {process.pid})"
                elif port == 21076:
                    client_info['type'] = 'Live Client'
                    client_info['description'] = f"Live Client (Port: {port}, PID: {process.pid})"
                else:
                    # Default to Live Client for unknown configurations
                    client_info['type'] = 'Live Client'
                    client_info['description'] = f"Live Client (Port: {port}, PID: {process.pid})"

                clients.append(client_info)

            except Exception as e:
                print(f"Warning: Could not parse client info for process {process.pid}: {e}")
                continue
    except Exception as e:
        print(f"Error detecting League clients: {e}")

    # Sort clients by port for consistent ordering
    clients.sort(key=lambda x: x['port'])

    return clients

def select_league_client(clients):
    """Prompt user to select which League client to connect to"""
    if not clients:
        print("No League of Legends clients found. Please start the League client and try again.")
        return None

    if len(clients) == 1:
        # Only one client, use it automatically
        client = clients[0]
        return client

    # Multiple clients found, let user choose
    print(f"\nFound {len(clients)} League of Legends clients:")
    print("=" * 60)

    for i, client in enumerate(clients, 1):
        print(f"{i}. {client['description']}")

    print("=" * 60)

    while True:
        try:
            choice = input(f"Select client to connect to (1-{len(clients)}): ").strip()
            choice_idx = int(choice) - 1

            if 0 <= choice_idx < len(clients):
                selected_client = clients[choice_idx]
                print(f"\nSelected: {selected_client['description']}")
                return selected_client
            else:
                print(f"Invalid choice. Please enter a number between 1 and {len(clients)}.")
        except ValueError:
            print("Invalid input. Please enter a number.")
        except KeyboardInterrupt:
            print("\nSelection cancelled.")
            return None

def authenticate_only():
    """Authenticate workspace credentials without client detection"""
    global workspace_id, workspace_password, workspace_authenticated

    # Try to load from config first and auto-authenticate
    if load_workspace_config():
        # Auto-authenticate with saved credentials
        success, message = authenticate_workspace(workspace_id, workspace_password)
        if success:
            workspace_authenticated = True
            return True, message  # Return success and workspace name
        else:
            print(f"✗ Saved credentials failed: {message}")
            print("Please enter credentials manually.\n")

    # No saved config or saved config failed - prompt for credentials
    print("\n" + "="*60)
    print("Fearless Tools - LCU Client")
    print("="*60)
    print("Please enter your workspace credentials to continue.\n")

    while True:
        workspace_id = input("Workspace ID: ").strip()
        if not workspace_id:
            print("Workspace ID cannot be empty. Please try again.")
            continue

        workspace_password = input("Password: ").strip()
        if not workspace_password:
            print("Password cannot be empty. Please try again.")
            continue

        # Authenticate
        print("Authenticating...")
        success, message = authenticate_workspace(workspace_id, workspace_password)

        if success:
            print(f"✓ Authenticated successfully! Workspace: {message}")
            workspace_authenticated = True

            # Ask if user wants to save credentials
            save_creds = input("\nSave credentials for next time? (Y/n): ").strip().lower()
            if save_creds != 'n':
                save_workspace_config(workspace_id, workspace_password)

            return True, message
        else:
            print(f"✗ Authentication failed: {message}")
            print("Please try again.\n")

def prompt_workspace_credentials():
    """Prompt user for workspace ID and password, then detect clients"""
    # First authenticate
    auth_result = authenticate_only()
    if not auth_result[0]:
        return auth_result

    # Then detect and select clients
    print("\nDetecting League of Legends clients...")
    clients = detect_league_clients()

    selected_client = select_league_client(clients)
    if not selected_client:
        print("No client selected. Exiting...")
        exit(1)

    # Create connector for the selected client
    print(f"Connecting to {selected_client['description']}...")
    global connector
    connector = Connector()
    setup_connector_events(connector)

    return auth_result

async def sleeping_loop(connection):
    """Async loop that checks gameflow phase and sleeps appropriately"""
    global current_gameflow_phase, previous_sleep_time

    while True:
        try:
            # Determine sleep interval based on gameflow phase
            if current_gameflow_phase == 'ChampSelect':
                # In champion select - check frequently for draft data
                sleep_time = SLEEP_CHECK_INTERVAL
                reason = "in champion select"
            elif current_gameflow_phase == 'InProgress':
                # In active game - sleep longer to save resources
                sleep_time = SLEEP_IN_GAME_INTERVAL
                reason = "in active game"
            else:
                # In lobby, matchmaking, etc. - moderate sleep
                sleep_time = SLEEP_INTERVAL
                reason = f"not in champion select (phase: {current_gameflow_phase})"

            # Only print when sleep time changes to avoid spamming
            # Skip printing for 1-second intervals (too noisy)
            if sleep_time != previous_sleep_time and sleep_time > 1:
                print(f"Sleeping ({sleep_time}s) - {reason}")
                previous_sleep_time = sleep_time
            elif sleep_time != previous_sleep_time and sleep_time == 1:
                # Still track the state change but don't spam with 1s messages
                previous_sleep_time = sleep_time

            await asyncio.sleep(sleep_time)

        except asyncio.CancelledError:
            # Task was cancelled, exit gracefully
            break
        except Exception as e:
            print(f"Error in sleeping loop: {e}")
            await asyncio.sleep(1)  # Brief pause before retrying

# Global variables
connector = None
selected_client = None

# Track last lobby ID and sent data to detect changes
last_lobby_id = None
last_sent_data_hash = None  # Hash of last sent data to avoid duplicate sends

# Track gameflow phase to detect if game actually started
current_gameflow_phase = None

# Track previous sleep time to avoid spamming console
previous_sleep_time = None

# Async data sending infrastructure
_http_session = None  # Global aiohttp session for connection reuse

# Delta updates system
class DraftStateTracker:
    """Tracks draft state to generate delta updates instead of full state"""

    def __init__(self):
        self.last_states = {}  # {lobbyId: last_sent_state}

    def get_last_state(self, lobby_id):
        """Get the last sent state for a lobby"""
        return self.last_states.get(lobby_id)

    def update_last_state(self, lobby_id, state):
        """Update the last sent state for a lobby"""
        self.last_states[lobby_id] = state.copy()

    def generate_delta(self, lobby_id, current_state):
        """Generate a delta between last state and current state"""
        last_state = self.get_last_state(lobby_id)

        if last_state is None:
            # First time for this lobby - send full state
            return {
                'type': 'full',
                'data': current_state
            }

        # Generate delta by comparing states
        delta = {
            'type': 'delta',
            'lobbyId': lobby_id,
            'changes': []
        }

        # Compare top-level fields
        for key in ['phase', 'isNewGame']:
            if current_state.get(key) != last_state.get(key):
                delta['changes'].append({
                    'field': key,
                    'old_value': last_state.get(key),
                    'new_value': current_state.get(key)
                })

        # Compare team data
        for team_key in ['blue_side', 'red_side']:
            if team_key in current_state and team_key in last_state:
                team_delta = self._compare_team_data(
                    current_state[team_key],
                    last_state[team_key],
                    team_key
                )
                delta['changes'].extend(team_delta)
            elif team_key in current_state:
                # New team data
                delta['changes'].append({
                    'field': team_key,
                    'old_value': None,
                    'new_value': current_state[team_key]
                })

        # If no changes detected, return None
        if not delta['changes']:
            return None

        return delta

    def _compare_team_data(self, current_team, last_team, team_prefix):
        """Compare team data and generate field-level deltas"""
        changes = []

        # Compare simple lists: picks, bans
        for list_key in ['picks', 'bans']:
            current_list = current_team.get(list_key, [])
            last_list = last_team.get(list_key, [])

            if set(current_list) != set(last_list):
                changes.append({
                    'field': f"{team_prefix}.{list_key}",
                    'old_value': last_list,
                    'new_value': current_list
                })

        # Compare ordered lists: picks_ordered, bans_ordered
        for ordered_key in ['picks_ordered', 'bans_ordered']:
            current_ordered = current_team.get(ordered_key, [])
            last_ordered = last_team.get(ordered_key, [])

            if current_ordered != last_ordered:
                changes.append({
                    'field': f"{team_prefix}.{ordered_key}",
                    'old_value': last_ordered,
                    'new_value': current_ordered
                })

        return changes

    def clear_lobby_state(self, lobby_id):
        """Clear stored state for a lobby (e.g., when game ends)"""
        if lobby_id in self.last_states:
            del self.last_states[lobby_id]

# Global state tracker instance
_state_tracker = DraftStateTracker()

# Retry logic system
class RetryManager:
    """Manages retry logic with exponential backoff for Firebase requests"""

    def __init__(self, max_attempts=3, base_delay=1.0, max_delay=30.0, backoff_factor=2.0):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.backoff_factor = backoff_factor

    def classify_error(self, status_code, response_text):
        """Classify error type based on HTTP status and response"""
        if status_code is None:
            return 'network'  # Connection failed entirely
        elif status_code == 429:
            return 'rate_limit'
        elif status_code >= 500:
            return 'server'
        elif status_code == 401 or status_code == 403:
            return 'auth'
        elif status_code >= 400:
            return 'client'
        else:
            return 'unknown'

    def should_retry(self, error_type, attempt_number):
        """Determine if request should be retried based on error type and attempt count"""
        if attempt_number >= self.max_attempts:
            return False

        # Always retry network and server errors
        if error_type in ['network', 'server']:
            return True

        # Retry rate limits with longer delays
        if error_type == 'rate_limit':
            return True

        # Don't retry auth or client errors (4xx except 429)
        return False

    def calculate_delay(self, error_type, attempt_number):
        """Calculate delay before next retry attempt"""
        # Exponential backoff with jitter
        delay = self.base_delay * (self.backoff_factor ** (attempt_number - 1))

        # Add extra delay for rate limiting
        if error_type == 'rate_limit':
            delay *= 2  # Double delay for rate limits

        # Cap at maximum delay
        delay = min(delay, self.max_delay)

        # Add random jitter (±25%) to prevent thundering herd
        import random
        jitter = delay * 0.25 * (random.random() * 2 - 1)  # -25% to +25%
        delay += jitter

        return max(0.1, delay)  # Minimum 100ms delay

    async def execute_with_retry(self, operation_func, operation_name="operation"):
        """Execute an async operation with retry logic"""
        last_error = None

        for attempt in range(1, self.max_attempts + 1):
            try:
                result = await operation_func()
                if attempt > 1:
                    print(f"✓ {operation_name} succeeded on attempt {attempt}")
                return result

            except Exception as e:
                status_code = getattr(e, 'status', None)
                response_text = str(e)
                error_type = self.classify_error(status_code, response_text)
                last_error = e

                if self.should_retry(error_type, attempt):
                    delay = self.calculate_delay(error_type, attempt)
                    print(f"⚠ {operation_name} failed (attempt {attempt}/{self.max_attempts}, {error_type} error): {e}")
                    print(f"   Retrying in {delay:.1f}s...")
                    await asyncio.sleep(delay)
                else:
                    print(f"✗ {operation_name} failed (attempt {attempt}/{self.max_attempts}, {error_type} error, not retrying): {e}")
                    break

        # All retries exhausted
        raise last_error

# Global retry manager instance
_retry_manager = RetryManager()

# Rate limiting system
class RateLimiter:
    """Token bucket rate limiter to prevent Firebase quota exhaustion"""

    def __init__(self, requests_per_second=10, burst_size=20, requests_per_minute=300, requests_per_hour=5000):
        self.requests_per_second = requests_per_second
        self.burst_size = burst_size
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour

        # Token buckets for different time windows
        self.tokens_second = burst_size  # Start with burst allowance
        self.tokens_minute = requests_per_minute
        self.tokens_hour = requests_per_hour

        # Last refill timestamps
        self.last_second_refill = asyncio.get_event_loop().time()
        self.last_minute_refill = asyncio.get_event_loop().time()
        self.last_hour_refill = asyncio.get_event_loop().time()

        # Statistics
        self.requests_made = 0
        self.requests_queued = 0
        self.requests_dropped = 0

    def _refill_tokens(self):
        """Refill token buckets based on elapsed time"""
        current_time = asyncio.get_event_loop().time()

        # Refill per-second tokens
        seconds_elapsed = current_time - self.last_second_refill
        if seconds_elapsed >= 1.0:
            self.tokens_second = min(self.burst_size, self.tokens_second + int(seconds_elapsed * self.requests_per_second))
            self.last_second_refill = current_time

        # Refill per-minute tokens
        minutes_elapsed = (current_time - self.last_minute_refill) / 60.0
        if minutes_elapsed >= 1.0:
            self.tokens_minute = min(self.requests_per_minute, self.tokens_minute + int(minutes_elapsed * self.requests_per_minute))
            self.last_minute_refill = current_time

        # Refill per-hour tokens
        hours_elapsed = (current_time - self.last_hour_refill) / 3600.0
        if hours_elapsed >= 1.0:
            self.tokens_hour = min(self.requests_per_hour, self.tokens_hour + int(hours_elapsed * self.requests_per_hour))
            self.last_hour_refill = current_time

    def can_make_request(self):
        """Check if a request can be made within rate limits"""
        self._refill_tokens()

        # Must have tokens in all buckets
        return (
            self.tokens_second > 0 and
            self.tokens_minute > 0 and
            self.tokens_hour > 0
        )

    def consume_token(self):
        """Consume a token from all buckets (must be called after can_make_request returns True)"""
        if not self.can_make_request():
            return False

        self.tokens_second -= 1
        self.tokens_minute -= 1
        self.tokens_hour -= 1
        self.requests_made += 1

        return True

    async def wait_for_token(self, timeout=30.0):
        """Wait until a token is available, up to timeout seconds"""
        start_time = asyncio.get_event_loop().time()

        while asyncio.get_event_loop().time() - start_time < timeout:
            if self.can_make_request():
                return self.consume_token()
            await asyncio.sleep(0.1)  # Check every 100ms

        return False  # Timeout

    def get_stats(self):
        """Get rate limiter statistics"""
        return {
            'tokens_second': self.tokens_second,
            'tokens_minute': self.tokens_minute,
            'tokens_hour': self.tokens_hour,
            'requests_made': self.requests_made,
            'requests_queued': self.requests_queued,
            'requests_dropped': self.requests_dropped
        }

    def reset_stats(self):
        """Reset statistics counters"""
        self.requests_made = 0
        self.requests_queued = 0
        self.requests_dropped = 0

# Global rate limiter instance
_rate_limiter = RateLimiter()

# Request batching system
class DataBatchManager:
    """Manages batching of data requests to reduce HTTP calls"""

    def __init__(self, batch_window_ms=500, max_batch_size=10):
        self.batch_window_ms = batch_window_ms  # Time window to accumulate data
        self.max_batch_size = max_batch_size    # Maximum items per batch
        self.current_batch = []                 # Current batch of data items
        self.batch_timer = None                 # Timer for batch processing
        self.batch_id_counter = 0               # Unique batch ID counter
        self.current_lobby_id = None            # Track current lobby for batching

    def add_to_batch(self, data_item):
        """Add a data item to the current batch"""
        current_time = asyncio.get_event_loop().time() * 1000  # Convert to milliseconds

        # Create batch item with metadata
        batch_item = {
            'timestamp': current_time,
            'type': data_item.get('type', 'draft'),
            'data': data_item,
            'lobbyId': data_item.get('lobbyId')
        }

        self.current_batch.append(batch_item)

        # Set current lobby ID if not set
        if self.current_lobby_id is None:
            self.current_lobby_id = data_item.get('lobbyId')

        # Check if we should process the batch immediately
        if len(self.current_batch) >= self.max_batch_size:
            self.process_batch_immediately()
        else:
            self.schedule_batch_processing()

    def schedule_batch_processing(self):
        """Schedule batch processing after the time window"""
        if self.batch_timer:
            self.batch_timer.cancel()

        loop = asyncio.get_event_loop()
        self.batch_timer = loop.call_later(
            self.batch_window_ms / 1000.0,  # Convert ms to seconds
            self.process_batch_immediately
        )

    def process_batch_immediately(self):
        """Process the current batch immediately"""
        if not self.current_batch:
            return

        # Cancel any pending timer
        if self.batch_timer:
            self.batch_timer.cancel()
            self.batch_timer = None

        # Create batch data structure
        batch_data = {
            'batchId': f"batch_{self.batch_id_counter}",
            'lobbyId': self.current_lobby_id,
            'workspaceId': self.current_batch[0]['data'].get('workspaceId'),
            'timestamp': asyncio.get_event_loop().time() * 1000,
            'items': self.current_batch.copy(),
            'batchSize': len(self.current_batch)
        }

        self.batch_id_counter += 1

        # Send batch asynchronously
        asyncio.create_task(self.send_batch_async(batch_data))

        # Reset batch
        self.current_batch = []
        self.current_lobby_id = None

    async def send_batch_async(self, batch_data):
        """Send a batch of data items with rate limiting"""
        global last_sent_data_hash

        try:
            print(f"Sending batch {batch_data['batchId']} with {batch_data['batchSize']} items")

            # For now, send each item individually but in parallel with rate limiting
            # TODO: In Phase 3 completion, send as single batch request
            tasks = []
            for item in batch_data['items']:
                # Check rate limit before queuing each request
                if _rate_limiter.can_make_request():
                    _rate_limiter.consume_token()
                    if item['type'] == 'delete':
                        task = asyncio.create_task(send_delete_data_async(item['data']))
                    else:
                        task = asyncio.create_task(send_draft_data_async(item['data']))
                    tasks.append(task)
                else:
                    # Rate limit exceeded - wait for tokens to become available
                    print(f"⚠ Rate limit exceeded for {item['type']} request, waiting for tokens...")
                    try:
                        # Wait up to 30 seconds for tokens to become available
                        token_available = await _rate_limiter.wait_for_token(timeout=30.0)
                        if token_available:
                            if item['type'] == 'delete':
                                task = asyncio.create_task(send_delete_data_async(item['data']))
                            else:
                                task = asyncio.create_task(send_draft_data_async(item['data']))
                            tasks.append(task)
                            print(f"✓ Token acquired, queued {item['type']} request")
                        else:
                            # Still no tokens after timeout - drop this request
                            print(f"⚠ Timeout waiting for rate limit tokens, dropping {item['type']} request for batch {batch_data['batchId']}")
                            _rate_limiter.requests_dropped += 1
                    except Exception as e:
                        print(f"⚠ Error waiting for rate limit tokens: {e}, dropping {item['type']} request")
                        _rate_limiter.requests_dropped += 1

            if not tasks:
                print(f"⚠ No requests sent for batch {batch_data['batchId']} (rate limited)")
                return

            # Wait for all items in batch to complete
            results = await asyncio.gather(*tasks, return_exceptions=True)

            success_count = sum(1 for r in results if not isinstance(r, Exception))

            # Update state tracker and hashes for successful sends
            for i, item in enumerate(batch_data['items']):
                if i < len(results) and not isinstance(results[i], Exception):
                    if item['type'] == 'draft':
                        # Update state tracker with current state for successful sends
                        lobby_id = item['data'].get('lobbyId')
                        if lobby_id:
                            # For full updates, use the data directly
                            if item['data'].get('type') == 'full' and 'data' in item['data']:
                                _state_tracker.update_last_state(lobby_id, item['data']['data'])
                            # For delta updates, we need to reconstruct the full state
                            # For now, we'll skip delta state updates until Phase 4 completion
                            # TODO: Implement delta state reconstruction in Phase 4

                        # Update hash on successful send
                        data_hash = item['data'].get('dataHash')
                        if data_hash:
                            last_sent_data_hash = data_hash

            print(f"Batch {batch_data['batchId']} completed: {success_count}/{len(tasks)} successful")

        except Exception as e:
            print(f"Batch sending failed: {e}")

    def flush_batch(self):
        """Force processing of any remaining batch data"""
        if self.current_batch:
            self.process_batch_immediately()

# Global batch manager instance
_batch_manager = DataBatchManager()

async def get_http_session():
    """Get or create aiohttp session for connection reuse"""
    global _http_session
    if _http_session is None or _http_session.closed:
        _http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10),  # 10 second timeout
            connector=aiohttp.TCPConnector(limit=10, ttl_dns_cache=30)  # Connection pooling
        )
    return _http_session

async def send_data_async(url, data, headers=None):
    """Send data asynchronously to Firebase/Netlify endpoint"""
    session = None
    try:
        session = await get_http_session()
        async with session.post(url, json=data, headers=headers) as response:
            response_text = await response.text()
            return response.status, response_text
    except Exception as e:
        print(f"Async send failed: {e}")
        return None, str(e)
    finally:
        # Don't close session here - it's reused
        pass

async def send_draft_data_async(draft_data):
    """Send draft data asynchronously with retry logic"""
    async def _send_draft():
        status, response_text = await send_data_async(WEB_APP_URL, draft_data, WEB_APP_HEADERS)
        if status != 200:
            # Create a custom exception with status info for retry classification
            error = Exception(f"HTTP {status}: {response_text}")
            error.status = status
            raise error
        return status, response_text

    try:
        return await _retry_manager.execute_with_retry(_send_draft, "draft data send")
    except Exception as e:
        # Return the error info for compatibility
        if hasattr(e, 'status'):
            return e.status, str(e)
        return None, str(e)

async def send_delete_data_async(delete_data):
    """Send delete data asynchronously with retry logic"""
    async def _send_delete():
        status, response_text = await send_data_async(WEB_APP_URL, delete_data, WEB_APP_HEADERS)
        if status != 200:
            # Create a custom exception with status info for retry classification
            error = Exception(f"HTTP {status}: {response_text}")
            error.status = status
            raise error
        return status, response_text

    try:
        return await _retry_manager.execute_with_retry(_send_delete, "delete data send")
    except Exception as e:
        # Return the error info for compatibility
        if hasattr(e, 'status'):
            return e.status, str(e)
        return None, str(e)

async def send_draft_data_async_with_callback(draft_data, data_hash):
    """Send draft data asynchronously and update hash on success"""
    global last_sent_data_hash

    status, response_text = await send_draft_data_async(draft_data)

    if status == 200:
        print("Draft data sent successfully (async)!")
        last_sent_data_hash = data_hash  # Update hash after successful send
    else:
        print(f"Draft data send failed (async): {status} - {response_text}")

async def cleanup_http_session():
    """Clean up the global HTTP session"""
    global _http_session
    if _http_session and not _http_session.closed:
        await _http_session.close()
        _http_session = None
        print("HTTP session cleaned up")


def setup_connector_events(connector):
    """Set up event handlers for the connector"""
    @connector.ready
    async def connect(connection):
        print("LCU connected! Waiting for champion select...")
        # Get initial gameflow phase
        try:
            gameflow_response = await connection.request('get', '/lol-gameflow/v1/gameflow-phase')
            global current_gameflow_phase
            # Handle both string and object responses - extract JSON content if it's a ClientResponse
            if isinstance(gameflow_response, str):
                current_gameflow_phase = gameflow_response
            elif isinstance(gameflow_response, dict):
                current_gameflow_phase = gameflow_response.get('phase') or gameflow_response.get('gameflowPhase')
            elif hasattr(gameflow_response, 'json'):
                # It's a ClientResponse object, extract JSON
                json_data = await gameflow_response.json()
                current_gameflow_phase = json_data if isinstance(json_data, str) else json_data.get('phase') or json_data.get('gameflowPhase')
            else:
                current_gameflow_phase = str(gameflow_response) if gameflow_response else None
            print(f"Initial gameflow phase: {current_gameflow_phase}")
        except Exception as e:
            print(f"Could not get initial gameflow phase: {e}")
            current_gameflow_phase = None

        # Start the sleeping loop as an async task
        asyncio.create_task(sleeping_loop(connection))

    @connector.ws.register('/lol-gameflow/v1/gameflow-phase', event_types=('UPDATE',))
    async def gameflow_phase_updated(connection, event):
        """Track gameflow phase to detect if game actually started or champion select was cancelled"""
        global current_gameflow_phase, last_lobby_id, last_sent_data_hash

        previous_phase = current_gameflow_phase

        if event.data:
            # Handle both string and object responses
            if isinstance(event.data, str):
                current_gameflow_phase = event.data
            elif isinstance(event.data, dict):
                current_gameflow_phase = event.data.get('phase') or event.data.get('gameflowPhase')
            else:
                current_gameflow_phase = str(event.data)
            print(f"Gameflow phase updated: {previous_phase} -> {current_gameflow_phase}")

        # If phase changed from ChampSelect to Lobby/None, champion select was cancelled
        # Delete the data if we have a lobby_id tracked
        if previous_phase == 'ChampSelect' and current_gameflow_phase in ['Lobby', 'None']:
            if last_lobby_id:
                print(f"Champion select cancelled detected via phase change (lobby {last_lobby_id}, phase: {current_gameflow_phase}) - deleting data from database")
                # Send delete request asynchronously
                delete_data = {
                    'lobbyId': str(last_lobby_id),
                    'workspaceId': workspace_id,
                    'action': 'delete'
                }
                # Create background task for async delete
                asyncio.create_task(send_delete_data_async(delete_data))
                print("Delete request queued (async)")
                last_lobby_id = None
                last_sent_data_hash = None

    @connector.ws.register('/lol-champ-select/v1/session', event_types=('CREATE', 'UPDATE', 'DELETE'))
    async def champ_select_updated(connection, event):
        global last_lobby_id, last_sent_data_hash, current_gameflow_phase

        # Handle DELETE event (champion select ended or quit)
        if event.data is None:
            print("Champion select ended or quit.")

            # Get current gameflow phase to determine if game started or was cancelled
            # Try to get fresh phase data in case there was a timing issue
            gameflow_phase_to_check = current_gameflow_phase
            try:
                # Try to get current phase directly (more reliable)
                phase_response = await connection.request('get', '/lol-gameflow/v1/gameflow-phase')
                if isinstance(phase_response, str):
                    gameflow_phase_to_check = phase_response
                elif isinstance(phase_response, dict):
                    gameflow_phase_to_check = phase_response.get('phase') or phase_response.get('gameflowPhase')
                else:
                    gameflow_phase_to_check = str(phase_response) if phase_response else current_gameflow_phase
            except Exception as e:
                print(f"Could not get current gameflow phase, using cached: {e}")

            # Check gameflow phase to determine if game started or champion select was cancelled
            # Delete data only if: "None", "Lobby", or "ChampSelect" (champion select was cancelled before game started)
            # Keep data for everything else (InProgress, GameEnd, etc.) - for fearless mode stacking
            if last_lobby_id:
                cancellation_phases = ['None', 'Lobby', 'ChampSelect']
                if gameflow_phase_to_check in cancellation_phases:
                    print(f"Champion select cancelled (lobby {last_lobby_id}, phase: {gameflow_phase_to_check}) - deleting data from database")
                    # Send delete request asynchronously
                    delete_data = {
                        'lobbyId': str(last_lobby_id),
                        'workspaceId': workspace_id,
                        'action': 'delete'
                    }
                    # Create background task for async delete
                    asyncio.create_task(send_delete_data_async(delete_data))
                    print("Delete request queued (async)")
                else:
                    print(f"Game data kept (lobby {last_lobby_id}, phase: {gameflow_phase_to_check}) - keeping data in database for fearless mode stacking")

            last_lobby_id = None
            last_sent_data_hash = None
            return

        # Check if event data exists
        session_data = event.data
        if not session_data:
            print("Champion select ended.")
            last_lobby_id = None
            return

        # Extract relevant data from the session
        try:
            # Get unique lobby/session ID - same for all players in the same champion select
            # Try gameId first (most reliable), fallback to chatRoomName or teamChatRoomId
            lobby_id = (
                session_data.get('gameId') or
                session_data.get('chatRoomName') or
                session_data.get('teamChatRoomId') or
                session_data.get('id')
            )

            if not lobby_id:
                print("Warning: No lobby ID found, skipping data send")
                return

            phase = session_data.get('timer', {}).get('phase', 'UNKNOWN')

            # Detect new game: phase is PLANNING OR lobby ID changed OR no previous lobby
            is_new_game = False

            # New game if: phase is PLANNING, or lobby ID changed, or this is the first lobby we've seen
            if phase == 'PLANNING' or last_lobby_id is None:
                is_new_game = True
                print(f"New game detected (Phase: {phase}, First lobby: {last_lobby_id is None})")
                last_sent_data_hash = None  # Reset tracking for new game
            elif last_lobby_id != lobby_id:
                print(f"New lobby detected (was {last_lobby_id}, now {lobby_id}) - treating as new game")
                is_new_game = True
                last_sent_data_hash = None

            last_lobby_id = lobby_id

            my_team = session_data.get('myTeam', [])
            their_team = session_data.get('theirTeam', [])
            actions = session_data.get('actions', [])

            # Initialize data structures
            all_actions = []  # Will store all actions with order information
            all_picks_from_teams = {}  # Dict to track all picks from team arrays: {cellId: championId}
            blue_side_picks = []
            red_side_picks = []
            blue_side_bans = []
            red_side_bans = []

            # First, extract all picks from team arrays (includes bot picks that might not be in actions)
            # This ensures we capture all champions, even if they were instantly picked
            for player in my_team + their_team:
                cell_id = player.get('cellId', -1)
                champion_id = player.get('championId', 0)
                if cell_id >= 0 and champion_id and champion_id != 0:
                    all_picks_from_teams[cell_id] = str(champion_id)
                    # Determine side and add to simple lists
                    side = 'blue' if cell_id < 5 else 'red'
                    if side == 'blue':
                        if str(champion_id) not in blue_side_picks:
                            blue_side_picks.append(str(champion_id))
                    else:
                        if str(champion_id) not in red_side_picks:
                            red_side_picks.append(str(champion_id))

            # Extract all actions (bans and picks) with order information
            # Actions is a 2D array: [team][action_index]
            actions_by_cell = {}  # Track which actions correspond to which cellId
            if actions:
                for team_actions in actions:
                    if not team_actions:
                        continue
                    for action in team_actions:
                        action_type = action.get('type')  # 'ban' or 'pick'
                        champion_id = action.get('championId', 0)
                        actor_cell_id = action.get('actorCellId', -1)
                        action_id = action.get('id', -1)
                        pick_turn = action.get('pickTurn', -1)
                        completed = action.get('completed', False)

                        # Process bans (always from actions)
                        if action_type == 'ban' and completed and champion_id and champion_id != 0:
                            # Determine which side based on actorCellId
                            side = 'blue' if actor_cell_id >= 0 and actor_cell_id < 5 else 'red'

                            action_data = {
                                'type': 'ban',
                                'championId': str(champion_id),
                                'side': side,
                                'cellId': actor_cell_id,
                                'actionId': action_id,
                                'pickTurn': pick_turn
                            }

                            all_actions.append(action_data)

                            # Add to simple lists
                            if side == 'blue':
                                if str(champion_id) not in blue_side_bans:
                                    blue_side_bans.append(str(champion_id))
                            else:
                                if str(champion_id) not in red_side_bans:
                                    red_side_bans.append(str(champion_id))

                        # Process picks - track them for order matching
                        elif action_type == 'pick' and completed and champion_id and champion_id != 0:
                            if actor_cell_id >= 0:
                                # Store action data keyed by cellId for matching
                                actions_by_cell[actor_cell_id] = {
                                    'championId': str(champion_id),
                                    'actionId': action_id,
                                    'pickTurn': pick_turn,
                                    'side': 'blue' if actor_cell_id < 5 else 'red'
                                }

            # Now create ordered pick list by matching team picks with actions
            # For picks that have actions, use action order data
            # For picks without actions (like bot instant picks), add them without order data
            picks_with_order = []
            picks_without_order = []

            for cell_id, champion_id in all_picks_from_teams.items():
                side = 'blue' if cell_id < 5 else 'red'
                if cell_id in actions_by_cell:
                    # Pick has action data, use it for ordering
                    action_data = actions_by_cell[cell_id]
                    picks_with_order.append({
                        'type': 'pick',
                        'championId': champion_id,
                        'side': side,
                        'cellId': cell_id,
                        'actionId': action_data['actionId'],
                        'pickTurn': action_data['pickTurn']
                    })
                else:
                    # Pick doesn't have action data (likely bot instant pick)
                    picks_without_order.append({
                        'type': 'pick',
                        'championId': champion_id,
                        'side': side,
                        'cellId': cell_id,
                        'actionId': -1,
                        'pickTurn': -1,
                        'noOrderData': True  # Flag to indicate this pick wasn't tracked in order
                    })

            # Sort picks with order by pickTurn
            picks_with_order_sorted = sorted(
                picks_with_order,
                key=lambda x: (x['pickTurn'] if x['pickTurn'] >= 0 else x['actionId'], x['actionId'])
            )

            # Combine ordered picks with unordered picks (unordered go at the end)
            all_picks_ordered = picks_with_order_sorted + picks_without_order

            # Separate bans and picks with order
            bans_ordered = [a for a in all_actions if a['type'] == 'ban']
            bans_ordered_sorted = sorted(
                bans_ordered,
                key=lambda x: (x['pickTurn'] if x['pickTurn'] >= 0 else x['actionId'], x['actionId'])
            )

            # Group by side for easier access
            blue_bans_ordered = [a for a in bans_ordered_sorted if a['side'] == 'blue']
            red_bans_ordered = [a for a in bans_ordered_sorted if a['side'] == 'red']
            blue_picks_ordered = [a for a in all_picks_ordered if a['side'] == 'blue']
            red_picks_ordered = [a for a in all_picks_ordered if a['side'] == 'red']

            # Simplify ordered data - only keep championId and order (remove cellId, pickTurn, etc.)
            def simplify_ordered_list(ordered_list):
                return [{'championId': item['championId'], 'order': idx + 1}
                       for idx, item in enumerate(ordered_list)]

            # Format the draft data - simplified format
            draft_data = {
                'lobbyId': str(lobby_id),
                'workspaceId': workspace_id,  # Include workspace ID
                'phase': phase,
                'blue_side': {
                    'picks': blue_side_picks,  # All champion IDs
                    'bans': blue_side_bans,    # All champion IDs
                    'picks_ordered': simplify_ordered_list(blue_picks_ordered),  # Ordered with just championId and order
                    'bans_ordered': simplify_ordered_list(blue_bans_ordered)      # Ordered with just championId and order
                },
                'red_side': {
                    'picks': red_side_picks,  # All champion IDs
                    'bans': red_side_bans,    # All champion IDs
                    'picks_ordered': simplify_ordered_list(red_picks_ordered),  # Ordered with just championId and order
                    'bans_ordered': simplify_ordered_list(red_bans_ordered)      # Ordered with just championId and order
                }
            }

            # Only send if there are NEW completed actions (not just hovering/selection)
            # Check if there are any completed actions in the actions array (not just team picks)
            has_completed_actions_in_actions = False
            completed_action_ids = set()

            if actions:
                for team_actions in actions:
                    if not team_actions:
                        continue
                    for action in team_actions:
                        if action.get('completed', False) and action.get('championId', 0) != 0:
                            has_completed_actions_in_actions = True
                            action_id = action.get('id', -1)
                            if action_id >= 0:
                                completed_action_ids.add(action_id)

            # Create hash of current data to detect changes
            data_str = f"{lobby_id}:{phase}:{sorted(blue_side_bans)}:{sorted(red_side_bans)}:{sorted(blue_side_picks)}:{sorted(red_side_picks)}"
            current_data_hash = hashlib.md5(data_str.encode()).hexdigest()

            # Only send if:
            # 1. It's a new game (CREATE event or PLANNING phase)
            # 2. There are NEW completed actions (data hash changed)
            # 3. It's finalization phase
            is_final_phase = phase in ['FINALIZATION', 'FINALIZE']
            data_changed = current_data_hash != last_sent_data_hash

            should_send = (
                is_new_game or  # New game detected
                (has_completed_actions_in_actions and data_changed) or  # New completed action
                is_final_phase  # Final phase
            )

            if should_send:
                # Generate delta update instead of full state
                delta_data = _state_tracker.generate_delta(lobby_id, draft_data)

                if delta_data is None:
                    # No changes detected
                    print(f"No changes detected for lobby {lobby_id}")
                    return

                # Prepare data for sending
                if delta_data['type'] == 'full':
                    # First time for this lobby - send full state
                    send_data = draft_data.copy()
                    send_data['isNewGame'] = is_new_game
                    send_data['dataHash'] = current_data_hash
                    print(f"Full state extracted (Phase: {phase}, Lobby: {lobby_id}, New Game: {is_new_game})")
                else:
                    # Delta update
                    send_data = delta_data.copy()
                    send_data['workspaceId'] = workspace_id
                    send_data['dataHash'] = current_data_hash
                    print(f"Delta update generated ({len(delta_data['changes'])} changes, Phase: {phase}, Lobby: {lobby_id})")

                # Add to batch manager
                _batch_manager.add_to_batch(send_data)
                print("Data added to batch")
            else:
                if not has_completed_actions_in_actions:
                    print(f"Skipping send - no completed actions yet (Phase: {phase})")
                elif not data_changed:
                    print(f"Skipping send - no data changes detected (hovering/selection only)")
        except (KeyError, TypeError, AttributeError) as e:
            print(f"Error extracting draft data: {e}")
            print(f"Event data structure: {type(session_data)} - {session_data}")
            return

    @connector.close
    async def disconnect(_):
        print("LCU disconnected.")
        # Flush any remaining batches
        _batch_manager.flush_batch()
        # Clean up HTTP session
        await cleanup_http_session()

# Main entry point
if __name__ == "__main__":
    # Authenticate workspace before starting
    if not prompt_workspace_credentials():
        print("Exiting...")
        exit(1)

    # Detect League clients
    print("\nDetecting League of Legends clients...")
    clients = detect_league_clients()

    # Select which client to connect to
    selected_client = select_league_client(clients)
    if not selected_client:
        print("No client selected. Exiting...")
        exit(1)

    # Create connector for the selected client
    print(f"Connecting to {selected_client['description']}...")
    connector = Connector()

    # Set up event handlers for the connector
    setup_connector_events(connector)

    print("\n" + "="*60)
    print("LCU Client started! Press Ctrl+C to stop.")
    print("="*60 + "\n")

    # Start the connector and keep the script running
    # The sleeping loop will be started automatically when the connector connects
    try:
        connector.start()
    except KeyboardInterrupt:
        print("Shutting down...")
