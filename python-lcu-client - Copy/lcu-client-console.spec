# -*- mode: python ; coding: utf-8 -*-

import os
import sys

# Add current directory to path for imports
current_dir = os.path.dirname(os.path.abspath(SPEC))

a = Analysis(
    ['lcu-client-console.py'],
    pathex=[current_dir],
    binaries=[],
    datas=[
        # DO NOT include workspace config file - it should be external for security
        # ('workspace_config.json', '.'),  # Commented out for security
        # Include the application icon
        ('lcu_client.ico', '.'),
    ],
    hiddenimports=[
        # LCU driver and related modules
        'lcu_driver',
        'lcu_driver.connection',
        'lcu_driver.connector',
        'lcu_driver.events',
        'lcu_driver.events.managers',

        # Asyncio and networking
        'asyncio',
        'aiohttp',
        'aiohttp.client',
        'aiohttp.client_reqrep',
        'aiohttp.client_exceptions',
        'yarl',
        'multidict',

        # Other dependencies
        'requests',
        'hashlib',
        'json',
        'logging',

        # PIL for icon
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',

        # Threading and system modules
        'threading',
        'queue',
        'os',
        'sys',
        'ctypes',  # For Windows API calls
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude unnecessary modules to reduce size
        'tkinter',
        'tkinter.scrolledtext',
        'tkinter.messagebox',
        'test',
        'unittest',
        'pdb',
        'pydoc',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

# Check for background mode argument to determine console visibility
import sys
console_visible = True
if len(sys.argv) > 1:
    for arg in sys.argv[1:]:
        if arg in ['--background', '-b']:
            console_visible = False
            break

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='LCU-Client-Console',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=console_visible,  # Hide console window in background mode
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='lcu_client.ico',  # Application icon
)
