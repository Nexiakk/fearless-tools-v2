"""
Configuration management for LCU client.
Handles workspace authentication and app settings.
"""

import os
import json
import logging
import hashlib
import getpass
import time
import requests
from typing import Dict, Optional, Any, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)


class ConfigManager:
    """Manages configuration files and settings"""

    def __init__(self, config_dir: Optional[str] = None):
        self.config_dir = Path(config_dir) if config_dir else Path(__file__).parent.parent / "config"
        self.config_dir.mkdir(parents=True, exist_ok=True)

        # Config file paths
        self.workspace_config = self.config_dir / "workspace.json"
        self.settings_config = self.config_dir / "settings.json"

        # Rate limiting for auth attempts
        self._auth_attempts = []
        self._max_attempts_per_minute = 3
        self._lockout_duration = 300  # 5 minutes

    def _load_json_file(self, file_path: Path) -> Dict[str, Any]:
        """Load JSON file safely"""
        if not file_path.exists():
            return {}

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Failed to load config file {file_path}: {e}")
            return {}

    def _save_json_file(self, file_path: Path, data: Dict[str, Any]) -> bool:
        """Save JSON file safely"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except IOError as e:
            logger.error(f"Failed to save config file {file_path}: {e}")
            return False

    def get_workspace_config(self) -> Dict[str, Any]:
        """Get workspace authentication configuration"""
        return self._load_json_file(self.workspace_config)

    def set_workspace_config(self, workspace_id: str, api_key: Optional[str] = None) -> bool:
        """Set workspace authentication configuration"""
        config = {
            "workspaceId": workspace_id,
            "apiKey": api_key
        }
        return self._save_json_file(self.workspace_config, config)

    def get_workspace_id(self) -> Optional[str]:
        """Get current workspace ID"""
        config = self.get_workspace_config()
        return config.get("workspaceId")

    def get_api_key(self) -> Optional[str]:
        """Get API key for external services"""
        config = self.get_workspace_config()
        return config.get("apiKey")



    def get_settings(self) -> Dict[str, Any]:
        """Get application settings"""
        settings = self._load_json_file(self.settings_config)

        # Default settings
        defaults = {
            "lcu": {
                "auto_detect_client": True,
                "preferred_port": 21076,
                "use_tournament_client": False,
                "connection_timeout": 30
            },
            "transmission": {
                "endpoint_url": "https://fearless-tuls.netlify.app/.netlify/functions/lcuDraft",
                "batch_size": 10,
                "batch_timeout_seconds": 1,
                "retry_attempts": 3,
                "retry_delay_seconds": 2
            },
            "monitoring": {
                "champ_select_interval": 1,
                "lobby_interval": 10,
                "active_game_interval": 60,
                "enable_change_detection": True
            },
            "logging": {
                "level": "INFO",
                "file_logging": False,
                "log_file": "lcu_client.log"
            },
            "ui": {
                "minimize_to_tray": True,
                "show_notifications": True,
                "start_minimized": False
            }
        }

        # Merge with defaults
        return self._deep_merge(defaults, settings)

    def set_settings(self, settings: Dict[str, Any]) -> bool:
        """Update application settings"""
        current_settings = self.get_settings()
        updated_settings = self._deep_merge(current_settings, settings)
        return self._save_json_file(self.settings_config, updated_settings)

    def _deep_merge(self, base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
        """Deep merge two dictionaries"""
        result = base.copy()

        for key, value in update.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value

        return result

    def get_lcu_settings(self) -> Dict[str, Any]:
        """Get LCU-specific settings"""
        return self.get_settings().get("lcu", {})

    def get_transmission_settings(self) -> Dict[str, Any]:
        """Get transmission settings"""
        return self.get_settings().get("transmission", {})

    def get_monitoring_settings(self) -> Dict[str, Any]:
        """Get monitoring settings"""
        return self.get_settings().get("monitoring", {})

    def get_logging_settings(self) -> Dict[str, Any]:
        """Get logging settings"""
        return self.get_settings().get("logging", {})

    def get_ui_settings(self) -> Dict[str, Any]:
        """Get UI settings"""
        return self.get_settings().get("ui", {})

    def is_configured(self) -> bool:
        """Check if the client is properly configured"""
        workspace_id = self.get_workspace_id()

        # Basic validation
        if not workspace_id:
            return False

        # Check if we have API endpoint configured
        transmission_settings = self.get_transmission_settings()
        endpoint_url = transmission_settings.get("endpoint_url")

        return bool(endpoint_url)

    def create_default_configs(self) -> bool:
        """Create default configuration files if they don't exist"""
        success = True

        # Create default workspace config if it doesn't exist
        if not self.workspace_config.exists():
            default_workspace = {
                "workspaceId": "",
                "passwordHash": ""
            }
            success &= self._save_json_file(self.workspace_config, default_workspace)

        # Create default settings if they don't exist
        if not self.settings_config.exists():
            success &= self.set_settings({})

        return success

    def validate_workspace_config(self) -> Dict[str, str]:
        """Validate workspace configuration and return any errors"""
        errors = {}

        workspace_id = self.get_workspace_id()
        if not workspace_id:
            errors["workspaceId"] = "Workspace ID is required"

        transmission_settings = self.get_transmission_settings()
        endpoint_url = transmission_settings.get("endpoint_url")

        if not endpoint_url:
            errors["connection"] = "Endpoint URL must be configured"

        return errors

    def _hash_password(self, password: str) -> str:
        """Hash password using SHA-256 (same as web app)"""
        return hashlib.sha256(password.encode()).hexdigest()

    def prompt_workspace_credentials(self) -> Tuple[str, str]:
        """Prompt user for workspace ID and password"""
        print("\n🤖 Fearless Tools LCU Client - Workspace Setup")
        print("=" * 50)

        # Get saved credentials
        saved_id = self.get_workspace_id()
        saved_hash = self.get_password_hash()

        if saved_id and saved_hash:
            print(f"📁 Found saved credentials for workspace: {saved_id}")
            use_saved = input("Use saved credentials? (y/n): ").lower().strip()
            if use_saved == 'y':
                return saved_id, saved_hash

        # Prompt for new credentials
        print("\nEnter your workspace credentials (same as web app):")
        workspace_id = input("Workspace ID: ").strip()

        while not workspace_id:
            print("❌ Workspace ID cannot be empty")
            workspace_id = input("Workspace ID: ").strip()

        password = getpass.getpass("Workspace Password: ")

        while not password:
            print("❌ Password cannot be empty")
            password = getpass.getpass("Workspace Password: ")

        # Hash password
        password_hash = self._hash_password(password)

        # Save credentials
        self.save_workspace_credentials(workspace_id, password_hash)

        return workspace_id, password_hash

    def save_workspace_credentials(self, workspace_id: str, password_hash: str) -> bool:
        """Save workspace credentials to config"""
        config = {
            "workspaceId": workspace_id,
            "passwordHash": password_hash
        }
        return self._save_json_file(self.workspace_config, config)

    def get_password_hash(self) -> Optional[str]:
        """Get saved password hash"""
        config = self.get_workspace_config()
        return config.get("passwordHash")

    def clear_saved_credentials(self) -> bool:
        """Clear saved workspace credentials"""
        config = {
            "workspaceId": "",
            "passwordHash": ""
        }
        return self._save_json_file(self.workspace_config, config)

    def _is_rate_limited(self) -> bool:
        """Check if authentication attempts are rate limited"""
        current_time = time.time()

        # Clean up old attempts (older than 1 minute)
        self._auth_attempts = [t for t in self._auth_attempts if current_time - t < 60]

        # Check if we've exceeded the limit
        if len(self._auth_attempts) >= self._max_attempts_per_minute:
            return True

        return False

    def _record_auth_attempt(self):
        """Record an authentication attempt for rate limiting"""
        self._auth_attempts.append(time.time())

    def _get_lockout_remaining(self) -> int:
        """Get remaining lockout time in seconds"""
        if not self._auth_attempts:
            return 0

        current_time = time.time()
        oldest_attempt = min(self._auth_attempts)

        if current_time - oldest_attempt < self._lockout_duration:
            return int(self._lockout_duration - (current_time - oldest_attempt))

        return 0

    def validate_credentials_with_server(self, workspace_id: str, password_hash: str) -> Tuple[bool, str]:
        """Validate credentials with the server before saving"""
        # Check rate limiting first
        if self._is_rate_limited():
            lockout_remaining = self._get_lockout_remaining()
            return False, f"Too many authentication attempts. Try again in {lockout_remaining} seconds."

        # Record the attempt
        self._record_auth_attempt()

        try:
            transmission_settings = self.get_transmission_settings()
            endpoint_url = transmission_settings.get("endpoint_url")

            if not endpoint_url:
                return False, "No endpoint URL configured"

            # Remove trailing slash if present
            base_url = endpoint_url.rstrip('/')

            # Make validation request
            params = {
                'action': 'validate',
                'workspaceId': workspace_id,
                'passwordHash': password_hash
            }

            response = requests.get(
                base_url,
                params=params,
                timeout=10,
                headers={'User-Agent': 'LCU-Client/1.0.0'}
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get('success'):
                        return True, "Credentials validated successfully"
                    else:
                        return False, "Invalid workspace credentials"
                except json.JSONDecodeError:
                    return False, "Invalid server response"
            elif response.status_code == 401:
                return False, "Invalid workspace credentials"
            elif response.status_code == 404:
                return False, "Workspace not found"
            elif response.status_code == 429:
                return False, "Too many requests - please wait"
            else:
                return False, f"Server error ({response.status_code})"

        except requests.exceptions.Timeout:
            return False, "Connection timeout - check your internet connection"
        except requests.exceptions.ConnectionError:
            return False, "Connection failed - check your internet connection"
        except Exception as e:
            logger.error(f"Unexpected error validating credentials: {e}")
            return False, "Unexpected error occurred"

    def prompt_workspace_credentials(self) -> Tuple[str, str]:
        """Prompt user for workspace ID and password with server validation"""
        print("\n🤖 Fearless Tools LCU Client - Workspace Setup")
        print("=" * 50)

        # Get saved credentials
        saved_id = self.get_workspace_id()
        saved_hash = self.get_password_hash()

        if saved_id and saved_hash:
            print(f"📁 Found saved credentials for workspace: {saved_id}")
            use_saved = input("Use saved credentials? (y/n): ").lower().strip()
            if use_saved == 'y':
                return saved_id, saved_hash

        # Prompt for new credentials with validation
        while True:
            print("\nEnter your workspace credentials (same as web app):")

            workspace_id = input("Workspace ID: ").strip()
            if not workspace_id:
                print("❌ Workspace ID cannot be empty")
                continue

            password = getpass.getpass("Workspace Password: ")
            if not password:
                print("❌ Password cannot be empty")
                continue

            # Hash password
            password_hash = self._hash_password(password)

            # Validate with server
            print("🔍 Validating credentials with server...")
            is_valid, message = self.validate_credentials_with_server(workspace_id, password_hash)

            if is_valid:
                print("✅ " + message)
                # Save credentials
                self.save_workspace_credentials(workspace_id, password_hash)
                print(f"💾 Credentials saved for workspace: {workspace_id}")
                return workspace_id, password_hash
            else:
                print("❌ " + message)
                retry = input("Try different credentials? (y/n): ").lower().strip()
                if retry != 'y':
                    raise KeyboardInterrupt("User cancelled setup")

    def validate_credentials_locally(self, workspace_id: str, password: str) -> bool:
        """Validate credentials against saved ones (for local checking)"""
        saved_id = self.get_workspace_id()
        saved_hash = self.get_password_hash()

        if not saved_id or not saved_hash:
            return False

        return workspace_id == saved_id and self._hash_password(password) == saved_hash


# Global instance
_config_manager = ConfigManager()

def get_config_manager() -> ConfigManager:
    """Get the global configuration manager instance"""
    return _config_manager
