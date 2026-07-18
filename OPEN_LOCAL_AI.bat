@echo off
title Telephantim Dual Brains (Ollama)
cd /d "%~dp0"

echo.
echo  Stopping anything already on port 8765...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8765 ^| findstr LISTENING') do (
  taskkill /F /PID %%p >nul 2>&1
)

echo  Starting dual-mind AI server...
echo  Mjolnir + Caduceus keep memory and talk for real.
echo  Site: http://127.0.0.1:8765/
echo.

start "" "http://127.0.0.1:8765/?v=28"
python server.py
if errorlevel 1 (
  echo Python failed.
  pause
)
