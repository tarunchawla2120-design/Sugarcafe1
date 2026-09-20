# SugarCafe Payment Setup

## Production flow

The live website uses the Firebase `paymentApi` function. The server:
1. Recalculates the cart from Firestore `menu` prices.
2. Recalculates delivery charge from `settings/store`.
3. Creates the Razorpay order server-side.
4. Stores a payment attempt.
5. Verifies the Checkout signature server-side.
6. Fetches the Razorpay payment and requires `captured`.
7. Verifies order ID, amount and currency.
8. Creates the Firestore `orders` document exactly once.
9. Accepts Razorpay webhooks so a successful payment can still become an order if the customer's browser closes.

Do not put `RAZORPAY_KEY_SECRET` or the webhook secret in React/Vite code.

## Firebase environment

Copy `functions/.env.example` to `functions/.env` and set the real values there before deploying functions.

For Live Mode, use the Live Razorpay API keys. For Test Mode, use Test keys.

After deployment, configure the Razorpay webhook URL:

`https://YOUR-LIVE-DOMAIN/api/payment/webhook`

Subscribe at minimum to:
- `payment.captured`
- `payment.failed`
- `order.paid`

Use the exact webhook secret entered in Razorpay Dashboard as `RAZORPAY_WEBHOOK_SECRET`.

## Local development

Copy `.env.payment.example` to `.env.payment` and put Test API keys in it.

Run:

```powershell
npm install
npm run payment-server
```

In another terminal:

```powershell
npm run dev
```

The Vite proxy sends `/api/payment/*` to port 8267.

The local payment server verifies the Razorpay signature and fetches the payment status. It does not have Firebase Admin credentials, so it returns `finalized: false`; the browser saves the already-verified order locally. Production Firebase is the authoritative server-side amount validation/finalization path.

## Important

A real payment test cannot be completed from the source ZIP alone. Razorpay credentials, Firebase deployment and a configured Razorpay webhook are required. Test Mode must be used first; switch to Live Mode only after a successful test flow.
