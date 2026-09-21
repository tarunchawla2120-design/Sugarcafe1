import { db, razorpayRequest, verifySignature, createFinalOrderFromAttempt, json } from './lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const orderId = String(body.razorpayOrderId || ''), paymentId = String(body.razorpayPaymentId || ''), signature = String(body.razorpaySignature || '');
    if (!orderId || !paymentId || !signature) return json(res, 400, { verified: false, error: 'Incomplete payment response.' });
    const attemptSnap = await db.collection('paymentAttempts').doc(orderId).get();
    if (!attemptSnap.exists) return json(res, 400, { verified: false, error: 'Unknown Razorpay order.' });
    if (!verifySignature(orderId, paymentId, signature)) return json(res, 400, { verified: false, error: 'Invalid payment signature.' });
    const attempt = attemptSnap.data();
    const payment = await razorpayRequest(`/payments/${paymentId}`, { method: 'GET' });
    if (payment.order_id !== orderId || Number(payment.amount) !== Number(attempt.expectedAmount) || payment.currency !== 'INR') return json(res, 400, { verified: false, captured: false, error: 'Payment amount/order mismatch.' });
    if (payment.status !== 'captured' || payment.captured !== true) return json(res, 400, { verified: false, captured: false, error: `Payment is not captured. Current status: ${payment.status || 'unknown'}.` });
    const orderDocId = await createFinalOrderFromAttempt({ ...attempt, razorpayOrderId: orderId }, payment, signature);
    return json(res, 200, { verified: true, captured: true, finalized: true, orderId: orderDocId, paymentId, paymentStatus: payment.status, method: payment.method || null });
  } catch (error) { console.error(error); return json(res, 500, { verified: false, error: error.message || 'Payment service error.' }); }
}
