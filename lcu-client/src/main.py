#!/usr/bin/env python3
"""
LCU Client Desktop App - Direct monitoring of League of Legends champion select.
"""

import sys
import logging
import asyncio
from pathlib import Path
import qasync

# Add src to path for imports
script_dir = Path(__file__).parent.absolute()
if str(script_dir) not in sys.path:
    sys.path.insert(0, str(script_dir))

from config_manager import get_config_manager
from gui.app import LCUClientApp
from gui.qt_logger import QtLogHandler

logger = logging.getLogger(__name__)

def setup_logging(debug: bool = False) -> QtLogHandler:
    """Configure logging with optional debug mode and return the Qt handler"""
    level = logging.DEBUG if debug else logging.INFO
    format_str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Standard console handler
    console_handler = logging.StreamHandler(sys.stdout)
    
    # Custom Qt handler
    qt_handler = QtLogHandler()
    formatter = logging.Formatter(format_str)
    qt_handler.setFormatter(formatter)
    
    logging.basicConfig(
        level=level,
        format=format_str,
        handlers=[
            console_handler,
            qt_handler
        ]
    )
    
    # Set level for specific loggers
    logging.getLogger('lcu_monitor').setLevel(level)
    logging.getLogger('data_transmitter').setLevel(level)
    
    return qt_handler

async def main_async(app: LCUClientApp):
    app.setup_ui()
    # The qasync loop runs forever until stopped

def main():
    """Main entry point for LCU Desktop App"""
    debug_mode = '--debug' in sys.argv or '-d' in sys.argv
    qt_handler = setup_logging(debug_mode)
    
    # Remove CLI args so PySide doesn't complain
    for arg in ['--debug', '-d']:
        if arg in sys.argv:
            sys.argv.remove(arg)
            
    try:
        app = LCUClientApp(debug=debug_mode)
        
        # Connect the Qt log handler to the app's newly created UI (to be linked in app.py)
        # We will map it to app.connect_logger(qt_handler) in app.py
        app.qt_handler = qt_handler
        
        # Setup qasync Event Loop
        loop = qasync.QEventLoop(app.app)
        asyncio.set_event_loop(loop)
        
        with loop:
            # Schedule the main async setup task
            loop.create_task(main_async(app))
            loop.run_forever()
            
    except Exception as e:
        logger.error(f"Fatal error starting app: {e}", exc_info=True)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
