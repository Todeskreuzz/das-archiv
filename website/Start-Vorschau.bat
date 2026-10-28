@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js wurde nicht gefunden.
  echo   Bitte von https://nodejs.org installieren, dann erneut starten.
  echo.
  pause
  exit /b 1
)

echo.
echo   DAS ARCHIV wird geoeffnet ...
echo   Bruecke: http://localhost:4780
echo.

start "Archiv-Bruecke" cmd /c "node scripts\bridge.mjs"
timeout /t 3 >nul
start "" http://localhost:4780
