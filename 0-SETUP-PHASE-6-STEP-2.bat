@echo off
setlocal
cd /d "%~dp0"
echo.
echo ===============================================
echo  WOMEN RISE LEGACY - PHASE 6 STEP 2
echo  Professional Admin Dashboard Validation
echo ===============================================
echo.
call npm run typecheck
if errorlevel 1 goto :fail
call npm run build
if errorlevel 1 goto :fail
echo.
echo PHASE 6 STEP 2 VALIDATION COMPLETE
pause
exit /b 0
:fail
echo.
echo PHASE 6 STEP 2 VALIDATION FAILED
pause
exit /b 1
