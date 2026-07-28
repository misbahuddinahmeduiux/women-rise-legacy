@echo off
setlocal
cd /d "%~dp0"
title Women Rise Legacy - Production Build
call npm run build
if errorlevel 1 (
  echo BUILD FAILED. Review the error above.
  pause
  exit /b 1
)
echo.
echo BUILD COMPLETE.
echo Frontend: client\dist
echo Backend: server\dist
pause
