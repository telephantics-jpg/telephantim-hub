@echo off
title Telephantim AI (Ollama)
cd /d "%~dp0"

echo.
echo  Stopping anything already on port 8765...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8765 ^| findstr LISTENING') do (
  taskkill /F /PID %%p >nul 2>&1
)

echo  Starting AI server (NOT plain http.server)...
echo  Site: http://127.0.0.1:8765/
echo  Status must say telephantim-ai
echo.

start "" "http://127.0.0.1:8765/"
python server.py
if errorlevel 1 (
  echo Python failed.
  pause
)
