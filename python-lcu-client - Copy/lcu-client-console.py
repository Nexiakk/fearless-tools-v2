#!/usr/bin/env python3
"""
LCU Client Console Application
A lightweight console application with system tray support for League of Legends LCU monitoring.
"""

import threading
import os
import sys
import time
import pystray
from PIL import Image, ImageDraw
import asyncio
import ctypes
from ctypes import wintypes

# Import our LCU client logic
import lcu_client

class LCUConsoleApp:
    def __init__(self, show_startup_messages=True, background_mode=False):
        self.tray_icon = None
        self.hidden = background_mode  # Start hidden in background mode
        self.running = threading.Event()
        self.monitoring = threading.Event()
        self.monitor_thread = None
        self.tray_thread = None
        self.background_mode = background_mode
        self.minimized_mode = background_mode  # Start in minimized mode if background
        self.thread_priority_set = False  # Track if we've set thread priority

        # Set up console window
        self.setup_console()

        # Set up tray icon
        self.setup_tray_icon()

        # Start monitoring immediately (not tied to LCU client)
        self.start_monitoring()

        # In background mode, minimize immediately and reduce output
        if background_mode:
            self.hide_console()
            show_startup_messages = False

        if show_startup_messages:
            print("LCU Client Console Application")
            print("=" * 40)
            print("Press Ctrl+C to exit")
            print()

    def setup_console(self):
        """Configure console window properties"""
        try:
            # Try to set console title
            os.system("title LCU Client")
        except Exception as e:
            print(f"Warning: Could not set console title: {e}")

    def setup_tray_icon(self):
        """Set up system tray icon"""
        # Create a simple icon
        icon_image = Image.new('RGB', (64, 64), color='blue')
        draw = ImageDraw.Draw(icon_image)
        draw.rectangle([16, 16, 48, 48], fill='white')

        # Create static menu - dynamic behavior handled in actions
        self.tray_icon = pystray.Icon(
            "lcu_client_console",
            icon_image,
            "LCU Client",
            menu=pystray.Menu(
                pystray.MenuItem("Toggle Console", self.toggle_console, default=True),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Exit", self.quit_application)
            )
        )

    def toggle_console(self, message=None, title=None):
        """Toggle console visibility on tray icon click/double-click"""
        if self.hidden:
            self.show_console()
        else:
            self.hide_console()

    def start_monitoring(self):
        """Start the minimize monitoring thread"""
        if self.monitor_thread and self.monitor_thread.is_alive():
            return  # Already running

        self.monitoring.set()
        self.monitor_thread = threading.Thread(target=self._monitor_minimize, daemon=True)
        self.monitor_thread.start()

    def stop_monitoring(self):
        """Stop the minimize monitoring thread"""
        self.monitoring.clear()
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=1.0)

    def _monitor_minimize(self):
        """Monitor window state and intercept minimize events with dynamic resource optimization"""
        try:
            consecutive_errors = 0
            max_consecutive_errors = 5

            while self.monitoring.is_set():
                try:
                    # Check if console window is minimized
                    hwnd = ctypes.windll.kernel32.GetConsoleWindow()
                    if hwnd:
                        # Get window placement to check if minimized
                        class WINDOWPLACEMENT(ctypes.Structure):
                            _fields_ = [
                                ('length', wintypes.UINT),
                                ('flags', wintypes.UINT),
                                ('showCmd', wintypes.UINT),
                                ('ptMinPosition', wintypes.POINT),
                                ('ptMaxPosition', wintypes.POINT),
                                ('rcNormalPosition', wintypes.RECT),
                                ('rcDevice', wintypes.RECT),
                            ]

                        placement = WINDOWPLACEMENT()
                        placement.length = ctypes.sizeof(WINDOWPLACEMENT)

                        if ctypes.windll.user32.GetWindowPlacement(hwnd, ctypes.byref(placement)):
                            # SW_SHOWMINIMIZED = 2
                            is_minimized = placement.showCmd == 2

                            # Dynamic resource mode switching based on window state
                            if is_minimized and not self.hidden and not self.minimized_mode:
                                # Window just got minimized - switch to low resource mode
                                self._switch_to_minimized_mode()
                            elif not is_minimized and not self.hidden and self.minimized_mode:
                                # Window just got restored - switch to normal resource mode
                                self._switch_to_normal_mode()

                            if placement.showCmd == 2 and not self.hidden:
                                # Window was minimized, hide to tray instead
                                self.hide_console()
                                consecutive_errors = 0  # Reset error count on success
                        else:
                            consecutive_errors += 1
                    else:
                        # Console window not available, stop monitoring
                        break

                    # Dynamic polling interval based on current mode
                    base_interval = 0.5 if self.minimized_mode else 0.1

                    # Adaptive sleep based on error rate
                    if consecutive_errors > 0:
                        sleep_time = min(base_interval * (2 ** consecutive_errors), 5.0)  # Exponential backoff, max 5s
                    else:
                        sleep_time = base_interval

                    time.sleep(sleep_time)

                except Exception as e:
                    consecutive_errors += 1
                    # Only show errors in normal mode, not minimized mode
                    if consecutive_errors <= max_consecutive_errors and not self.minimized_mode:
                        print(f"Warning: Minimize monitoring error: {e}")
                    time.sleep(min(0.1 * (2 ** consecutive_errors), 5.0))  # Exponential backoff

        except Exception as e:
            if not self.minimized_mode:
                print(f"Fatal monitoring error: {e}")

    def _switch_to_minimized_mode(self):
        """Switch to low-resource minimized mode"""
        if not self.minimized_mode:
            self.minimized_mode = True
            try:
                # Lower thread priority for background operation
                thread_handle = ctypes.windll.kernel32.GetCurrentThread()
                ctypes.windll.kernel32.SetThreadPriority(thread_handle, -1)  # THREAD_PRIORITY_BELOW_NORMAL
                self.thread_priority_set = True
                if not self.background_mode:  # Don't spam in background mode
                    print("Switched to low-resource mode (window minimized)")
            except:
                pass  # Silently fail if priority setting doesn't work

    def _switch_to_normal_mode(self):
        """Switch to normal resource mode"""
        if self.minimized_mode:
            self.minimized_mode = False
            try:
                # Restore normal thread priority
                thread_handle = ctypes.windll.kernel32.GetCurrentThread()
                ctypes.windll.kernel32.SetThreadPriority(thread_handle, 0)  # THREAD_PRIORITY_NORMAL
                self.thread_priority_set = False
                if not self.background_mode:  # Don't spam in background mode
                    print("Switched to normal resource mode (window restored)")
            except:
                pass  # Silently fail if priority setting doesn't work

    def show_console(self):
        """Show the console window"""
        if self.hidden:
            try:
                # Try to restore console window (Windows specific)
                import ctypes
                hwnd = ctypes.windll.kernel32.GetConsoleWindow()
                ctypes.windll.user32.ShowWindow(hwnd, 9)  # SW_RESTORE

                # Bring window to foreground and give it focus
                ctypes.windll.user32.SetForegroundWindow(hwnd)
                ctypes.windll.user32.BringWindowToTop(hwnd)
                ctypes.windll.user32.SetFocus(hwnd)

                self.hidden = False
            except Exception as e:
                print(f"Could not restore console window: {e}")

    def hide_console(self):
        """Hide the console window to system tray"""
        try:
            # Try to hide console window (Windows specific)
            import ctypes
            ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)  # SW_HIDE
            self.hidden = True

            # Start tray icon if not already running
            if not hasattr(self, '_tray_thread') or not self._tray_thread or not self._tray_thread.is_alive():
                self._tray_thread = threading.Thread(target=self._run_tray_icon, daemon=True)
                self._tray_thread.start()
        except:
            print("Could not minimize console window.")

    def _start_tray_icon(self):
        """Start the tray icon if not already running"""
        if not hasattr(self, '_tray_thread') or not self._tray_thread or not self._tray_thread.is_alive():
            self._tray_thread = threading.Thread(target=self._run_tray_icon, daemon=True)
            self._tray_thread.start()

    def _run_tray_icon(self):
        """Run the tray icon (called in separate thread)"""
        try:
            self.tray_icon.run()
        except Exception as e:
            print(f"Tray icon error: {e}")

    def start_lcu_client(self):
        """Start the LCU client"""
        if hasattr(self, 'lcu_thread') and self.lcu_thread and self.lcu_thread.is_alive():
            print("LCU Client is already running.")
            return

        self.running.set()
        self.lcu_thread = threading.Thread(target=self._run_lcu_client, daemon=True)
        self.lcu_thread.start()

    def stop_lcu_client(self):
        """Stop the LCU client"""
        print("Stopping LCU Client...")
        self.running.clear()

        # Wait a moment for clean shutdown
        time.sleep(2)
        print("LCU Client stopped.")

    def _run_lcu_client(self):
        """Run the LCU client logic (called in separate thread)"""
        try:
            # Set up event loop for this thread (required for lcu_driver)
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            print("Detecting League of Legends clients...")

            # Detect League clients
            clients = lcu_client.detect_league_clients()

            # Select which client to connect to
            selected_client = lcu_client.select_league_client(clients)
            if not selected_client:
                print("No client selected. LCU client will not start.")
                return

            # Create connector for the selected client
            print(f"Connecting to {selected_client['description']}...")
            from lcu_driver import Connector
            connector = Connector()

            # Set up event handlers for the connector
            lcu_client.setup_connector_events(connector)

            # Note: lcu_driver connector manages its own event loop
            # We don't need to create a separate one

            try:
                # Start the connector (this will block until interrupted)
                # This call should never return unless there's an error
                connector.start()

            except KeyboardInterrupt:
                print("\nLCU Client stopped by user.")
            except Exception as e:
                print(f"LCU Client error: {e}")
                print("Make sure League of Legends client is running!")
                import traceback
                traceback.print_exc()

        except Exception as e:
            print(f"Fatal error in LCU client thread: {e}")
            import traceback
            traceback.print_exc()

    def quit_application(self):
        """Quit the entire application"""
        print("Shutting down LCU Client Console Application...")

        # Stop monitoring thread
        self.stop_monitoring()

        # Stop LCU client
        self.running.clear()

        # Stop tray icon if running
        if self.tray_icon:
            try:
                self.tray_icon.stop()
                print("Tray icon stopped.")
            except Exception as e:
                print(f"Warning: Error stopping tray icon: {e}")

        # Wait for threads to finish
        if hasattr(self, 'lcu_thread') and self.lcu_thread and self.lcu_thread.is_alive():
            print("Waiting for LCU client to stop...")
            self.lcu_thread.join(timeout=5.0)
            if self.lcu_thread.is_alive():
                print("LCU client thread did not stop cleanly.")

        if self.monitor_thread and self.monitor_thread.is_alive():
            print("Waiting for monitoring thread to stop...")
            self.monitor_thread.join(timeout=2.0)

        print("Application shutdown complete.")
        sys.exit(0)

    def run(self, show_commands=True):
        """Main application loop"""
        if show_commands:
            print("LCU Client Console Application Started")
            print("Commands:")
            print("  start  - Start LCU monitoring")
            print("  stop   - Stop LCU monitoring")
            print("  exit   - Exit application")
            print()

        # Start tray icon immediately
        self._start_tray_icon()

        try:
            while True:
                try:
                    cmd = input("LCU> ").strip().lower()
                except (EOFError, KeyboardInterrupt):
                    print("\nExiting...")
                    break

                if cmd == "start":
                    try:
                        self.start_lcu_client()
                    except Exception as e:
                        print(f"Error starting LCU client: {e}")
                        import traceback
                        traceback.print_exc()
                elif cmd == "stop":
                    self.stop_lcu_client()
                elif cmd == "exit":
                    self.quit_application()
                    break
                elif cmd in ["help", "h", "?"]:
                    print("Available commands:")
                    print("  start  - Start LCU monitoring")
                    print("  stop   - Stop LCU monitoring")
                    print("  exit   - Exit application")
                    print("  help   - Show this help")
                else:
                    print(f"Unknown command: {cmd}")
                    print("Type 'help' for available commands.")

        except KeyboardInterrupt:
            print("\nShutting down...")
        finally:
            self.quit_application()

def main():
    """Main entry point"""
    import argparse

    # Parse command line arguments
    parser = argparse.ArgumentParser(description='LCU Client Console Application')
    parser.add_argument('--background', '-b', action='store_true',
                       help='Run in background mode (hidden console, optimized for background operation)')
    parser.add_argument('--silent', '-s', action='store_true',
                       help='Silent mode (minimal output)')
    args = parser.parse_args()

    # Handle authentication in main thread before starting console app
    auth_result = lcu_client.authenticate_only()

    if not auth_result[0]:  # auth_result is (success, message)
        print("Authentication failed. Exiting...")
        return

    # If we get here, authentication was successful
    # Check if config was loaded automatically (no user interaction needed)
    config_loaded = lcu_client.load_workspace_config()

    background_mode = args.background
    silent_mode = args.silent or background_mode

    # Always show authentication success message
    workspace_name = auth_result[1]
    if not silent_mode:
        print(f"✓ Authenticated successfully! Workspace: {workspace_name}")
        print()

    # Create console app (no auto-start of LCU client)
    app = LCUConsoleApp(show_startup_messages=not silent_mode, background_mode=background_mode)
    app.run(show_commands=not silent_mode)

if __name__ == "__main__":
    main()
