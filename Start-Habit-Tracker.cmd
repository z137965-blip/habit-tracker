@echo off
cd /d "%~dp0"
python sync_server.py
if errorlevel 1 pause
