# SugarCafe Final

## Customer website
`npm run dev`

## Windows dashboard
1. Install Node.js LTS.
2. Double-click `START_DASHBOARD.bat`.
3. Dashboard opens in a separate Electron window.
4. Login with the existing Firebase staff account.

Dashboard and customer website share Firebase project `sugarcafe-9e54d`. Runtime controls are stored in `settings/store` and the website listens in realtime. Delivery radius is fixed to 10 KM. UPI ID is configured in `.env`.

Do not publish Firestore rules from this package automatically.
