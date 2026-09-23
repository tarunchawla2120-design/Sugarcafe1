import { useState, useEffect } from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase";

import "./Orders.css";

function Orders() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");

  const [order, setOrder] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // =====================================================
  // TRACK ORDER
  // =====================================================

  const trackOrder = () => {
    const orderNo = orderNumber.trim().toUpperCase();
    const mobile = phone.replace(/\D/g, "");

    setError("");
    setOrder(null);

    if (!orderNo) {
      setError("Please enter your Order Number.");
      return;
    }

    if (!mobile) {
      setError("Please enter your mobile number.");
      return;
    }

    if (mobile.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setSearching(true);

    const ordersQuery = query(
      collection(db, "orders"),
      where("orderNumber", "==", orderNo),
      where("phone", "==", mobile)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,

      (snapshot) => {
        if (snapshot.empty) {
          setOrder(null);
          setSearching(false);
          setError(
            "Order not found. Please check your Order Number and Mobile Number."
          );
          return;
        }

        const doc = snapshot.docs[0];

        setOrder({
          id: doc.id,
          ...doc.data(),
        });

        setSearching(false);
        setError("");
      },

      (err) => {
        console.error("Order tracking error:", err);

        setSearching(false);
        setError(
          "Unable to track order right now. Please try again."
        );
      }
    );

    // Save unsubscribe function for cleanup
    window.__sugarCafeOrderUnsubscribe = unsubscribe;
  };

  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {
    return () => {
      if (window.__sugarCafeOrderUnsubscribe) {
        window.__sugarCafeOrderUnsubscribe();
        window.__sugarCafeOrderUnsubscribe = null;
      }
    };
  }, []);

  // =====================================================
  // STATUS
  // =====================================================

  const getStatus = (status) => {
    const value = String(status || "New").toLowerCase();

    if (value.includes("cancel")) {
      return {
        icon: "❌",
        title: "Order Cancelled",
        className: "status-cancelled",
      };
    }

    if (value.includes("delivered")) {
      return {
        icon: "🎉",
        title: "Delivered",
        className: "status-delivered",
      };
    }

    if (
      value.includes("dispatch") ||
      value.includes("out for")
    ) {
      return {
        icon: "🛵",
        title: "Out for Delivery",
        className: "status-dispatched",
      };
    }

    if (value.includes("ready")) {
      return {
        icon: "✅",
        title: "Food Ready",
        className: "status-ready",
      };
    }

    if (
      value.includes("prepar") ||
      value.includes("cooking")
    ) {
      return {
        icon: "👨‍🍳",
        title: "Preparing",
        className: "status-preparing",
      };
    }

    return {
      icon: "🆕",
      title: "Order Received",
      className: "status-new",
    };
  };

  // =====================================================
  // DATE
  // =====================================================

  const formatDate = (createdAt) => {
    if (!createdAt) {
      return "—";
    }

    try {
      const date = createdAt.toDate
        ? createdAt.toDate()
        : new Date(createdAt);

      return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return "—";
    }
  };

  // =====================================================
  // ORDER TRACKING TIMELINE
  // =====================================================

  const renderTimeline = () => {
    if (!order) return null;

    const current = String(
      order.status || "New"
    ).toLowerCase();

    const cancelled = current.includes("cancel");

    if (cancelled) {
      return (
        <div className="tracking-timeline">
          <div className="tracking-step active">
            <span>❌</span>
            <strong>Order Cancelled</strong>
          </div>
        </div>
      );
    }

    const steps = [
      {
        key: "new",
        label: "Order Received",
        icon: "🆕",
      },
      {
        key: "preparing",
        label: "Preparing",
        icon: "👨‍🍳",
      },
      {
        key: "ready",
        label: "Food Ready",
        icon: "✅",
      },
      {
        key: "dispatched",
        label: "Out for Delivery",
        icon: "🛵",
      },
      {
        key: "delivered",
        label: "Delivered",
        icon: "🎉",
      },
    ];

    let activeIndex = 0;

    if (current.includes("prepar")) {
      activeIndex = 1;
    } else if (current.includes("ready")) {
      activeIndex = 2;
    } else if (
      current.includes("dispatch") ||
      current.includes("out for")
    ) {
      activeIndex = 3;
    } else if (current.includes("delivered")) {
      activeIndex = 4;
    }

    return (
      <div className="tracking-timeline">
        {steps.map((step, index) => (
          <div
            className={`tracking-step ${
              index <= activeIndex ? "active" : ""
            }`}
            key={step.key}
          >
            <span className="tracking-icon">
              {step.icon}
            </span>

            <strong>{step.label}</strong>
          </div>
        ))}
      </div>
    );
  };

  const status = order
    ? getStatus(order.status)
    : null;

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="orders-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="orders-header">

        <div>
          <h2>📦 Track My Order</h2>

          <p>
            Enter your order details to track your order.
          </p>
        </div>

      </div>

      {/* =================================================
          SEARCH BOX
      ================================================= */}

      <div className="track-order-box">

        <div className="track-order-field">

          <label>
            Order Number
          </label>

          <input
            type="text"
            value={orderNumber}
            onChange={(e) =>
              setOrderNumber(
                e.target.value.toUpperCase()
              )
            }
            placeholder="Example: SC-1758671234567"
          />

        </div>

        <div className="track-order-field">

          <label>
            Mobile Number
          </label>

          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) =>
              setPhone(
                e.target.value.replace(/\D/g, "")
              )
            }
            placeholder="Enter 10-digit mobile number"
          />

        </div>

        {error && (
          <div className="track-order-error">
            ⚠️ {error}
          </div>
        )}

        <button
          type="button"
          className="track-order-btn"
          onClick={trackOrder}
          disabled={searching}
        >
          {searching
            ? "Checking Order..."
            : "🔍 Track Order"}
        </button>

      </div>

      {/* =================================================
          ORDER RESULT
      ================================================= */}

      {order && (

        <div className="tracked-order-card">

          {/* ORDER HEADER */}

          <div className="tracked-order-header">

            <div>

              <small>
                ORDER NUMBER
              </small>

              <h3>
                #
                {order.orderNumber ||
                  order.id}
              </h3>

              <p>
                {formatDate(
                  order.createdAt
                )}
              </p>

            </div>

            {status && (
              <div
                className={`order-status ${status.className}`}
              >
                {status.icon} {status.title}
              </div>
            )}

          </div>

          {/* TIMELINE */}

          {renderTimeline()}

          {/* ORDER ITEMS */}

          <div className="tracked-section">

            <h4>
              ORDER ITEMS
            </h4>

            {(order.items || []).map(
              (item, index) => {

                const quantity = Number(
                  item.qty ||
                    item.quantity ||
                    1
                );

                const price = Number(
                  item.price || 0
                );

                return (
                  <div
                    className="tracked-item"
                    key={
                      item.id ||
                      index
                    }
                  >

                    <div>

                      <strong>
                        {item.name ||
                          "Food Item"}
                      </strong>

                      <span>
                        × {quantity}
                      </span>

                    </div>

                    <strong>
                      ₹
                      {price *
                        quantity}
                    </strong>

                  </div>
                );
              }
            )}

          </div>

          {/* DELIVERY */}

          <div className="tracked-section">

            <h4>
              📍 DELIVERY ADDRESS
            </h4>

            <p>
              {order.address ||
                "Address not available"}
            </p>

          </div>

          {/* BILL */}

          <div className="tracked-section">

            <h4>
              💰 PAYMENT SUMMARY
            </h4>

            <div className="bill-row">
              <span>
                Subtotal
              </span>

              <span>
                ₹
                {Number(
                  order.subtotal || 0
                )}
              </span>
            </div>

            <div className="bill-row">
              <span>
                Delivery
              </span>

              <span>
                ₹
                {Number(
                  order.deliveryCharge || 0
                )}
              </span>
            </div>

            <div className="bill-row">
              <span>
                GST
              </span>

              <span>
                ₹
                {Number(
                  order.gst || 0
                )}
              </span>
            </div>

            <div className="bill-total">
              <strong>
                Total
              </strong>

              <strong>
                ₹
                {Number(
                  order.total || 0
                )}
              </strong>
            </div>

          </div>

          {/* PAYMENT METHOD */}

          <div className="tracked-payment">

            <span>
              Payment
            </span>

            <strong>
              {order.paymentMethod ||
                "Cash on Delivery"}
            </strong>

          </div>

        </div>

      )}

    </div>
  );
}

export default Orders;
