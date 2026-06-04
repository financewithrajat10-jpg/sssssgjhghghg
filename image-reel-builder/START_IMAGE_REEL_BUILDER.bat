@echo off
setlocal

cd /d "%~dp0"

if "%PORT%"=="" set "PORT=4010"
if "%FFMPEG_PATH%"=="" if exist "C:\tmp\ffmpeg-portable\bin\ffmpeg.exe" set "FFMPEG_PATH=C:\tmp\ffmpeg-portable\bin\ffmpeg.exe"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 18 or newer, then run this file again.
  pause
  exit /b 1
)

echo Starting Image Reel Builder on http://localhost:%PORT%
start "" "http://localhost:%PORT%"
node server.mjs

echo.
echo Server stopped.
pause
