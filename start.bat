@echo off
title Chronex Dashboard
echo ======================================================
echo    CHRONEX -- Economic & Session Countdown Dashboard
echo ======================================================
echo.
echo Starting local server and opening browser...
start "" "http://localhost:3000"
node server.js
pause
