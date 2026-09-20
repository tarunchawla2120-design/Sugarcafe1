# SugarCafe — External Live Payment Backend

Production payment no longer depends on Firebase Blaze Functions or localhost:8267.

## Architecture
Website → Vercel payment API → Razorpay LIVE → signature + captured verification → Firestore order → SugarCafe Dashboard/KOT

## 1. Deploy payment backend
Deploy this project to Vercel with the project root set to the SugarCafe folder. Vercel will use `api/payment/*.js` as serverless functions.

## 2. Add Vercel Environment Variables
- `RAZORPAY_KEY_ID` = your LIVE Razorpay key ID
- `RAZORPAY_KEY_SECRET` = your LIVE Razorpay secret
- `RAZORPAY_WEBHOOK_SECRET` = the webhook secret you choose in Razorpay
- `FIREBASE_SERVICE_ACCOUNT_JSON` = base64 of the Firebase Admin service-account JSON

Never commit these values or put the secret in `src` or public files.

## 3. Connect the website
Create `.env.production` from `.env.production.example` and set:
`VITE_PAYMENT_API_URL=https://YOUR-VERCEL-DOMAIN.vercel.app`

Then build and deploy the website to Firebase Hosting.

## 4. Razorpay webhook
Set the webhook URL to:
`https://YOUR-VERCEL-DOMAIN.vercel.app/api/payment/webhook`

Enable payment-captured webhook events as required by your Razorpay account.

## 5. Local development
The existing Vite proxy may still use `127.0.0.1:8267` for local testing only. It is NOT used by the production build when `VITE_PAYMENT_API_URL` is set.

## 6. Security
The server validates menu items/prices, delivery distance, total, Razorpay order ID, payment amount, currency, signature and captured status before creating the Firestore order.
