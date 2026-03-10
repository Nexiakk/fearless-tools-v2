@echo off
echo Building Fearless LCU Tools Executable...

:: Ensure we are in the correct directory
cd /d "%~dp0"

:: Clean previous builds
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist main.spec del /q main.spec

:: Run PyInstaller
pyinstaller ^
    --name "Fearless LCU Tools" ^
    --noconsole ^
    --onefile ^
    --noconfirm ^
    --paths src ^
    --hidden-import "qasync" ^
    --hidden-import "lcu_driver" ^
    --hidden-import "websockets" ^
    --log-level=INFO ^
    src/main.py

echo.
echo Build complete! Executable is located in lcu-client\dist\
