@echo off
cd /d "%~dp0"
call npm install --no-audit --no-fund
if errorlevel 1 exit /b 1
start "" http://localhost:3000
call npm start
