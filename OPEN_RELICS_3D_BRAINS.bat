@echo off
title Telephantim Relics 3D + Dual Brains
cd /d "%~dp0"

echo.
echo  === Telephantim dual brains (local) ===
echo  Mjolnir = llama3.2   Caduceus = hermes3  (Ollama)
echo  Also loads XAI/Grok key from nearby .env if present
echo.

REM Ensure Ollama is up
where ollama >nul 2>&1
if errorlevel 1 (
  echo  Ollama not in PATH. Install/start Ollama, then re-run.
  pause
  exit /b 1
)

echo  Checking Ollama...
curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
if errorlevel 1 (
  echo  Starting Ollama app...
  start "" "ollama" serve
  timeout /t 3 /nobreak >nul
)

echo  Freeing port 8765 if busy...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8765 ^| findstr LISTENING') do (
  taskkill /F /PID %%p >nul 2>&1
)

echo  Starting server.py ...
start "Telephantim AI" cmd /k "cd /d "%~dp0" && python server.py"

timeout /t 2 /nobreak >nul
echo  Opening local Relics hub with brains...
start "" "http://127.0.0.1:8765/?v=59"

echo.
echo  LIVE public site (telephantim.com) needs Render service telephantim-ai
echo  which is currently 404 — use THIS local window for real dual talk.
echo  Free cloud path: see SETUP_RENDER_BRAINS.txt  (Groq key)
echo.
exit /b 0
