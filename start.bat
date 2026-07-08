@echo off
title Hubly
cd /d "%~dp0"

if not exist ".env" copy .env.example .env >nul
if not exist "node_modules" call npm install
if not exist "data\uploads" mkdir data\uploads data\logs 2>nul

set PORT=3000
for /f "tokens=2 delims==" %%a in ('findstr /b "PORT=" .env 2^>nul') do set PORT=%%a

cls
echo.
echo  ===========================================
echo     Hubly — Ticket System
echo  ===========================================
echo.
echo  Current Port: %PORT%
echo.
echo  [1] Start App
echo  [2] Change Port
echo  [3] Exit
echo.
set /p ch="Select (1-3): "
if "%ch%"=="2" goto chport
if "%ch%"=="3" exit /b

:start
echo.
echo  Building...
call npm run build
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
pause
exit /b

:chport
echo.
set /p np="Enter port number (e.g. 3000): "
if "%np%"=="" goto chport
echo PORT=%np%> .env
echo.
echo Port changed to %np%. Starting...
set PORT=%np%
goto start
