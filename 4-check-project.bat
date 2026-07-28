@echo off
setlocal
cd /d "%~dp0"
title Women Rise Legacy - Type Check
call npm run typecheck
if errorlevel 1 (
  echo CHECK FAILED. Review the error above.
  pause
  exit /b 1
)
echo PROJECT CHECK PASSED.
pause
