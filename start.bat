@echo off
title IT Ticket System
cd /d "%~dp0"

if not exist ".env" (
    copy .env.example .env >nul
    echo [Created .env file - open it to change port]
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
if not exist "data\uploads" mkdir data\uploads >nul 2>&1
if not exist "data\logs" mkdir data\logs >nul 2>&1

cls
echo.
echo  ===========================================
echo     IT Ticket System
echo  ===========================================
echo.
echo  [1] Development mode (hot reload)
echo  [2] Production mode  (faster)
echo.
set /p mode="Select mode (1/2): "
if "%mode%"=="2" goto prod

:dev
echo.
echo  Starting in DEV mode...
echo  Backend: http://localhost:3000
echo  App:     http://localhost:5173
echo.
call npm run dev
pause
exit /b

:prod
echo.
echo  Building frontend...
call npm run build
echo.
echo  Starting in PRODUCTION mode...
echo  App: http://localhost:3000
echo.
set NODE_ENV=production
node src/backend/server.js
pause
