@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==========================================================
echo   Women Rise - Create Sanitized Release Package
echo ==========================================================
echo.

call npm.cmd run release:sanitize
if errorlevel 1 (
  echo.
  echo ERROR: Sanitized release creation failed.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$source=Join-Path (Get-Location) 'release\women-rise-legacy-sanitized-source'; $zip=Join-Path (Get-Location) 'release\women-rise-legacy-sanitized-source.zip'; if(Test-Path $zip){Remove-Item $zip -Force}; Compress-Archive -Path (Join-Path $source '*') -DestinationPath $zip -CompressionLevel Optimal"
if errorlevel 1 (
  echo.
  echo ERROR: ZIP creation failed. The sanitized folder is still available under release.
  pause
  exit /b 1
)

echo.
echo SUCCESS: Safe release created:
echo release\women-rise-legacy-sanitized-source.zip
echo.
echo This package excludes environment secrets, backups, database/Auth dumps,
echo node_modules, generated builds and Git history.
pause
