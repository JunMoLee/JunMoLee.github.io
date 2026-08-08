@echo off
REM One-click local editor launcher. Double-click this file (or make a
REM desktop shortcut to it) to start the editing server and open the site
REM straight into edit mode.

cd /d "%~dp0"

start "Website Editor Server" cmd /k python tools\dev_server.py 8090

timeout /t 2 /nobreak >nul

start "" "http://localhost:8090/?edit=1"
