@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Women Rise Legacy - Payment Gateway Setup

echo ==================================================
echo WOMEN RISE LEGACY - PHASE 3.1 PAYMENT GATEWAYS
echo ==================================================
echo.

if not exist "client" (
  echo ERROR: Run this file from the project root.
  pause
  exit /b 1
)
if not exist "server\.env" (
  echo ERROR: server\.env is missing. Copy it from your working Phase 3 project first.
  pause
  exit /b 2
)

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\ensure-payment-key.ps1" "server\.env"
if errorlevel 1 (
  echo ERROR: Could not generate the payment credential encryption key.
  pause
  exit /b 6
)

findstr /B /C:"PAYMENT_MODE=" "server\.env" >nul || echo PAYMENT_MODE=demo>>"server\.env"

echo.
echo Installing/updating packages...
call npm install
if errorlevel 1 (
  echo ERROR: Package installation failed.
  pause
  exit /b 3
)

echo.
echo Running type checks...
call npm run typecheck
if errorlevel 1 (
  echo ERROR: Type checking failed. Read the errors above.
  pause
  exit /b 4
)

echo.
echo Building production packages...
call npm run build
if errorlevel 1 (
  echo ERROR: Production build failed. Read the errors above.
  pause
  exit /b 5
)

echo.
echo CODE SETUP COMPLETE.
echo NEXT: Run supabase\PHASE-3.1-PAYMENT-GATEWAYS.sql in Supabase SQL Editor.
echo THEN: Run 2-start-project.bat and open Admin ^> Payment Methods.
pause
