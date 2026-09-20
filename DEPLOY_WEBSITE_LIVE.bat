@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo SugarCafe - LIVE WEBSITE + PAYMENT API
echo ==============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  pause
  exit /b 1
)

if not exist package.json (
  echo ERROR: package.json not found. Run this file from the inner SugarCafe folder.
  pause
  exit /b 1
)

if not exist functions\.env (
  echo ERROR: functions\.env is missing.
  echo.
  echo Create it from:
  echo     functions\.env.example
  echo.
  echo Then add your RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
  echo and RAZORPAY_WEBHOOK_SECRET.
  echo Use LIVE keys only when you are ready for real payments.
  pause
  exit /b 1
)

findstr /C:"rzp_test_" functions\.env >nul
if not errorlevel 1 (
  echo WARNING: functions\.env contains a TEST Razorpay key.
  echo The live website will remain in Razorpay Test Mode.
  echo.
)

echo [1/3] Installing website dependencies...
call npm.cmd install
if errorlevel 1 (
  echo DEPENDENCY INSTALL FAILED.
  pause
  exit /b 1
)

echo.
echo [2/3] Building website...
call npm.cmd run build
if errorlevel 1 (
  echo BUILD FAILED. Deployment stopped.
  pause
  exit /b 1
)

echo.
echo [3/3] Deploying Firebase Hosting + Payment API...
call npx.cmd firebase-tools deploy --only hosting,functions
if errorlevel 1 (
  echo DEPLOY FAILED.
  echo Check Firebase login, billing/plan requirements, and functions\.env.
  pause
  exit /b 1
)

echo.
echo ==============================================
echo DEPLOY COMPLETE
echo ==============================================
echo Website: https://sugarcafe-9e54d.web.app
echo Payment API: Firebase Cloud Function /api/payment/*
echo.
echo IMPORTANT: Configure the Razorpay webhook after deployment:
echo https://sugarcafe-9e54d.web.app/api/payment/webhook
echo.
pause
