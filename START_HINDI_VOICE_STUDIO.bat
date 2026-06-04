@echo off
setlocal

cd /d "%~dp0"

if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" set "%%A=%%B"
  )
)

if "%PORT%"=="" set "PORT=3000"

if "%GEMINI_API_KEY%"=="" if "%GOOGLE_API_KEY%"=="" (
  echo.
  echo GEMINI_API_KEY is not set.
  echo.
  echo Create a .env file in this folder with:
  echo GEMINI_API_KEY=your_google_ai_studio_key_here
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 18 or newer, then run this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)

echo Starting Hindi Voice Studio on http://localhost:%PORT%
start "" "http://localhost:%PORT%"
node server.mjs

echo.
echo Server stopped.
pause
