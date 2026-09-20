import crypto from "node:crypto";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/* =========================================================
   FIREBASE ADMIN
========================================================= */

function firebaseAdmin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!raw) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is not configured."
      );
    }

    let serviceAccount;

    // Try Base64 first
    try {
      serviceAccount = JSON.parse(
        Buffer.from(raw.trim(), "base64").toString("utf8")
      );
    } catch {
      // If Base64 is not used, try normal JSON
      try {
        serviceAccount = JSON.parse(raw.trim());
      } catch {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_JSON is invalid. Use the complete Firebase service-account JSON or its Base64 value."
        );
      }
    }

    if (
      !serviceAccount.project_id ||
      !serviceAccount.client_email ||
      !serviceAccount.private_key
    ) {
      throw new Error(
        "Firebase service account is incomplete. project_id, client_email and private_key are required."
      );
    }

    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getFirestore();
}

export const db = firebaseAdmin();

/* =========================================================
   HELPERS
========================================================= */

export const safeNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

/* =========================================================
   RAZORPAY API
========================================================= */

export async function razorpayRequest(path, options = {}) {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay LIVE keys are not configured on the payment server."
    );
  }

  const auth = Buffer.from(
    `${keyId}:${keySecret}`
  ).toString("base64");

  const response = await fetch(
    `https://api.razorpay.com/v1${path}`,
    {
      ...options,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Razorpay returned an invalid response. HTTP ${response.status}.`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.description ||
        data?.error?.reason ||
        `Razorpay API request failed with HTTP ${response.status}.`
    );
  }

  return data;
}

/* =========================================================
   DISTANCE CALCULATION
========================================================= */

function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return (
    R *
    (2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      ))
  );
}

/* =========================================================
   SUGAR CAFE SHOP LOCATION
========================================================= */

const SHOP_LOCATION = {
  lat: 22.417212,
  lng: 82.665984,
};

/* =========================================================
   VALIDATE ORDER
========================================================= */

export async function validateOrderPayload(
  orderData,
  selectedAddress
) {
  if (
    !orderData ||
    !Array.isArray(orderData.items) ||
    !orderData.items.length
  ) {
    throw new Error(
      "Cart is empty or invalid."
    );
  }

  /* -----------------------------------------
     STORE SETTINGS
  ----------------------------------------- */

  const settingsSnap = await db
    .collection("settings")
    .doc("store")
    .get();

  const settings = settingsSnap.exists
    ? settingsSnap.data()
    : {
        maxDeliveryDistanceKm: 10,
        deliveryPerKm: 20,
        minDeliveryCharge: 20,
        maxDeliveryCharge: 300,
      };

  /* -----------------------------------------
     MENU VALIDATION
  ----------------------------------------- */

  const itemResults = [];

  let subtotalPaise = 0;

  for (const rawItem of orderData.items) {
    const id = String(rawItem?.id || "");

    const qty = Math.floor(
      safeNumber(rawItem?.qty, 0)
    );

    if (!id || qty < 1 || qty > 99) {
      throw new Error(
        "Invalid cart item."
      );
    }

    const snap = await db
      .collection("menu")
      .doc(id)
      .get();

    if (!snap.exists) {
      throw new Error(
        `Menu item is no longer available: ${id}`
      );
    }

    const menu = snap.data();

    if (menu.available === false) {
      throw new Error(
        `Menu item is currently unavailable: ${
          menu.name || id
        }`
      );
    }

    const price = safeNumber(
      menu.price,
      -1
    );

    if (price < 0) {
      throw new Error(
        `Invalid price for menu item: ${
          menu.name || id
        }`
      );
    }

    subtotalPaise +=
      Math.round(price * 100) * qty;

    itemResults.push({
      id,

      name: String(
        menu.name ||
          rawItem.name ||
          ""
      ),

      price,

      qty,

      image: String(
        menu.image ||
          rawItem.image ||
          ""
      ),

      category: String(
        menu.category ||
          rawItem.category ||
          ""
      ),
    });
  }

  /* -----------------------------------------
     DELIVERY LOCATION
  ----------------------------------------- */

  const latitude = safeNumber(
    orderData.latitude,
    NaN
  );

  const longitude = safeNumber(
    orderData.longitude,
    NaN
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      "Valid delivery location is required."
    );
  }

  /* -----------------------------------------
     DISTANCE
  ----------------------------------------- */

  const distance = calculateDistance(
    SHOP_LOCATION.lat,
    SHOP_LOCATION.lng,
    latitude,
    longitude
  );

  const maxDistance = safeNumber(
    settings.maxDeliveryDistanceKm,
    10
  );

  if (
    distance >
    maxDistance + 0.05
  ) {
    throw new Error(
      `Delivery is available only within ${maxDistance} km.`
    );
  }

  /* -----------------------------------------
     DELIVERY CHARGE
  ----------------------------------------- */

  const roundedDistance =
    Math.ceil(distance);

  const deliveryPerKm =
    safeNumber(
      settings.deliveryPerKm,
      20
    );

  const minDeliveryCharge =
    safeNumber(
      settings.minDeliveryCharge,
      20
    );

  const maxDeliveryCharge =
    safeNumber(
      settings.maxDeliveryCharge,
      300
    );

  const deliveryCharge =
    subtotalPaise > 0
      ? Math.max(
          minDeliveryCharge,
          Math.min(
            roundedDistance *
              deliveryPerKm,
            maxDeliveryCharge
          )
        )
      : 0;

  /* -----------------------------------------
     TOTAL
  ----------------------------------------- */

  const total =
    (
      subtotalPaise +
      Math.round(
        deliveryCharge * 100
      )
    ) / 100;

  const requestedTotal =
    safeNumber(
      orderData.total,
      NaN
    );

  if (
    !Number.isFinite(
      requestedTotal
    ) ||
    Math.round(
      requestedTotal * 100
    ) !==
      Math.round(
        total * 100
      )
  ) {
    throw new Error(
      "Order total changed. Please refresh your cart and try again."
    );
  }

  /* -----------------------------------------
     FINAL VALIDATED DATA
  ----------------------------------------- */

  return {
    items: itemResults,

    subtotal:
      subtotalPaise / 100,

    deliveryCharge,

    discount: 0,

    gst: 0,

    total,

    distance: Number(
      distance.toFixed(2)
    ),

    selectedAddress: {
      address: String(
        selectedAddress?.address ||
          orderData.address ||
          ""
      ),

      fullAddress: String(
        selectedAddress?.fullAddress ||
          orderData.address ||
          ""
      ),

      latitude,

      longitude,
    },
  };
}

/* =========================================================
   CREATE FINAL ORDER
========================================================= */

export async function createFinalOrderFromAttempt(
  attempt,
  payment,
  signature = ""
) {
  const attemptRef = db
    .collection("paymentAttempts")
    .doc(attempt.razorpayOrderId);

  const paymentRef = db
    .collection("paymentRecords")
    .doc(payment.id);

  return db.runTransaction(
    async (transaction) => {
      /* -----------------------------------------
         PAYMENT ATTEMPT
      ----------------------------------------- */

      const attemptSnap =
        await transaction.get(
          attemptRef
        );

      if (!attemptSnap.exists) {
        throw new Error(
          "Payment attempt not found."
        );
      }

      const data =
        attemptSnap.data();

      /* -----------------------------------------
         ALREADY CREATED ORDER
      ----------------------------------------- */

      if (data.orderId) {
        return data.orderId;
      }

      /* -----------------------------------------
         CHECK PAYMENT RECORD
      ----------------------------------------- */

      const paymentSnap =
        await transaction.get(
          paymentRef
        );

      if (
        paymentSnap.exists &&
        paymentSnap.data()?.orderId
      ) {
        return paymentSnap
          .data()
          .orderId;
      }

      /* -----------------------------------------
         CREATE ORDER
      ----------------------------------------- */

      const orderRef =
        db.collection("orders").doc();

      transaction.set(
        orderRef,
        {
          ...data.orderData,

          items:
            data.validated.items,

          subtotal:
            data.validated.subtotal,

          deliveryCharge:
            data.validated.deliveryCharge,

          discount:
            data.validated.discount,

          gst:
            data.validated.gst,

          total:
            data.validated.total,

          distance:
            data.validated.distance,

          address:
            data.validated
              .selectedAddress
              .address,

          latitude:
            data.validated
              .selectedAddress
              .latitude,

          longitude:
            data.validated
              .selectedAddress
              .longitude,

          paymentMethod:
            "Online Payment",

          paymentStatus:
            "Paid",

          paymentNote:
            "Paid, signature verified and payment captured by Razorpay.",

          razorpayOrderId:
            payment.order_id ||
            data.razorpayOrderId,

          razorpayPaymentId:
            payment.id,

          razorpaySignature:
            signature,

          status: "New",

          createdAt:
            FieldValue.serverTimestamp(),

          paymentVerifiedAt:
            FieldValue.serverTimestamp(),

          paymentMethodType:
            payment.method ||
            "unknown",
        }
      );

      /* -----------------------------------------
         UPDATE PAYMENT ATTEMPT
      ----------------------------------------- */

      transaction.set(
        attemptRef,
        {
          orderId:
            orderRef.id,

          status: "paid",

          paidAt:
            FieldValue.serverTimestamp(),

          razorpayPaymentId:
            payment.id,
        },
        {
          merge: true,
        }
      );

      /* -----------------------------------------
         PAYMENT RECORD
      ----------------------------------------- */

      transaction.set(
        paymentRef,
        {
          orderId:
            orderRef.id,

          razorpayOrderId:
            payment.order_id ||
            data.razorpayOrderId,

          amount:
            payment.amount,

          currency:
            payment.currency,

          status:
            payment.status,

          method:
            payment.method || null,

          createdAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      return orderRef.id;
    }
  );
}

/* =========================================================
   VERIFY RAZORPAY SIGNATURE
========================================================= */

export function verifySignature(
  orderId,
  paymentId,
  received
) {
  const secret =
    process.env.RAZORPAY_KEY_SECRET ||
    "";

  if (!secret) {
    return false;
  }

  if (!orderId || !paymentId || !received) {
    return false;
  }

  const expected =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(
        `${orderId}|${paymentId}`
      )
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8"
    );

  const receivedBuffer =
    Buffer.from(
      received,
      "utf8"
    );

  return (
    expectedBuffer.length ===
      receivedBuffer.length &&
    crypto.timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    )
  );
}

/* =========================================================
   VERCEL JSON RESPONSE
========================================================= */

export function json(
  res,
  status,
  body
) {
  return res
    .status(status)
    .json(body);
}