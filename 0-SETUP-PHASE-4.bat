@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Women Rise Legacy - Phase 4 Setup

echo ==================================================
echo WOMEN RISE LEGACY - PHASE 4 DYNAMIC CMS
echo ==================================================
echo.

if not exist "client\package.json" (
  echo ERROR: Run this file from the extracted Phase 4 project root.
  pause
  exit /b 1
)
if not exist "client\.env" (
  echo ERROR: client\.env is missing. Copy it from your working Phase 3.1 project.
  pause
  exit /b 2
)
if not exist "server\.env" (
  echo ERROR: server\.env is missing. Copy it from your working Phase 3.1 project.
  pause
  exit /b 3
)

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\ensure-payment-key.ps1" "server\.env"
if errorlevel 1 (
  echo ERROR: Could not verify the payment credential encryption key.
  pause
  exit /b 4
)

echo.
echo Installing/updating packages...
call npm install
if errorlevel 1 (
  echo ERROR: Package installation failed.
  pause
  exit /b 5
)

echo.
echo Running TypeScript checks...
call npm run typecheck
if errorlevel 1 (
  echo ERROR: Type checking failed. Read the errors above.
  pause
  exit /b 6
)

echo.
echo Running production build...
call npm run build
if errorlevel 1 (
  echo ERROR: Production build failed. Read the errors above.
  pause
  exit /b 7
)

echo.
echo PHASE 4 CODE SETUP COMPLETE.
echo NEXT: Run supabase\PHASE-4-DYNAMIC-CMS.sql in Supabase SQL Editor.
echo THEN: Optionally run supabase\PHASE-4-VERIFY.sql.
echo LAST: Run 2-start-project.bat.
pause
