import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PAYMENT_SERVER_PORT || 8267);
const KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let data = "";
  req.on("data", (chunk) => { data += chunk; });
  req.on("end", () => {
    try { resolve(data ? JSON.parse(data) : {}); }
    catch (error) { reject(error); }
  });
  req.on("error", reject);
});

const razorpayRequest = async (path, options = {}) => {
  if (!KEY_ID || !KEY_SECRET) {
    throw new Error("Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.");
  }

  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
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

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && req.url === "/api/payment/health") {
      return json(res, 200, {
        ok: true,
        razorpayConfigured: Boolean(KEY_ID && KEY_SECRET),
        port: PORT,
      });
    }

    if (req.method === "POST" && req.url === "/api/payment/create-order") {
      const body = await readBody(req);
      const orderData = body.orderData || {};
      const items = Array.isArray(orderData.items) ? orderData.items : [];

      if (!items.length) {
        return json(res, 400, { error: "Cart is empty." });
      }

      const subtotal = items.reduce((sum, item) => {
        const price = Number(item?.price);
        const qty = Math.floor(Number(item?.qty));
        if (!Number.isFinite(price) || price < 0 || !Number.isFinite(qty) || qty < 1 || qty > 99) {
          throw new Error("Invalid cart item.");
        }
        return sum + price * qty;
      }, 0);

      const delivery = Number(orderData.deliveryCharge || 0);
      const discount = Number(orderData.discount || 0);
      const gst = Number(orderData.gst || 0);
      const calculatedTotal = subtotal + delivery - discount + gst;
      const requestedTotal = Number(orderData.total);

      if (!Number.isFinite(requestedTotal) || Math.round(requestedTotal * 100) !== Math.round(calculatedTotal * 100)) {
        return json(res, 400, { error: "Order total changed. Please refresh your cart and try again." });
      }

      const razorpayOrder = await razorpayRequest("/orders", {
        method: "POST",
        body: JSON.stringify({
          amount: Math.round(calculatedTotal * 100),
          currency: "INR",
          receipt: String(orderData.orderNumber || `SC-${Date.now()}`),
          notes: {
            sugarcafe_order_number: String(orderData.orderNumber || ""),
          },
        }),
      });

      return json(res, 200, {
        keyId: KEY_ID,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        serverValidatedTotal: calculatedTotal,
        finalized: false,
      });
    }

    if (req.method === "POST" && req.url === "/api/payment/verify") {
      const body = await readBody(req);
      const orderId = String(body.razorpayOrderId || "");
      const paymentId = String(body.razorpayPaymentId || "");
      const receivedSignature = String(body.razorpaySignature || "");

      if (!orderId || !paymentId || !receivedSignature) {
        return json(res, 400, { verified: false, error: "Incomplete payment response." });
      }

      const expectedSignature = crypto
        .createHmac("sha256", KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const expected = Buffer.from(expectedSignature, "utf8");
      const received = Buffer.from(receivedSignature, "utf8");
      const verified =
        expected.length === received.length &&
        crypto.timingSafeEqual(expected, received);

      if (!verified) {
        return json(res, 400, { verified: false, error: "Invalid payment signature." });
      }

      const payment = await razorpayRequest(`/payments/${paymentId}`, {
        method: "GET",
      });

      if (
        payment.order_id !== orderId ||
        payment.currency !== "INR" ||
        payment.status !== "captured" ||
        payment.captured !== true
      ) {
        return json(res, 400, {
          verified: false,
          captured: false,
          error: `Payment is not captured or order does not match. Current status: ${payment.status || "unknown"}.`,
        });
      }

      return json(res, 200, {
        verified: true,
        captured: true,
        finalized: false,
        paymentId,
        paymentStatus: payment.status,
        method: payment.method || null,
      });
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("Payment server error:", error.message);
    return json(res, 500, { error: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sugar Cafe payment server running on http://0.0.0.0:${PORT}`);
});
