@echo off
title Telephantix.com hub (local)
cd /d "%~dp0public"

echo.
echo  TELEPHANTIX HUB (local preview)
echo  --------------------------------
echo  Full site:   http://localhost:8765/
echo  Luna Camp:   https://telephanti.com/firmament/play
echo.
echo  To put this on telephantix.com see GO_LIVE_TELEPHANTIX.md
echo.

start "" "http://localhost:8765/"
python -m http.server 8765
if errorlevel 1 (
  echo Python not found — opening file...
  start "" "%~dp0public\index.html"
  pause
)
