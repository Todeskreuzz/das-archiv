@echo off
cd /d "%~dp0"
echo.
echo   DAS ARCHIV wird geoeffnet ...
echo.
start "Archiv-Server" cmd /c "node scripts\bridge.mjs"
timeout /t 2 >nul
start "" http://localhost:4780
