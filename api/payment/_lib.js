
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/* =========================================================
   FIREBASE SERVICE ACCOUNT
========================================================= */

function getFirebaseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not configured."
    );
  }

  const value = String(raw).trim();
  let serviceAccount = null;

  try {
    serviceAccount = JSON.parse(value);
  } catch {
    try {
      serviceAccount = JSON.parse(
        Buffer.from(value, "base64").toString("utf8").trim()
      );
    } catch {
      serviceAccount = null;
    }
  }

  if (typeof serviceAccount === "string") {
    try {
      serviceAccount = JSON.parse(serviceAccount);
    } catch {
      serviceAccount = null;
    }
  }

  if (
    !serviceAccount ||
    typeof serviceAccount !== "object" ||
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is invalid or missing project_id, client_email or private_key."
    );
  }

  serviceAccount.private_key = String(serviceAccount.private_key)
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();

  return serviceAccount;
}

/* =========================================================
   FIREBASE ADMIN
========================================================= */

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(getFirebaseServiceAccount()),
      });

export const db = getFirestore(firebaseApp);

/* =========================================================
   JSON RESPONSE
========================================================= */

export function json(res, status, data) {
  return res.status(status).json(data);
}

/* =========================================================
   RAZORPAY REQUEST
========================================================= */

export async function razorpayRequest(path, options = {}) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured.");
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch(
    `https://api.razorpay.com/v1${path}`,
    {
      method: options.method || "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(options.body !== undefined
        ? { body: options.body }
        : {}),
    }
  );

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      error: {
        description: text || "Invalid Razorpay response.",
      },
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.description ||
      data?.error?.reason ||
      `Razorpay request failed with HTTP ${response.status}`
    );
  }

  return data;
}

/* =========================================================
   DELIVERY CHARGE
   0–1 km: ₹50
   After 1 km: ₹25 per additional started km
   Maximum: ₹170
   Maximum radius: 8 km
========================================================= */

export function calculateDeliveryCharge(distance) {
  const km = Number(distance);

  if (!Number.isFinite(km) || km < 0 || km > 8) {
    throw new Error("Delivery is available only within 8 km.");
  }

  if (km <= 1) return 50;

  return Math.min(
    170,
    50 + (Math.ceil(km) - 1) * 25
  );
}

/* =========================================================
   ORDER VALIDATION
========================================================= */

export async function validateOrderPayload(orderData, selectedAddress) {
  if (!orderData || typeof orderData !== "object") {
    throw new Error("Invalid order data.");
  }

  if (!selectedAddress || typeof selectedAddress !== "object") {
    throw new Error("Delivery address is required.");
  }

  const address = String(selectedAddress.address || "").trim();
  const latitude = Number(selectedAddress.latitude);
  const longitude = Number(selectedAddress.longitude);
  const distance = Number(
    selectedAddress.distance ?? orderData.distance
  );
  const total = Number(orderData.total);

  if (!address) {
    throw new Error("Delivery address is required.");
  }

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid delivery location.");
  }

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("Invalid order total.");
  }

  const calculatedDelivery = calculateDeliveryCharge(distance);

  const subtotal = Number(orderData.subtotal);
  const gst = Number(orderData.gst ?? 0);
  const discount = Number(orderData.discount ?? 0);

  if (!Number.isFinite(subtotal) || subtotal < 170) {
    throw new Error("Minimum order subtotal is ₹170.");
  }

  if (!Number.isFinite(gst) || gst < 0) {
    throw new Error("Invalid GST.");
  }

  if (!Number.isFinite(discount) || discount < 0) {
    throw new Error("Invalid discount.");
  }

  if (discount > subtotal + gst) {
    throw new Error("Invalid discount amount.");
  }

  const calculatedTotal =
    Math.round(
      (subtotal + calculatedDelivery + gst - discount) * 100
    ) / 100;

  if (Math.abs(calculatedTotal - total) > 0.01) {
    throw new Error(
      `Order total mismatch. Expected ₹${calculatedTotal}, received ₹${total}.`
    );
  }

  return {
    total: calculatedTotal,
    subtotal,
    deliveryCharge: calculatedDelivery,
    gst,
    discount,
    distance,
    selectedAddress: {
      address,
      latitude,
      longitude,
    },
  };
}

export { getFirebaseServiceAccount };
