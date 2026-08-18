@echo off
title Telephantim PUBLIC Studio (ACE-Step vocals for visitors)
cd /d "%~dp0"

echo.
echo  ================================================
echo   PUBLIC Studio vocals - free Cloudflare tunnel
echo   Needs: ACE-Step GPU worker + hub server.py
echo   Your PC must stay ON with this window open.
echo  ================================================
echo.

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo cloudflared not found. Install free:
  echo   winget install Cloudflare.cloudflared
  pause
  exit /b 1
)

echo  [1/3] Starting ACE-Step on :8001 ...
start "ACE-Step Studio" "%~dp0START_ACE_STEP.bat"

echo  [2/3] Starting hub server.py on :8765 ...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8765 ^| findstr LISTENING') do (
  taskkill /F /PID %%p >nul 2>&1
)
start "telephantim-ai" /MIN cmd /c "cd /d "%~dp0" && python server.py"
timeout /t 4 /nobreak >nul

echo  [3/3] Opening Cloudflare tunnel + publishing api-config ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_publish_tunnel.ps1"
if errorlevel 1 (
  echo Tunnel publish failed.
  pause
  exit /b 1
)

echo.
echo  Done. Visitors: https://telephantim.com/#studio
echo  Hard refresh (Ctrl+F5). Create songs while this PC is on.
echo  Songs save under media\studio-gen and show in Your songs.
echo.
pause
