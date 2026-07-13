@echo off
setlocal
title CPAMI Form Editor

set "APP_DIR=%~dp0cpami-form-editor"
set "APP_URL=http://127.0.0.1:8765"
set "LISTEN_HOST=0.0.0.0"

if not exist "%APP_DIR%\server.py" (
    echo ERROR: Cannot find cpami-form-editor\server.py.
    echo Keep this BAT file in the BOOKTIRE project folder.
    pause
    exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python was not found in PATH.
    echo Install Python 3 or add python.exe to PATH, then try again.
    pause
    exit /b 1
)

cd /d "%APP_DIR%"

echo Starting CPAMI Form Editor...
echo Local URL: %APP_URL%
echo Network listening address: %LISTEN_HOST%:8765
echo Remote URLs and the required access token will appear below.
echo Windows Firewall and router port forwarding are not changed automatically.
echo Keep this window open while using the editor.
echo Press Ctrl+C in this window to stop the server.
echo.

start "" /b cmd /c "ping 127.0.0.1 -n 2 ^>nul ^& start %APP_URL%"
python -X utf8 server.py --host %LISTEN_HOST% --port 8765

if errorlevel 1 (
    echo.
    echo The CPAMI Form Editor stopped with an error.
    pause
)

endlocal
