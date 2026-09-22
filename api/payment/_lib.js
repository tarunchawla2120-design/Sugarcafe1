import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getFirebaseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not configured."
    );
  }

  let value = String(raw).trim();
  let serviceAccount = null;

  try {
    serviceAccount = JSON.parse(value);

    if (typeof serviceAccount === "string") {
      serviceAccount = JSON.parse(serviceAccount);
    }
  } catch {
    serviceAccount = null;
  }

  if (!serviceAccount) {
    try {
      let unwrapped = value;

      if (
        unwrapped.startsWith('"') &&
        unwrapped.endsWith('"')
      ) {
        try {
          unwrapped = JSON.parse(unwrapped);
        } catch {
          unwrapped = unwrapped.slice(1, -1);
        }
      }

      if (typeof unwrapped === "string") {
        unwrapped = unwrapped
          .replace(/\\"/g, '"')
          .trim();
      }

      if (
        unwrapped.startsWith("{") &&
        unwrapped.endsWith("}")
      ) {
        serviceAccount = JSON.parse(unwrapped);
      }
    } catch {
      serviceAccount = null;
    }
  }

  if (!serviceAccount) {
    try {
      const decoded = Buffer
        .from(value, "base64")
        .toString("utf8")
        .trim();

      serviceAccount = JSON.parse(decoded);

      if (typeof serviceAccount === "string") {
        serviceAccount = JSON.parse(serviceAccount);
      }
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

  serviceAccount.private_key = String(
    serviceAccount.private_key
  )
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();

  return serviceAccount;
}


// ============================================================
// FIREBASE
// ============================================================

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(getFirebaseServiceAccount()),
      });

export const db = getFirestore(firebaseApp);


// ============================================================
// JSON RESPONSE
// ============================================================

export function json(res, status, data) {
  res.status(status).json(data);
}


// ============================================================
// RAZORPAY REQUEST
// ============================================================

export async function razorpayRequest(
  path,
  options = {}
) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay credentials are not configured."
    );
  }

  const auth = Buffer
    .from(`${keyId}:${keySecret}`)
    .toString("base64");

  const response = await fetch(
    `https://api.razorpay.com/v1${path}`,
    {
      method: options.method || "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: options.body,
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


// ============================================================
// ORDER VALIDATION
// ============================================================

export async function validateOrderPayload(
  orderData,
  selectedAddress
) {
  if (!orderData || typeof orderData !== "object") {
    throw new Error("Invalid order data.");
  }

  if (!selectedAddress || typeof selectedAddress !== "object") {
    throw new Error("Delivery address is required.");
  }

  const address = String(
    selectedAddress.address || ""
  ).trim();

  const latitude = Number(
    selectedAddress.latitude
  );

  const longitude = Number(
    selectedAddress.longitude
  );

  const distance = Number(
    selectedAddress.distance ??
    orderData.distance ??
    0
  );

  const total = Number(orderData.total);

  if (!address) {
    throw new Error("Delivery address is required.");
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error("Invalid delivery location.");
  }

  if (
    !Number.isFinite(distance) ||
    distance < 0
  ) {
    throw new Error("Invalid delivery distance.");
  }

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    throw new Error("Invalid order total.");
  }

  // Current SugarCafe delivery rules
  const MAX_DELIVERY_DISTANCE = 15;
  const DELIVERY_PER_KM = 20;
  const MIN_DELIVERY_CHARGE = 20;
  const MAX_DELIVERY_CHARGE = 300;

  if (distance > MAX_DELIVERY_DISTANCE) {
    throw new Error(
      `Delivery is available only within ${MAX_DELIVERY_DISTANCE} km.`
    );
  }

  const calculatedDelivery = Math.min(
    MAX_DELIVERY_CHARGE,
    Math.max(
      MIN_DELIVERY_CHARGE,
      Math.ceil(distance) * DELIVERY_PER_KM
    )
  );

  const subtotal = Number(
    orderData.subtotal ??
    Math.max(0, total - Number(orderData.deliveryCharge || calculatedDelivery))
  );

  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    throw new Error("Invalid order subtotal.");
  }

  const calculatedTotal =
    Math.round(
      (subtotal + calculatedDelivery + Number(orderData.gst || 0) -
        Number(orderData.discount || 0)) * 100
    ) / 100;

  /*
   * Allow a small difference because frontend totals may
   * contain decimal rounding.
   */
  if (Math.abs(calculatedTotal - total) > 1) {
    throw new Error(
      `Order total mismatch. Expected ₹${calculatedTotal}, received ₹${total}.`
    );
  }

  return {
    total: calculatedTotal,
    subtotal,
    deliveryCharge: calculatedDelivery,
    gst: Number(orderData.gst || 0),
    discount: Number(orderData.discount || 0),
    distance,
    selectedAddress: {
      address,
      latitude,
      longitude,
    },
  };
}

export { getFirebaseServiceAccount };
