@echo off
setlocal
cd /d "%~dp0"
title Women Rise Legacy - Install Packages

echo ==================================================
echo WOMEN RISE LEGACY - PACKAGE INSTALLER
echo ==================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Install Node.js 22 LTS or a version newer than 20.19, then run this file again.
  pause
  exit /b 1
)

echo Node version:
node --version
echo.

if not exist "client\.env" (
  copy /Y "client\.env.example" "client\.env" >nul
  echo Created client\.env from example.
)
if not exist "server\.env" (
  copy /Y "server\.env.example" "server\.env" >nul
  echo Created server\.env from example.
)

echo.
echo Installing frontend and backend packages...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: Package installation failed. Check your internet connection and npm output above.
  pause
  exit /b 1
)

echo.
echo SUCCESS: Packages installed.
echo NEXT: Add Supabase keys to client\.env and server\.env, run the SQL migration, then double-click 2-start-project.bat.
pause
