@echo off
title SugarCafe - Build Permanent App
cd /d "%~dp0"
if not exist node_modules (
  call npm install --include=dev
  if errorlevel 1 goto :error
)
call npm run build
if errorlevel 1 goto :error
call npx electron-builder --win
if errorlevel 1 goto :error
echo.
echo DONE - installer/portable EXE is in the "dist" folder.
pause
exit /b 0
:error
echo BUILD FAILED.
pause
exit /b 1
