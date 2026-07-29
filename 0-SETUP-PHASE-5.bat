@echo off
setlocal
cd /d "%~dp0"
title Women Rise Legacy - Phase 5 Setup

echo ============================================================
echo WOMEN RISE LEGACY - PHASE 5 SETUP
echo UI stability, visual CMS forms, and relationship fixes
echo ============================================================
echo.

if not exist "package.json" (
  echo ERROR: Run this file from the extracted Phase 5 project root.
  pause
  exit /b 1
)

where node >nul 2>&1 || (
  echo ERROR: Node.js is not installed or not available in PATH.
  pause
  exit /b 1
)

if not exist "client\.env" (
  echo ERROR: client\.env is missing. Copy it from the working Phase 4 project.
  pause
  exit /b 1
)
if not exist "server\.env" (
  echo ERROR: server\.env is missing. Copy it from the working Phase 4 project.
  pause
  exit /b 1
)

echo Installing packages...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo ERROR: Package installation failed.
  pause
  exit /b 1
)

echo.
echo Running Phase 5 package validation...
call npm run validate:phase5
if errorlevel 1 (
  echo ERROR: Phase 5 validation failed.
  pause
  exit /b 1
)

echo.
echo Running TypeScript checks...
call npm run typecheck
if errorlevel 1 (
  echo ERROR: Type checking failed. Read the errors above.
  pause
  exit /b 1
)

echo.
echo Running production build...
call npm run build
if errorlevel 1 (
  echo ERROR: Production build failed. Read the errors above.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo PHASE 5 CODE SETUP COMPLETE
echo Next: run supabase\PHASE-5-UI-CMS-UPGRADE.sql
echo Then: run supabase\PHASE-5-VERIFY.sql
echo Finally: run 2-start-project.bat
echo ============================================================
pause
