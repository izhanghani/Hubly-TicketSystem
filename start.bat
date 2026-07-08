@echo off
title IT Ticket System Pro
cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
if not exist "data\uploads" mkdir data\uploads >nul 2>&1
if not exist "data\logs" mkdir data\logs >nul 2>&1

echo Starting IT Ticket System Pro...
echo.
echo Backend API: http://localhost:3000
echo App:        http://localhost:5173
echo.
echo Close this window to stop the server.
echo.
call npm run dev
pause
