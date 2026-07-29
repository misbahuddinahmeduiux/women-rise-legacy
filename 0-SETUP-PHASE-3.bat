@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Women Rise Legacy - Phase 3 Setup

echo ==================================================
echo WOMEN RISE LEGACY - PHASE 3 FINAL SETUP
echo ==================================================
echo.

if not exist "client" (
  echo ERROR: Run this file from the Phase 3 project root.
  pause
  exit /b 1
)

if not exist "client\.env" (
  copy /Y "client\.env.example" "client\.env" >nul
  echo Created client\.env from the included public configuration.
)

if not exist "server\.env" (
  echo.
  echo server\.env is required and contains your private Supabase secret.
  echo Paste the full path of your PREVIOUS WORKING PHASE 2 project root.
  echo Example: C:\Users\YourName\Desktop\women-rise-legacy-phase-2
  set /p OLDROOT=Previous Phase 2 path: 
  if exist "%OLDROOT%\server\.env" (
    copy /Y "%OLDROOT%\server\.env" "server\.env" >nul
    echo Copied server\.env successfully.
  ) else (
    echo ERROR: server\.env was not found in that folder.
    echo Copy it manually into the Phase 3 server folder, then run this setup again.
    pause
    exit /b 2
  )
)

echo.>>"server\.env"
findstr /B /C:"APP_URL=" "server\.env" >nul || echo APP_URL=http://localhost:5173>>"server\.env"
findstr /B /C:"APP_NAME=" "server\.env" >nul || echo APP_NAME=Women Rise Legacy>>"server\.env"
findstr /B /C:"RESEND_API_KEY=" "server\.env" >nul || echo RESEND_API_KEY=>>"server\.env"
findstr /B /C:"EMAIL_FROM=" "server\.env" >nul || echo EMAIL_FROM=Women Rise Legacy ^<noreply@example.com^>>>"server\.env"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\ensure-payment-key.ps1" "server\.env"
if errorlevel 1 (
  echo ERROR: Could not generate the payment credential encryption key.
  pause
  exit /b 6
)

echo.
echo Installing packages...
call npm install
if errorlevel 1 (
  echo ERROR: Package installation failed.
  pause
  exit /b 3
)

echo.
echo Running type checks and production build...
call npm run typecheck
if errorlevel 1 (
  echo ERROR: Type checking failed. See the messages above.
  pause
  exit /b 4
)
call npm run build
if errorlevel 1 (
  echo ERROR: Production build failed. See the messages above.
  pause
  exit /b 5
)

echo.
echo PHASE 3 CODE SETUP COMPLETE.
echo NEXT: Run supabase\PHASE-3-SETUP-ALL.sql in Supabase SQL Editor.
echo THEN: Run supabase\PHASE-3.1-PAYMENT-GATEWAYS.sql.
echo FINALLY: Double-click 2-start-project.bat and configure Admin ^> Payment Methods.
pause
