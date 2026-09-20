SUGAR CAFE — LIVE PAYMENT

Production payment uses the external Vercel API under /api/payment.
The Firebase Hosting site does NOT rewrite payment requests to Cloud Functions.

Payment flow:
Website -> External Payment API -> Razorpay LIVE -> signature verification + captured check -> Firestore order -> Dashboard/KOT

localhost:8267 exists only for local development/testing.

See PAYMENT_LIVE_EXTERNAL_SETUP.md for deployment.
