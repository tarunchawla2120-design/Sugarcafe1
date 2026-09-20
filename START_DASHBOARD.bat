@echo off
setlocal
cd /d "%~dp0"
echo.
echo SugarCafe Professional Dashboard
 echo Starting... Please wait.
if not exist package.json (
  echo ERROR: package.json not found in this folder.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing required packages for first run...
  call npm install --include=dev
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed. Check your internet connection and Node.js installation.
    pause
    exit /b 1
  )
)
call npm run desktop
if errorlevel 1 pause
endlocal
