import crypto from 'node:crypto';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function firebaseAdmin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
    const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

export const db = firebaseAdmin();
export const safeNumber = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

export async function razorpayRequest(path, options = {}) {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId || !keySecret) throw new Error('Razorpay LIVE keys are not configured on the payment server.');
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.description || 'Razorpay API request failed.');
  return data;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const SHOP_LOCATION = { lat: 22.417212, lng: 82.665984 };

export async function validateOrderPayload(orderData, selectedAddress) {
  if (!orderData || !Array.isArray(orderData.items) || !orderData.items.length) throw new Error('Cart is empty or invalid.');
  const settingsSnap = await db.collection('settings').doc('store').get();
  const settings = settingsSnap.exists ? settingsSnap.data() : { maxDeliveryDistanceKm: 10, deliveryPerKm: 20, minDeliveryCharge: 20, maxDeliveryCharge: 300 };
  const itemResults = [];
  let subtotalPaise = 0;
  for (const rawItem of orderData.items) {
    const id = String(rawItem?.id || '');
    const qty = Math.floor(safeNumber(rawItem?.qty, 0));
    if (!id || qty < 1 || qty > 99) throw new Error('Invalid cart item.');
    const snap = await db.collection('menu').doc(id).get();
    if (!snap.exists) throw new Error(`Menu item is no longer available: ${id}`);
    const menu = snap.data();
    if (menu.available === false) throw new Error(`Menu item is currently unavailable: ${menu.name || id}`);
    const price = safeNumber(menu.price, -1);
    if (price < 0) throw new Error(`Invalid price for menu item: ${menu.name || id}`);
    subtotalPaise += Math.round(price * 100) * qty;
    itemResults.push({ id, name: String(menu.name || rawItem.name || ''), price, qty, image: String(menu.image || rawItem.image || ''), category: String(menu.category || rawItem.category || '') });
  }
  const latitude = safeNumber(orderData.latitude, NaN), longitude = safeNumber(orderData.longitude, NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Valid delivery location is required.');
  const distance = calculateDistance(SHOP_LOCATION.lat, SHOP_LOCATION.lng, latitude, longitude);
  const maxDistance = safeNumber(settings.maxDeliveryDistanceKm, 10);
  if (distance > maxDistance + 0.05) throw new Error(`Delivery is available only within ${maxDistance} km.`);
  const roundedDistance = Math.ceil(distance);
  const deliveryCharge = subtotalPaise > 0 ? Math.max(safeNumber(settings.minDeliveryCharge, 20), Math.min(roundedDistance * safeNumber(settings.deliveryPerKm, 20), safeNumber(settings.maxDeliveryCharge, 300))) : 0;
  const total = (subtotalPaise + Math.round(deliveryCharge * 100)) / 100;
  if (Math.round(safeNumber(orderData.total) * 100) !== Math.round(total * 100)) throw new Error('Order total changed. Please refresh your cart and try again.');
  return { items: itemResults, subtotal: subtotalPaise / 100, deliveryCharge, discount: 0, gst: 0, total, distance: Number(distance.toFixed(2)), selectedAddress: { address: String(selectedAddress?.address || orderData.address || ''), fullAddress: String(selectedAddress?.fullAddress || orderData.address || ''), latitude, longitude } };
}

export async function createFinalOrderFromAttempt(attempt, payment, signature = '') {
  const attemptRef = db.collection('paymentAttempts').doc(attempt.razorpayOrderId);
  const paymentRef = db.collection('paymentRecords').doc(payment.id);
  return db.runTransaction(async (transaction) => {
    const attemptSnap = await transaction.get(attemptRef);
    if (!attemptSnap.exists) throw new Error('Payment attempt not found.');
    const data = attemptSnap.data();
    if (data.orderId) return data.orderId;
    const paymentSnap = await transaction.get(paymentRef);
    if (paymentSnap.exists && paymentSnap.data()?.orderId) return paymentSnap.data().orderId;
    const orderRef = db.collection('orders').doc();
    transaction.set(orderRef, { ...data.orderData, items: data.validated.items, subtotal: data.validated.subtotal, deliveryCharge: data.validated.deliveryCharge, discount: data.validated.discount, gst: data.validated.gst, total: data.validated.total, distance: data.validated.distance, address: data.validated.selectedAddress.address, latitude: data.validated.selectedAddress.latitude, longitude: data.validated.selectedAddress.longitude, paymentMethod: 'Online Payment', paymentStatus: 'Paid', paymentNote: 'Paid, signature verified and payment captured by Razorpay.', razorpayOrderId: payment.order_id || data.razorpayOrderId, razorpayPaymentId: payment.id, razorpaySignature: signature, status: 'New', createdAt: FieldValue.serverTimestamp(), paymentVerifiedAt: FieldValue.serverTimestamp(), paymentMethodType: payment.method || 'unknown' });
    transaction.set(attemptRef, { orderId: orderRef.id, status: 'paid', paidAt: FieldValue.serverTimestamp(), razorpayPaymentId: payment.id }, { merge: true });
    transaction.set(paymentRef, { orderId: orderRef.id, razorpayOrderId: payment.order_id || data.razorpayOrderId, amount: payment.amount, currency: payment.currency, status: payment.status, method: payment.method || null, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    return orderRef.id;
  });
}

export function verifySignature(orderId, paymentId, received) {
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return expected.length === received.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export function json(res, status, body) { return res.status(status).json(body); }
