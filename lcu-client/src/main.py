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
sys.path.insert(0, str(Path(__file__).parent))

from config_manager import get_config_manager
from gui.app import LCUClientApp

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

async def main_async(app: LCUClientApp):
    app.setup_ui()
    # The qasync loop runs forever until stopped

def main():
    """Main entry point for LCU Desktop App"""
    debug_mode = '--debug' in sys.argv or '-d' in sys.argv
    setup_logging(debug_mode)
    
    # Remove CLI args so PySide doesn't complain
    for arg in ['--debug', '-d']:
        if arg in sys.argv:
            sys.argv.remove(arg)
            
    try:
        app = LCUClientApp(debug=debug_mode)
        
        # Setup qasync Event Loop
        loop = qasync.QEventLoop(app.app)
        asyncio.set_event_loop(loop)
        
        with loop:
            loop.run_until_complete(main_async(app))
            # Just executing loop.run_forever() is enough since main_async doesn't block
            loop.run_forever()
            
    except Exception as e:
        logger.error(f"Fatal error starting app: {e}", exc_info=True)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
