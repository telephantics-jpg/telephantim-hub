@echo off
title Telephantix Unified Server
cd /d "%~dp0"

echo.
echo  ============================================
echo   TELEPHANTIX — one server (hub + camp)
echo  ============================================
echo.
echo  Keep Ollama running in the background.
echo  Then open:  http://127.0.0.1:8765/
echo.
echo  Admin:      http://127.0.0.1:8765/admin/
echo  Password:   telephantix
echo.
echo  Do NOT start server.py or Luna uvicorn separately.
echo  ============================================
echo.

set PREFER_OLLAMA=1
set PREFER_CLOUD=0
set LUNA_LLM_BACKEND=ollama
set LUNA_FORCE_OLLAMA=1
if not defined ADMIN_PASSWORD set ADMIN_PASSWORD=telephantix
if not defined PORT set PORT=8765

python unified_server.py
if errorlevel 1 (
  echo.
  echo  Failed — is Python installed? Is port %PORT% free?
  pause
)
