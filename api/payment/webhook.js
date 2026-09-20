import crypto from 'node:crypto';
import { db, createFinalOrderFromAttempt, json } from './_lib.js';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const raw = await rawBody(req);
    const received = String(req.headers['x-razorpay-signature'] || '');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (!secret || !received || expected.length !== received.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) return json(res, 401, { ok: false, error: 'Invalid webhook signature.' });
    const event = JSON.parse(raw.toString('utf8'));
    const payment = event?.payload?.payment?.entity;
    if (payment?.id && payment?.order_id && payment.status === 'captured') {
      const attemptSnap = await db.collection('paymentAttempts').doc(payment.order_id).get();
      if (attemptSnap.exists) await createFinalOrderFromAttempt(attemptSnap.data(), payment, '');
    }
    return json(res, 200, { ok: true });
  } catch (error) { console.error(error); return json(res, 500, { ok: false, error: error.message || 'Webhook error.' }); }
}
