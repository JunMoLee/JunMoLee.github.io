@echo off
REM One-click local editor launcher. Double-click this file (or make a
REM desktop shortcut to it) to start the editing server and open the site
REM straight into edit mode. See README "Live in-browser editing".

cd /d "%~dp0"

start "Website Editor Server" cmd /k python tools\dev_server.py 8080

timeout /t 2 /nobreak >nul

start "" "http://localhost:8080/?edit=1"
