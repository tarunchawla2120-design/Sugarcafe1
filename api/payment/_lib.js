import crypto from "node:crypto";

import {
  getApps,
  initializeApp,
  cert,
} from "firebase-admin/app";

import {
  getFirestore,
  FieldValue,
} from "firebase-admin/firestore";


// ============================================================
// FIREBASE ADMIN
// ============================================================

function getFirebaseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not configured."
    );
  }

  let value = raw.trim();

  // Remove accidental wrapping quotes
  if (
    value.startsWith('"') &&
    value.endsWith('"')
  ) {
    value = value.slice(1, -1);
  }

  let serviceAccount = null;

  // ------------------------------------------------------------
  // 1. Try normal JSON
  // ------------------------------------------------------------

  try {
    if (value.startsWith("{")) {
      serviceAccount = JSON.parse(value);
    }
  } catch {
    serviceAccount = null;
  }

  // ------------------------------------------------------------
  // 2. If not normal JSON, try Base64 JSON
  // ------------------------------------------------------------

  if (!serviceAccount) {
    try {
      const decoded = Buffer
        .from(value, "base64")
        .toString("utf8")
        .trim();

      serviceAccount = JSON.parse(decoded);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is invalid. Use valid Firebase service-account JSON or Base64 encoded JSON."
      );
    }
  }

  // ------------------------------------------------------------
  // Validate required Firebase fields
  // ------------------------------------------------------------

  if (
    !serviceAccount ||
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email or private_key."
    );
  }

  // ------------------------------------------------------------
  // Fix escaped/newline private key
  // ------------------------------------------------------------

  serviceAccount.private_key =
    String(serviceAccount.private_key)
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n")
      .trim();

  return serviceAccount;
}


function firebaseAdmin() {
  if (!getApps().length) {
    const serviceAccount =
      getFirebaseServiceAccount();

    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getFirestore();
}


export const db = firebaseAdmin();


// ============================================================
// HELPERS
// ============================================================

export const safeNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};


// ============================================================
// RAZORPAY REQUEST
// ============================================================

