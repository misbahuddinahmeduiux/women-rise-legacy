@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo WOMEN RISE LEGACY - PHASE 6 COMPLETE UI VALIDATION
echo ============================================================
echo.

echo [1/3] Phase 6 source validation...
call npm run validate:phase6
if errorlevel 1 goto :fail

echo [2/3] TypeScript checks...
call npm run typecheck
if errorlevel 1 goto :fail

echo [3/3] Production build...
call npm run build
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo PHASE 6 COMPLETE UI VALIDATION PASSED
echo ============================================================
echo No new SQL is required if Phase 6 Step 1 SQL was already run.
echo Start the project with 2-start-project.bat and review the UI.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo PHASE 6 COMPLETE UI VALIDATION FAILED
echo ============================================================
echo Share the first red error before changing any files.
pause
exit /b 1
