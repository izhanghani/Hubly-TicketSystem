@echo off
title Hubly — Ticket System
cd /d "%~dp0"

if not exist ".env" copy .env.example .env >nul 2>&1
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed!
    pause
    exit /b 1
  )
)
if not exist "data\uploads" mkdir data\uploads 2>nul
if not exist "data\logs" mkdir data\logs 2>nul

set PORT=3000
for /f "tokens=2 delims==" %%a in ('findstr /b "PORT=" .env 2^>nul') do set PORT=%%a

cls
echo.
echo  ===========================================
echo     Hubly — Ticket System
echo  ===========================================
echo.
echo  Port: %PORT%
echo.
echo  [1] Start (Development - Hot Reload)
echo  [2] Start (Production - Build + Serve)
echo  [3] Exit
echo.
set /p ch="Select (1-3): "

if "%ch%"=="1" goto dev
if "%ch%"=="2" goto prod
if "%ch%"=="3" goto end

:dev
cls
echo.
echo  Starting in Development Mode...
echo  Frontend : http://localhost:5173
echo  Backend  : http://localhost:%PORT%
echo.
timeout /t 2 /nobreak >nul
start http://localhost:5173
node "%~dp0start.js" --dev
goto end

:prod
cls
echo.
echo  Building for production...
call npm run build
if errorlevel 1 (
  echo Build failed!
  pause
  exit /b 1
)
cls
echo.
echo  ===========================================
echo     Hubly — Ticket System
echo  ===========================================
echo.
echo  App running at: http://localhost:%PORT%
echo.
set NODE_ENV=production
start http://localhost:%PORT%
node src/backend/server.js
goto end

:end
pause