export async function razorpayRequest(
  path,
  options = {}
) {
  const keyId =
    process.env.RAZORPAY_KEY_ID || "";

  const keySecret =
    process.env.RAZORPAY_KEY_SECRET || "";

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay LIVE keys are not configured on the payment server."
    );
  }

  const auth = Buffer
    .from(`${keyId}:${keySecret}`)
    .toString("base64");

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
      `Razorpay returned an invalid response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.description ||
      data?.error?.reason ||
      "Razorpay API request failed."
    );
  }

  return data;
}


// ============================================================
// SHOP LOCATION
// ============================================================

const SHOP_LOCATION = {
  lat: 22.417212,
  lng: 82.665984,
};


// ============================================================
// DISTANCE CALCULATION
// ============================================================

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


// ============================================================
// VALIDATE ORDER
// ============================================================

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

  // ----------------------------------------------------------
  // Store settings
  // ----------------------------------------------------------

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

  const maxDeliveryDistance =
    safeNumber(
      settings.maxDeliveryDistanceKm,
      10
    );

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


  // ----------------------------------------------------------
  // Validate menu items from Firestore
  // ----------------------------------------------------------

  const itemResults = [];

  let subtotalPaise = 0;

  for (const rawItem of orderData.items) {
    const id = String(
      rawItem?.id || ""
    );

    const qty = Math.floor(
      safeNumber(rawItem?.qty, 0)
    );

    if (
      !id ||
      qty < 1 ||
      qty > 99
    ) {
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

    const pricePaise =
      Math.round(price * 100);

    subtotalPaise +=
      pricePaise * qty;

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


  // ----------------------------------------------------------
  // Delivery coordinates
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // Distance
  // ----------------------------------------------------------

  const distance =
    calculateDistance(
      SHOP_LOCATION.lat,
      SHOP_LOCATION.lng,
      latitude,
      longitude
    );


  if (
    distance >
    maxDeliveryDistance + 0.05
  ) {
    throw new Error(
      `Delivery is available only within ${maxDeliveryDistance} km.`
    );
  }


  // ----------------------------------------------------------
  // Delivery charge
  // ----------------------------------------------------------

  const roundedDistance =
    Math.ceil(distance);

  let deliveryCharge = 0;

  if (subtotalPaise > 0) {
    deliveryCharge =
      Math.max(
        minDeliveryCharge,

        Math.min(
          roundedDistance *
            deliveryPerKm,

          maxDeliveryCharge
        )
      );
  }


  // ----------------------------------------------------------
  // Discount / GST
  // ----------------------------------------------------------

  const discount = 0;
  const gst = 0;


  // ----------------------------------------------------------
  // Final total
  // ----------------------------------------------------------

  const total =
    (
      subtotalPaise +
      Math.round(
        deliveryCharge * 100
      ) -
      Math.round(
        discount * 100
      ) +
      Math.round(
        gst * 100
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
      Math.round(total * 100)
  ) {
    throw new Error(
      "Order total changed. Please refresh your cart and try again."
    );
  }


  // ----------------------------------------------------------
  // Address
  // ----------------------------------------------------------

  const address =
    String(
      selectedAddress?.address ||
      orderData.address ||
      ""
    );

  const fullAddress =
    String(
      selectedAddress?.fullAddress ||
      orderData.address ||
      ""
    );


  return {
    items: itemResults,

    subtotal:
      subtotalPaise / 100,

    deliveryCharge,

    discount,

    gst,

    total,

    distance:
      Number(
        distance.toFixed(2)
      ),

    selectedAddress: {
      address,
      fullAddress,
      latitude,
      longitude,
    },
  };
}


// ============================================================
// CREATE FINAL ORDER AFTER PAYMENT
// ============================================================

export async function createFinalOrderFromAttempt(
  attempt,
  payment,
  signature = ""
) {
  if (
    !attempt ||
    !attempt.razorpayOrderId
  ) {
    throw new Error(
      "Invalid payment attempt."
    );
  }

  if (
    !payment ||
    !payment.id
  ) {
    throw new Error(
      "Invalid Razorpay payment."
    );
  }


  const attemptRef = db
    .collection("paymentAttempts")
    .doc(
      attempt.razorpayOrderId
    );

  const paymentRef = db
    .collection("paymentRecords")
    .doc(payment.id);


  return db.runTransaction(
    async (transaction) => {

      // ------------------------------------------------------
      // Payment attempt
      // ------------------------------------------------------

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


      // Already created
      if (data.orderId) {
        return data.orderId;
      }


      // ------------------------------------------------------
      // Payment record
      // ------------------------------------------------------

      const paymentSnap =
        await transaction.get(
          paymentRef
        );

      if (
        paymentSnap.exists &&
        paymentSnap.data()?.orderId
      ) {
        return paymentSnap.data()
          .orderId;
      }


      // ------------------------------------------------------
      // Create final order
      // ------------------------------------------------------

      const orderRef =
        db.collection("orders").doc();


      const validated =
        data.validated || {};


      const validatedItems =
        Array.isArray(
          validated.items
        )
          ? validated.items
          : [];


      transaction.set(
        orderRef,
        {
          ...(
            data.orderData || {}
          ),

          items: validatedItems,

          subtotal:
            safeNumber(
              validated.subtotal
            ),

          deliveryCharge:
            safeNumber(
              validated.deliveryCharge
            ),

          discount:
            safeNumber(
              validated.discount
            ),

          gst:
            safeNumber(
              validated.gst
            ),

          total:
            safeNumber(
              validated.total
            ),

          distance:
            safeNumber(
              validated.distance
            ),

          address:
            String(
              validated
                ?.selectedAddress
                ?.address ||
              ""
            ),

          fullAddress:
            String(
              validated
                ?.selectedAddress
                ?.fullAddress ||
              ""
            ),

          latitude:
            safeNumber(
              validated
                ?.selectedAddress
                ?.latitude
            ),

          longitude:
            safeNumber(
              validated
                ?.selectedAddress
                ?.longitude
            ),

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

          status:
            "New",

          createdAt:
            FieldValue.serverTimestamp(),

          paymentVerifiedAt:
            FieldValue.serverTimestamp(),

          paymentMethodType:
            payment.method ||
            "unknown",
        }
      );


      // ------------------------------------------------------
      // Mark payment attempt paid
      // ------------------------------------------------------

      transaction.set(
        attemptRef,
        {
          orderId:
            orderRef.id,

          status:
            "paid",

          paidAt:
            FieldValue.serverTimestamp(),

          razorpayPaymentId:
            payment.id,
        },
        {
          merge: true,
        }
      );


      // ------------------------------------------------------
      // Payment record
      // ------------------------------------------------------

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
            payment.method ||
            null,

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


// ============================================================
// RAZORPAY SIGNATURE VERIFICATION
// ============================================================

export function verifySignature(
  orderId,
  paymentId,
  received
) {
  const secret =
    process.env.RAZORPAY_KEY_SECRET ||
    "";

  if (
    !secret ||
    !orderId ||
    !paymentId ||
    !received
  ) {
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
      String(received),
      "utf8"
    );


  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }


  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}


// ============================================================
// JSON RESPONSE HELPER
// ============================================================

export function json(
  res,
  status,
  body
) {
  return res
    .status(status)
    .json(body);
}s