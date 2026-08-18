@echo off
title Telephantix Studio local (hub + ACE-Step)
cd /d "%~dp0"

echo.
echo  Starting Studio stack...
echo    Hub      http://127.0.0.1:8765/#studio
echo    ACE-Step http://127.0.0.1:8001
echo.

REM Hub — only start if :8765 is free
netstat -ano | findstr ":8765" | findstr LISTENING >nul
if errorlevel 1 (
  start "telephantim-hub" /MIN cmd /c "cd /d "%~dp0" && python server.py"
  echo  [+] hub started
) else (
  echo  [=] hub already listening on 8765
)

REM ACE-Step — only start if :8001 is free
netstat -ano | findstr ":8001" | findstr LISTENING >nul
if errorlevel 1 (
  start "ACE-Step Studio" "%~dp0START_ACE_STEP.bat"
  echo  [+] ACE-Step starting
) else (
  echo  [=] ACE-Step already listening on 8001
)

timeout /t 3 /nobreak >nul
echo.
echo  Open: http://127.0.0.1:8765/#studio
echo  Keep the ACE-Step window open for vocals.
echo.
start "" "http://127.0.0.1:8765/#studio"
pause
