@echo off
setlocal
cd /d "%~dp0"

if not exist functions\.env (
  copy /Y functions\.env.example functions\.env >nul
)

echo Opening functions\.env.
echo Add:
echo   RAZORPAY_KEY_ID=
echo   RAZORPAY_KEY_SECRET=
echo   RAZORPAY_WEBHOOK_SECRET=
echo.
echo For LIVE payments use the LIVE Razorpay API keys.
notepad functions\.env
pause
