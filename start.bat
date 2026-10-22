@echo off
cd /d "%~dp0"
call npm install --no-audit --no-fund
start "" http://localhost:3000
node server.js
