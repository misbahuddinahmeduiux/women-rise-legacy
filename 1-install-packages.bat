@echo off
setlocal
cd /d "%~dp0"
title Women Rise Legacy - Install Packages
call npm install
if errorlevel 1 (
  echo PACKAGE INSTALLATION FAILED.
  pause
  exit /b 1
)
echo PACKAGES INSTALLED.
pause
