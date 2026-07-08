@echo off
title IT Ticket System
cd /d "%~dp0.."

if not exist ".env" (
    copy .env.example .env >nul
    echo Created .env file. Open .env to change port and other settings.
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
if not exist "data\uploads" mkdir data\uploads >nul 2>&1
if not exist "data\logs" mkdir data\logs >nul 2>&1

echo.
echo Building frontend...
call npm run build

:: Read port from .env
set PORT=3000
for /f "tokens=2 delims==" %%a in ('findstr /b "PORT=" .env 2^>nul') do set PORT=%%a

echo.
echo ===========================================
echo  IT Ticket System
echo  Running on: http://localhost:%PORT%
echo ===========================================
echo.
echo Close this window to stop the server.
echo.

set NODE_ENV=production
node src/backend/server.js
pause
