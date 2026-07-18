@echo off
title Telephantim PUBLIC dual brains (Ollama for any browser)
cd /d "%~dp0"

echo.
echo  ================================================
echo   PUBLIC dual minds - anyone on telephantim.com
echo   Mjolnir = llama3.2   Caduceus = hermes3
echo   Your PC must stay ON with this window open.
echo  ================================================
echo.

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo cloudflared not found. Install with:
  echo   winget install Cloudflare.cloudflared
  pause
  exit /b 1
)

echo  Stopping old listeners on 8765...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8765 ^| findstr LISTENING') do (
  taskkill /F /PID %%p >nul 2>&1
)

echo  Starting dual-mind server.py ...
start "telephantim-ai" /MIN cmd /c "cd /d "%~dp0" && python server.py"

echo  Waiting for server...
timeout /t 3 /nobreak >nul

echo  Opening Cloudflare public tunnel...
echo  (Leave this window open. Closing it disconnects every visitor.)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_publish_tunnel.ps1"
if errorlevel 1 (
  echo Tunnel publish failed.
  pause
  exit /b 1
)

echo.
echo  Done. Visitors on https://telephantim.com can use dual Ollama brains
echo  while THIS PC is on and this tunnel is running.
echo.
pause
