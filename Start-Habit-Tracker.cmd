@echo off
title Habit Tracker
cd /d "%~dp0"

set "GH=gh"
where gh >nul 2>&1 || set "GH=%LOCALAPPDATA%\Microsoft\WinGet\Links\gh.exe"

"%GH%" auth status -h github.com >nul 2>&1
if errorlevel 1 (
  echo GitHub login is missing or expired.
  echo Please authorize GitHub in the browser window that opens.
  "%GH%" auth login -h github.com --git-protocol https --web --skip-ssh-key
  if errorlevel 1 (
    echo GitHub authorization failed.
    pause
    exit /b 1
  )
)

python sync_server.py
if errorlevel 1 pause
