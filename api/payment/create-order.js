import { db, razorpayRequest, validateOrderPayload, json } from "./lib.js";

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const validated = await validateOrderPayload(body.orderData, body.selectedAddress);
    const amount = Math.round(validated.total * 100);
    const receipt = String(body.orderData?.orderNumber || `SC-${Date.now()}`);
    const order = await razorpayRequest('/orders', { method: 'POST', body: JSON.stringify({ amount, currency: 'INR', receipt, notes: { sugarcafe_order_number: receipt }, payment_capture: 1 }) });
    const sanitizedOrderData = { userId: String(body.orderData?.userId || ''), customerId: String(body.orderData?.customerId || ''), customerName: String(body.orderData?.customerName || ''), phone: String(body.orderData?.phone || ''), email: String(body.orderData?.email || ''), photoURL: String(body.orderData?.photoURL || ''), address: validated.selectedAddress.address, latitude: validated.selectedAddress.latitude, longitude: validated.selectedAddress.longitude, distance: validated.distance, orderType: 'Delivery', preparationMinutes: safePreparation(body.orderData?.preparationMinutes), preparationStartedAt: null, preparationEndAt: null, foodReadyAt: null, dispatchedAt: null, deliveredAt: null, orderNumber: receipt };
    await db.collection('paymentAttempts').doc(order.id).set({ razorpayOrderId: order.id, orderData: sanitizedOrderData, validated, expectedAmount: amount, status: 'created', createdAt: new Date() });
    return json(res, 200, { keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: order.amount, currency: order.currency, serverValidatedTotal: validated.total, finalized: false });
  } catch (error) { console.error(error); return json(res, 500, { error: error.message || 'Payment service error.' }); }
}
function safePreparation(value) { const n = Number(value); return Number.isFinite(n) && n >= 1 && n <= 120 ? Math.floor(n) : 15; }
