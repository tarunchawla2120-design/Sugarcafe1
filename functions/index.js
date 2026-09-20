import crypto from "node:crypto";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

const json = (res, status, body) => res.status(status).json(body);

const razorpayRequest = async (path, options = {}) => {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId || !keySecret) throw new Error("Razorpay live/test keys are not configured.");

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.description || "Razorpay API request failed.");
  }
  return data;
};

const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const SHOP_LOCATION = { lat: 22.417212, lng: 82.665984 };

async function validateOrderPayload(orderData, selectedAddress) {
  if (!orderData || !Array.isArray(orderData.items) || !orderData.items.length) {
    throw new Error("Cart is empty or invalid.");
  }

  const settingsSnap = await db.collection("settings").doc("store").get();
  const settings = settingsSnap.exists
    ? settingsSnap.data()
    : {
        maxDeliveryDistanceKm: 10,
        deliveryPerKm: 20,
        minDeliveryCharge: 20,
        maxDeliveryCharge: 300,
      };

  const itemResults = [];
  let subtotalPaise = 0;

  for (const rawItem of orderData.items) {
    const id = String(rawItem?.id || "");
    const qty = Math.floor(safeNumber(rawItem?.qty, 0));
    if (!id || qty < 1 || qty > 99) {
      throw new Error("Invalid cart item.");
    }

    const snap = await db.collection("menu").doc(id).get();
    if (!snap.exists) throw new Error(`Menu item is no longer available: ${id}`);

    const menu = snap.data();
    if (menu.available === false) {
      throw new Error(`Menu item is currently unavailable: ${menu.name || id}`);
    }

    const price = safeNumber(menu.price, -1);
    if (price < 0) throw new Error(`Invalid price for menu item: ${menu.name || id}`);

    const linePaise = Math.round(price * 100) * qty;
    subtotalPaise += linePaise;

    itemResults.push({
      id,
      name: String(menu.name || rawItem.name || ""),
      price,
      qty,
      image: String(menu.image || rawItem.image || ""),
      category: String(menu.category || rawItem.category || ""),
    });
  }

  const latitude = safeNumber(orderData.latitude, NaN);
  const longitude = safeNumber(orderData.longitude, NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Valid delivery location is required.");
  }

  const distance = calculateDistance(
    SHOP_LOCATION.lat,
    SHOP_LOCATION.lng,
    latitude,
    longitude
  );

  const maxDistance = safeNumber(settings.maxDeliveryDistanceKm, 10);
  if (distance > maxDistance + 0.05) {
    throw new Error(`Delivery is available only within ${maxDistance} km.`);
  }

  let deliveryCharge = 0;
  const roundedDistance = Math.ceil(distance);
  if (subtotalPaise > 0) {
    deliveryCharge = Math.max(
      safeNumber(settings.minDeliveryCharge, 20),
      Math.min(
        roundedDistance * safeNumber(settings.deliveryPerKm, 20),
        safeNumber(settings.maxDeliveryCharge, 300)
      )
    );
  }

  const discount = 0;
  const gst = 0;
  const totalPaise =
    subtotalPaise +
    Math.round(deliveryCharge * 100) -
    discount * 100 +
    gst * 100;

  const clientTotalPaise = Math.round(safeNumber(orderData.total) * 100);
  if (clientTotalPaise !== totalPaise) {
    throw new Error("Order total changed. Please refresh your cart and try again.");
  }

  return {
    items: itemResults,
    subtotal: subtotalPaise / 100,
    deliveryCharge,
    discount,
    gst,
    total: totalPaise / 100,
    distance: Number(distance.toFixed(2)),
    selectedAddress: {
      address: String(selectedAddress?.address || orderData.address || ""),
      fullAddress: String(selectedAddress?.fullAddress || orderData.address || ""),
      latitude,
      longitude,
    },
  };
}

