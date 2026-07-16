@echo off
setlocal
title CPAMI Form Editor - SQLite Templates

set "APP_DIR=%~dp0cpami-form-editor"
set "APP_URL=http://127.0.0.1:8766"
set "LISTEN_HOST=0.0.0.0"

if not exist "%APP_DIR%\sqlite_server.py" (
    echo ERROR: Cannot find cpami-form-editor\sqlite_server.py.
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

echo Starting CPAMI Form Editor with shared SQLite templates...
echo Local URL: %APP_URL%
echo Network listening address: %LISTEN_HOST%:8766
echo Private LAN clients can connect without a token; public clients still require one.
echo Full cases remain in each browser and are not stored in SQLite.
echo Keep this window open while using the editor.
echo Press Ctrl+C in this window to stop the server.
echo.

start "" /b cmd /c "ping 127.0.0.1 -n 2 ^>nul ^& start %APP_URL%"
python -X utf8 sqlite_server.py --host %LISTEN_HOST% --port 8766

if errorlevel 1 (
    echo.
    echo The CPAMI SQLite template server stopped with an error.
    pause
)

endlocal
