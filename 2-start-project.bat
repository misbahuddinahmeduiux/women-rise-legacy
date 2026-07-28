@echo off
setlocal
cd /d "%~dp0"
title Women Rise Legacy - Start Project

if not exist "node_modules" (
  echo Packages are not installed. Run 1-install-packages.bat first.
  pause
  exit /b 1
)
if not exist "client\.env" (
  echo Missing client\.env. Run 1-install-packages.bat first and configure Supabase keys.
  pause
  exit /b 1
)
if not exist "server\.env" (
  echo Missing server\.env. Run 1-install-packages.bat first and configure Supabase keys.
  pause
  exit /b 1
)

echo Starting API on http://localhost:5050
echo Starting website on http://localhost:5173
start "Women Rise Legacy API" cmd /k npm run dev:server
start "Women Rise Legacy Website" cmd /k npm run dev:client
timeout /t 5 /nobreak >nul
start "" http://localhost:5173
exit /b 0
