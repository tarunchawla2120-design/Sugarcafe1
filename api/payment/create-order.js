import {
  db,
  razorpayRequest,
  validateOrderPayload,
  json,
} from "./_lib.js";

/* =========================================================
   CREATE RAZORPAY ORDER
   Production Version
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
    "Content-Type"
  );

  /* =======================================================
     OPTIONS / PREFLIGHT
  ======================================================= */

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  /* =======================================================
     METHOD CHECK
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

    const body = req.body || {};

    const orderData =
      body.orderData;

    const selectedAddress =
      body.selectedAddress;


    /* =====================================================
       VALIDATE ORDER
    ===================================================== */

    const validated =
      await validateOrderPayload(
        orderData,
        selectedAddress
      );


    /* =====================================================
       FINAL PAYMENT AMOUNT
       Rupees → Paise
    ===================================================== */

    const amount =
      Math.round(
        Number(validated.total) * 100
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

    const receipt =
      String(
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
            amount: amount,

            currency: "INR",

            receipt: receipt,

            notes: {
              sugarcafe_order_number:
                receipt,
            },
          }),
        }
      );


    if (
      !razorpayOrder ||
      !razorpayOrder.id
    ) {
      throw new Error(
        "Razorpay order was not created."
      );
    }


    /* =====================================================
       SANITIZED ORDER DATA
    ===================================================== */

    const sanitizedOrderData = {

      userId:
        String(
          orderData?.userId || ""
        ),

      customerId:
        String(
          orderData?.customerId || ""
        ),

      customerName:
        String(
          orderData?.customerName || ""
        ),

      phone:
        String(
          orderData?.phone || ""
        ),

      email:
        String(
          orderData?.email || ""
        ),

      photoURL:
        String(
          orderData?.photoURL || ""
        ),

      address:
        validated
          .selectedAddress
          .address,

      latitude:
        validated
          .selectedAddress
          .latitude,

      longitude:
        validated
          .selectedAddress
          .longitude,

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
      .doc(
        razorpayOrder.id
      )
      .set({

        razorpayOrderId:
          razorpayOrder.id,

        orderData:
          sanitizedOrderData,

        validated:
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

      success:
        true,

      keyId:
        process.env.RAZORPAY_KEY_ID,

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

      success:
        false,

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

  const n =
    Number(value);

  if (
    Number.isFinite(n) &&
    n >= 1 &&
    n <= 120
  ) {
    return Math.floor(n);
  }

  return 15;
}
