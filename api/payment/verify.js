import {
  db,
  razorpayRequest,
  verifySignature,
  createFinalOrderFromAttempt,
  json,
} from "./_lib.js";


/* =========================================================
   VERIFY RAZORPAY PAYMENT
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

    const body =
      req.body || {};

    const orderId =
      String(
        body.razorpayOrderId || ""
      );

    const paymentId =
      String(
        body.razorpayPaymentId || ""
      );

    const signature =
      String(
        body.razorpaySignature || ""
      );


    /* =====================================================
       BASIC VALIDATION
    ===================================================== */

    if (
      !orderId ||
      !paymentId ||
      !signature
    ) {

      return json(res, 400, {

        verified:
          false,

        captured:
          false,

        finalized:
          false,

        error:
          "Incomplete payment response.",
      });
    }


    /* =====================================================
       FIND PAYMENT ATTEMPT
    ===================================================== */

    const attemptSnap =
      await db
        .collection(
          "paymentAttempts"
        )
        .doc(orderId)
        .get();


    if (!attemptSnap.exists) {

      return json(res, 400, {

        verified:
          false,

        captured:
          false,

        finalized:
          false,

        error:
          "Unknown Razorpay order.",
      });
    }


    /* =====================================================
       VERIFY RAZORPAY SIGNATURE
    ===================================================== */

    const signatureValid =
      verifySignature(
        orderId,
        paymentId,
        signature
      );


    if (!signatureValid) {

      return json(res, 400, {

        verified:
          false,

        captured:
          false,

        finalized:
          false,

        error:
          "Invalid payment signature.",
      });
    }


    /* =====================================================
       PAYMENT ATTEMPT
    ===================================================== */

    const attempt =
      attemptSnap.data();


    /* =====================================================
       GET PAYMENT FROM RAZORPAY
    ===================================================== */

    const payment =
      await razorpayRequest(
        `/payments/${paymentId}`,
        {
          method: "GET",
        }
      );


    /* =====================================================
       VERIFY ORDER / AMOUNT / CURRENCY
    ===================================================== */

    if (
      payment.order_id !==
        orderId
    ) {

      return json(res, 400, {

        verified:
          false,

        captured:
          false,

        finalized:
          false,

        error:
          "Payment order mismatch.",
      });
    }


    if (
      Number(payment.amount) !==
      Number(
        attempt.expectedAmount
      )
    ) {

      return json(res, 400, {

        verified:
          false,

        captured:
          false,

        finalized:
          false,

        error:
          "Payment amount mismatch.",
      });
    }


    if (
      payment.currency !==
      "INR"
    ) {

      return json(res, 400, {

        verified:
          false,

        captured:
          false,

        finalized:
          false,

        error:
          "Payment currency mismatch.",
      });
    }


    /* =====================================================
       CAPTURE CHECK
    ===================================================== */

    if (
      payment.status !==
        "captured" ||
      payment.captured !==
        true
    ) {

      return json(res, 400, {

        verified:
          false,

        captured:
          false,

        finalized:
          false,

        error:
          `Payment is not captured. Current status: ${
            payment.status ||
            "unknown"
          }.`,
      });
    }


    /* =====================================================
       CREATE FINAL FIREBASE ORDER
    ===================================================== */

    const orderDocId =
      await createFinalOrderFromAttempt(
        {
          ...attempt,

          razorpayOrderId:
            orderId,
        },

        payment,

        signature
      );


    /* =====================================================
       SUCCESS
    ===================================================== */

    return json(res, 200, {

      verified:
        true,

      captured:
        true,

      finalized:
        true,

      orderId:
        orderDocId,

      paymentId:
        paymentId,

      paymentStatus:
        payment.status,

      method:
        payment.method ||
        null,
    });

  } catch (error) {

    console.error(
      "VERIFY PAYMENT ERROR:",
      error
    );

    return json(res, 500, {

      verified:
        false,

      captured:
        false,

      finalized:
        false,

      error:
        error?.message ||
        "Payment service error.",
    });
  }
}
