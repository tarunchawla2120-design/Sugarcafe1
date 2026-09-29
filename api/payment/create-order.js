import {
  db,
  razorpayRequest,
  validateOrderPayload,
  json,
} from "./_lib.js";


/* =========================================================
   CREATE RAZORPAY ORDER
========================================================= */

export default async function handler(req, res) {

  /* =======================================================
     CORS
  ======================================================= */

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept"
  );


  /* =======================================================
     HANDLE PREFLIGHT REQUEST
  ======================================================= */

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }


  /* =======================================================
     ONLY POST ALLOWED
  ======================================================= */

  if (req.method !== "POST") {
    return json(res, 405, {
      error: "Method not allowed",
    });
  }


  try {

    /* =====================================================
       REQUEST DATA
    ===================================================== */

    const body =
      req.body || {};

    const orderData =
      body.orderData;

    const selectedAddress =
      body.selectedAddress;


    /* =====================================================
       SERVER-SIDE VALIDATION
    ===================================================== */

    const validated =
      await validateOrderPayload(
        orderData,
        selectedAddress
      );


    /* =====================================================
       RAZORPAY AMOUNT
       ₹626 => 62600 paise
    ===================================================== */

    const amount = Math.round(
      validated.total * 100
    );


    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error(
        "Invalid payment amount."
      );
    }


    /* =====================================================
       RECEIPT
    ===================================================== */

    const receipt = String(
      orderData?.orderNumber ||
      `SC-${Date.now()}`
    );


    /* =====================================================
       CREATE RAZORPAY ORDER
    ===================================================== */

    const razorpayOrder =
      await razorpayRequest(
        "/orders",
        {
          method: "POST",

          body: JSON.stringify({
            amount,

            currency: "INR",

            receipt,

            notes: {
              sugarcafe_order_number:
                receipt,
            },
          }),
        }
      );


    if (!razorpayOrder?.id) {
      throw new Error(
        "Razorpay order was not created."
      );
    }


    /* =====================================================
       SANITIZED ORDER DATA
    ===================================================== */

    const sanitizedOrderData = {

      userId: String(
        orderData?.userId || ""
      ),

      customerId: String(
        orderData?.customerId || ""
      ),

      customerName: String(
        orderData?.customerName || ""
      ),

      phone: String(
        orderData?.phone || ""
      ),

      email: String(
        orderData?.email || ""
      ),

      photoURL: String(
        orderData?.photoURL || ""
      ),

      address:
        validated.selectedAddress.address,

      latitude:
        validated.selectedAddress.latitude,

      longitude:
        validated.selectedAddress.longitude,

      distance:
        validated.distance,

      orderType:
        orderData?.orderType ||
        "Delivery",

      preparationMinutes:
        safePreparation(
          orderData?.preparationMinutes
        ),

      preparationStartedAt:
        null,

      preparationEndAt:
        null,

      foodReadyAt:
        null,

      dispatchedAt:
        null,

      deliveredAt:
        null,

      orderNumber:
        receipt,
    };


    /* =====================================================
       SAVE PAYMENT ATTEMPT
    ===================================================== */

    await db
      .collection(
        "paymentAttempts"
      )
      .doc(razorpayOrder.id)
      .set({

        razorpayOrderId:
          razorpayOrder.id,

        orderData:
          sanitizedOrderData,

        validated,

        expectedAmount:
          amount,

        status:
          "created",

        createdAt:
          new Date(),
      });


    /* =====================================================
       RESPONSE
    ===================================================== */

    return json(res, 200, {

      keyId:
        process.env
          .RAZORPAY_KEY_ID,

      orderId:
        razorpayOrder.id,

      amount:
        razorpayOrder.amount,

      currency:
        razorpayOrder.currency ||
        "INR",

      serverValidatedTotal:
        validated.total,

      finalized:
        false,
    });

  } catch (error) {

    console.error(
      "CREATE RAZORPAY ORDER ERROR:",
      error
    );

    return json(res, 500, {

      error:
        error?.message ||
        "Payment service error.",
    });
  }
}


/* =========================================================
   SAFE PREPARATION TIME
========================================================= */

function safePreparation(value) {

  const n = Number(value);

  return Number.isFinite(n) &&
    n >= 1 &&
    n <= 120
    ? Math.floor(n)
    : 15;
}
