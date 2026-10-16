@echo off
title Recipe App
cd /d "%~dp0"
echo Starting the Recipe App...
echo Keep this window open while you use the app. Close it to stop.
echo.
start "" http://localhost:5173
node serve.js
pause
