@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo WOMEN RISE LEGACY - PHASE 6 STEP 1 VALIDATION
echo ============================================================

echo [1/3] Source validation...
call npm run validate:phase6
if errorlevel 1 goto :fail

echo [2/3] TypeScript checks...
call npm run typecheck
if errorlevel 1 goto :fail

echo [3/3] Production build...
call npm run build
if errorlevel 1 goto :fail

echo.
echo PHASE 6 STEP 1 CODE VALIDATION COMPLETE
echo Run supabase\PHASE-6-HOMEPAGE-UI.sql in Supabase SQL Editor.
echo Then run supabase\PHASE-6-VERIFY.sql.
exit /b 0

:fail
echo.
echo PHASE 6 STEP 1 VALIDATION FAILED
exit /b 1
