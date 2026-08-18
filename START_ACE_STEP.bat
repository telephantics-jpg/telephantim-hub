@echo off
REM Telephantix — start open-source ACE-Step API (vocals + up to 10-min songs)
REM Hub Studio talks to http://127.0.0.1:8001
REM For random website visitors: keep this running + tunnel the hub (or set ACESTEP_API_BASE on Render to your tunnel URL)

setlocal
cd /d "%~dp0"

set "ACE_ROOT=%USERPROFILE%\ACE-Step-1.5"
if not exist "%ACE_ROOT%\pyproject.toml" (
  echo [!] ACE-Step not found at %ACE_ROOT%
  echo     Clone it: git clone --depth 1 https://github.com/ACE-Step/ACE-Step-1.5.git "%ACE_ROOT%"
  echo     Then: cd "%ACE_ROOT%" ^&^& uv sync
  pause
  exit /b 1
)

REM RTX 4060 8GB-friendly defaults
set ACESTEP_CONFIG_PATH=acestep-v15-turbo
set ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-0.6B
set ACESTEP_LM_BACKEND=pt
set ACESTEP_API_HOST=0.0.0.0
set ACESTEP_API_PORT=8001
set ACESTEP_OFFLOAD_TO_CPU=true
set ACESTEP_INIT_LLM=true
REM Put ffmpeg on PATH so mp3 export works (we default to wav anyway)
set "PATH=%USERPROFILE%\AppData\Local\Programs\Python\Python312\Scripts;%PATH%"
for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin") do set "PATH=%%D;%PATH%"

echo.
echo  === ACE-Step API for Telephantix Studio ===
echo  Vocals + 10s..10min songs  ·  http://127.0.0.1:8001
echo  Writes audio under .cache\acestep\tmp\api_audio then hub copies to media\studio-gen
echo  First run downloads models from Hugging Face (one-time).
echo  Keep this window open while visitors Create songs.
echo.

cd /d "%ACE_ROOT%"
where uv >nul 2>&1
if errorlevel 1 (
  if exist "%USERPROFILE%\AppData\Local\hermes\bin\uv.exe" (
    "%USERPROFILE%\AppData\Local\hermes\bin\uv.exe" run acestep-api
  ) else (
    echo [!] uv not found. Install: powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
    pause
    exit /b 1
  )
) else (
  uv run acestep-api
)

pause
