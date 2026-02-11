#!/usr/bin/env python3
"""
Simple LCU Client - Direct monitoring of League of Legends champion select.
Run this script to start monitoring LCU for draft data.
"""

import logging
import signal
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    from config_manager import get_config_manager
    from lcu_monitor import get_lcu_monitor
except ImportError:
    from .config_manager import get_config_manager
    from .lcu_monitor import get_lcu_monitor

# Setup logging - will be configured in main based on --debug flag
logger = logging.getLogger(__name__)


def setup_logging(debug: bool = False):
    """Configure logging with optional debug mode"""
    level = logging.DEBUG if debug else logging.INFO
    format_str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    logging.basicConfig(
        level=level,
        format=format_str,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Set level for specific loggers
    logging.getLogger('lcu_monitor').setLevel(level)
    logging.getLogger('data_transmitter').setLevel(level)
    
    if debug:
        print("🔍 DEBUG mode enabled - verbose logging active")


def main():
    """Main entry point for LCU monitoring"""
    print("🤖 Fearless Tools LCU Client v1.0.0")
    print("=" * 50)

    # Check for debug flag first (before other processing)
    debug_mode = '--debug' in sys.argv or '-d' in sys.argv
    setup_logging(debug_mode)
    
    # Remove debug flags from argv so they don't interfere with other commands
    if '--debug' in sys.argv:
        sys.argv.remove('--debug')
    if '-d' in sys.argv:
        sys.argv.remove('-d')

    # Initialize configuration
    config_manager = get_config_manager()

    # Handle command line arguments
    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command in ['--clear-credentials', '-c']:
            print("🗑️  Clearing saved workspace credentials...")
            if config_manager.clear_saved_credentials():
                print("✅ Credentials cleared successfully")
                return 0
            else:
                print("❌ Failed to clear credentials")
                return 1

        elif command in ['--setup-credentials', '-s']:
            print("🔐 Setting up new workspace credentials...")
            try:
                workspace_id, password_hash = config_manager.prompt_workspace_credentials()
                return 0
            except KeyboardInterrupt:
                print("\n👋 Setup cancelled by user")
                return 1
            except Exception as e:
                print(f"❌ Failed to setup credentials: {e}")
                return 1

        elif command in ['--test-credentials', '-t']:
            print("🔍 Testing saved workspace credentials...")
            workspace_id = config_manager.get_workspace_id()
            password_hash = config_manager.get_password_hash()

            if not workspace_id or not password_hash:
                print("❌ No saved credentials found. Run --setup-credentials first.")
                return 1

            is_valid, message = config_manager.validate_credentials_with_server(workspace_id, password_hash)

            if is_valid:
                print("✅ " + message)
                return 0
            else:
                print("❌ " + message)
                print("💡 Run --setup-credentials to update your credentials")
                return 1

        elif command in ['--help', '-h']:
            print_usage()
            return 0

        else:
            print(f"❌ Unknown command: {command}")
            print_usage()
            return 1

    # Check if we have saved credentials, otherwise prompt user
    workspace_id = config_manager.get_workspace_id()
    password_hash = config_manager.get_password_hash()

    if not workspace_id or not password_hash:
        print("🔐 No saved workspace credentials found.")
        try:
            workspace_id, password_hash = config_manager.prompt_workspace_credentials()
            # print(f"✅ Credentials saved for workspace: {workspace_id}")
        except KeyboardInterrupt:
            print("\n👋 Setup cancelled by user")
            return 1
        except Exception as e:
            print(f"❌ Failed to setup credentials: {e}")
            return 1
    else:
        print(f"✅ Using saved credentials for workspace: {workspace_id}")

    # Validate basic configuration
    validation_errors = config_manager.validate_workspace_config()
    if validation_errors:
        print("❌ Configuration validation failed:")
        for field, error in validation_errors.items():
            print(f"  - {field}: {error}")
        return 1

    print("✅ Configuration validated")

    # Initialize monitor
    monitor = get_lcu_monitor()

    # Handle graceful shutdown
    def signal_handler(signum, frame):
        print("\n🛑 Shutdown signal received...")
        print("LCU Client will shut down gracefully...")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        print("\n🚀 Starting LCU monitoring...")
        print("Make sure League of Legends client is running!")
        print("Press Ctrl+C to stop\n")

        # Start monitoring (this will run the event loop and block)
        success = monitor.start()
        if not success:
            print("❌ Failed to start LCU monitoring")
            return 1

        # This point should never be reached as monitor.start() runs the event loop
        return 0

    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        return 0
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        print(f"\n❌ Fatal error: {e}")
        return 1


def print_usage():
    """Print usage information"""
    print("🤖 Fearless Tools LCU Client v1.0.0")
    print("\nUsage:")
    print("  python main.py                        # Start LCU monitoring")
    print("  python main.py --debug                 # Start with verbose debug logging")
    print("  python main.py --setup-credentials        # Setup workspace credentials")
    print("  python main.py --test-credentials         # Test saved credentials")
    print("  python main.py --clear-credentials        # Clear saved credentials")
    print("  python main.py --help                  # Show this help")
    print("\nRequirements:")
    print("- League of Legends client must be running")
    print("- Python dependencies must be installed (pip install -r requirements.txt)")
    print("- Workspace credentials must be configured")
    print("\nExamples:")
    print("  python main.py --setup-credentials      # First time setup")
    print("  python main.py --test-credentials       # Verify credentials work")
    print("  python main.py --debug                  # Start with full debug logging")
    print("  python main.py                          # Start monitoring")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help']:
        print_usage()
        sys.exit(0)

    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)