async function createFinalOrderFromAttempt(attempt, payment) {
  const attemptRef = db.collection("paymentAttempts").doc(attempt.razorpayOrderId);
  const paymentRef = db.collection("paymentRecords").doc(payment.id);

  return db.runTransaction(async (transaction) => {
    const attemptSnap = await transaction.get(attemptRef);
    if (!attemptSnap.exists) throw new Error("Payment attempt not found.");

    const data = attemptSnap.data();
    if (data.orderId) return data.orderId;

    const paymentSnap = await transaction.get(paymentRef);
    if (paymentSnap.exists && paymentSnap.data()?.orderId) {
      return paymentSnap.data().orderId;
    }

    const orderRef = db.collection("orders").doc();
    const order = {
      ...data.orderData,
      items: data.validated.items,
      subtotal: data.validated.subtotal,
      deliveryCharge: data.validated.deliveryCharge,
      discount: data.validated.discount,
      gst: data.validated.gst,
      total: data.validated.total,
      distance: data.validated.distance,
      address: data.validated.selectedAddress.address,
      latitude: data.validated.selectedAddress.latitude,
      longitude: data.validated.selectedAddress.longitude,
      paymentMethod: "Online Payment",
      paymentStatus: "Paid",
      paymentNote: "Paid, signature verified and payment captured by Razorpay.",
      razorpayOrderId: payment.order_id || data.razorpayOrderId,
      razorpayPaymentId: payment.id,
      razorpaySignature: data.razorpaySignature || "",
      status: "New",
      createdAt: FieldValue.serverTimestamp(),
      paymentVerifiedAt: FieldValue.serverTimestamp(),
      paymentMethodType: payment.method || "unknown",
    };

    transaction.set(orderRef, order);
    transaction.set(
      attemptRef,
      {
        orderId: orderRef.id,
        status: "paid",
        paidAt: FieldValue.serverTimestamp(),
        razorpayPaymentId: payment.id,
      },
      { merge: true }
    );
    transaction.set(
      paymentRef,
      {
        orderId: orderRef.id,
        razorpayOrderId: payment.order_id || data.razorpayOrderId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method || null,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return orderRef.id;
  });
}

export const paymentApi = onRequest(
  { region: "asia-south1", cors: true },
  async (req, res) => {
    try {
      const path = req.path || req.url || "";

      // Razorpay webhook. Configure this endpoint in Razorpay Dashboard:
      // https://YOUR-DOMAIN/api/payment/webhook
      if (req.method === "POST" && path.endsWith("/webhook")) {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
        const signature = String(req.headers["x-razorpay-signature"] || "");
        if (!webhookSecret || !signature || !req.rawBody) {
          return json(res, 400, { ok: false, error: "Webhook is not configured correctly." });
        }

        const expected = crypto
          .createHmac("sha256", webhookSecret)
          .update(req.rawBody)
          .digest("hex");

        if (
          expected.length !== signature.length ||
          !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
        ) {
          return json(res, 401, { ok: false, error: "Invalid webhook signature." });
        }

        const event = req.body || {};
        const payment =
          event?.payload?.payment?.entity ||
          null;

        if (payment?.id && payment?.order_id) {
          const paymentStatus = String(payment.status || "");
          if (paymentStatus === "captured") {
            try {
              const attemptSnap = await db
                .collection("paymentAttempts")
                .doc(payment.order_id)
                .get();

              if (attemptSnap.exists) {
                await createFinalOrderFromAttempt(
                  attemptSnap.data(),
                  payment
                );
              }
            } catch (webhookError) {
              console.error("Webhook order finalization error:", webhookError);
              // A valid webhook is acknowledged even if finalization can be retried.
            }
          }
        }

        return json(res, 200, { ok: true });
      }

      if (req.method !== "POST") {
        return json(res, 405, { error: "Method not allowed" });
      }

      const body = req.body || {};

      if (path.endsWith("/create-order")) {
        const keyId = process.env.RAZORPAY_KEY_ID || "";
        const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
        if (!keyId || !keySecret) {
          return json(res, 500, { error: "Razorpay keys are not configured on the server." });
        }

        const validated = await validateOrderPayload(
          body.orderData,
          body.selectedAddress
        );

        const amount = Math.round(validated.total * 100);
        const receipt = String(body.orderData?.orderNumber || `SC-${Date.now()}`);

        const order = await razorpayRequest("/orders", {
          method: "POST",
          body: JSON.stringify({
            amount,
            currency: "INR",
            receipt,
            notes: {
              sugarcafe_order_number: receipt,
            },
            payment_capture: 1,
          }),
        });

        const sanitizedOrderData = {
          userId: String(body.orderData?.userId || ""),
          customerId: String(body.orderData?.customerId || ""),
          customerName: String(body.orderData?.customerName || ""),
          phone: String(body.orderData?.phone || ""),
          email: String(body.orderData?.email || ""),
          photoURL: String(body.orderData?.photoURL || ""),
          address: validated.selectedAddress.address,
          latitude: validated.selectedAddress.latitude,
          longitude: validated.selectedAddress.longitude,
          distance: validated.distance,
          orderType: "Delivery",
          preparationMinutes: safeNumber(body.orderData?.preparationMinutes, 15),
          preparationStartedAt: null,
          preparationEndAt: null,
          foodReadyAt: null,
          dispatchedAt: null,
          deliveredAt: null,
          orderNumber: receipt,
        };

        await db.collection("paymentAttempts").doc(order.id).set({
          razorpayOrderId: order.id,
          orderData: sanitizedOrderData,
          validated,
          expectedAmount: amount,
          status: "created",
          createdAt: FieldValue.serverTimestamp(),
        });

        return json(res, 200, {
          keyId,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          serverValidatedTotal: validated.total,
        });
      }

      if (path.endsWith("/verify")) {
        const orderId = String(body.razorpayOrderId || "");
        const paymentId = String(body.razorpayPaymentId || "");
        const signature = String(body.razorpaySignature || "");

        if (!orderId || !paymentId || !signature) {
          return json(res, 400, { verified: false, error: "Incomplete payment response." });
        }

        const attemptSnap = await db
          .collection("paymentAttempts")
          .doc(orderId)
          .get();

        if (!attemptSnap.exists) {
          return json(res, 400, { verified: false, error: "Unknown Razorpay order." });
        }

        const attempt = attemptSnap.data();
        const expectedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
          .update(`${orderId}|${paymentId}`)
          .digest("hex");

        const signatureOk =
          expectedSignature.length === signature.length &&
          crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(signature)
          );

        if (!signatureOk) {
          return json(res, 400, { verified: false, error: "Invalid payment signature." });
        }

        const payment = await razorpayRequest(`/payments/${paymentId}`, {
          method: "GET",
        });

        const expectedAmount = Number(attempt.expectedAmount);
        if (
          payment.order_id !== orderId ||
          Number(payment.amount) !== expectedAmount ||
          payment.currency !== "INR"
        ) {
          return json(res, 400, {
            verified: false,
            captured: false,
            error: "Payment amount/order mismatch.",
          });
        }

        if (payment.status !== "captured" || payment.captured !== true) {
          return json(res, 400, {
            verified: false,
            captured: false,
            error: `Payment is not captured. Current status: ${payment.status || "unknown"}.`,
          });
        }

        const orderDocId = await createFinalOrderFromAttempt(
          {
            ...attempt,
            razorpayOrderId: orderId,
            razorpaySignature: signature,
          },
          payment
        );

        return json(res, 200, {
          verified: true,
          captured: true,
          finalized: true,
          orderId: orderDocId,
          paymentId,
          paymentStatus: payment.status,
          method: payment.method || null,
        });
      }

      return json(res, 404, { error: "Not found" });
    } catch (error) {
      console.error("Payment API error:", error);
      return json(res, 500, {
        verified: false,
        error: error.message || "Payment service error.",
      });
    }
  }
);
