import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../firebase";
import "./Orders.css";

function Orders() {
  const [customerId, setCustomerId] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // GET CUSTOMER ID
  // --------------------------------------------------
  useEffect(() => {
    try {
      const savedUser =
        localStorage.getItem("sugarCafeUser");

      const savedCustomerId =
        localStorage.getItem("sugarCafeCustomerId");

      if (savedUser) {
        const profile = JSON.parse(savedUser);

        const id =
          profile.customerId ||
          savedCustomerId ||
          "";

        setCustomerId(id);
      } else {
        setCustomerId(savedCustomerId || "");
      }
    } catch (err) {
      console.error(
        "Customer profile error:",
        err
      );

      setCustomerId("");
    }
  }, []);

  // --------------------------------------------------
  // LOAD CUSTOMER ORDERS
  // --------------------------------------------------
  useEffect(() => {
    if (!customerId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    let unsubscribe;

    try {
      /*
        IMPORTANT:

        We only use where(customerId == customerId)
        here.

        We DO NOT use orderBy("createdAt", "desc")
        because that can require a Firestore
        composite index.
      */

      const ordersQuery = query(
        collection(db, "orders"),
        where(
          "customerId",
          "==",
          customerId
        )
      );

      unsubscribe = onSnapshot(
        ordersQuery,
        (snapshot) => {
          const orderList = snapshot.docs
            .map((orderDoc) => ({
              id: orderDoc.id,
              ...orderDoc.data(),
            }))
            .sort((a, b) => {
              const aTime =
                a.createdAt?.toMillis
                  ? a.createdAt.toMillis()
                  : a.createdAt?.seconds
                  ? a.createdAt.seconds * 1000
                  : 0;

              const bTime =
                b.createdAt?.toMillis
                  ? b.createdAt.toMillis()
                  : b.createdAt?.seconds
                  ? b.createdAt.seconds * 1000
                  : 0;

              return bTime - aTime;
            });

          setOrders(orderList);
          setLoading(false);
          setError("");
        },
        (firebaseError) => {
          console.error(
            "Orders listener error:",
            firebaseError
          );

          setLoading(false);

          setError(
            "Unable to load your orders. Please try again."
          );
        }
      );
    } catch (err) {
      console.error(
        "Orders query error:",
        err
      );

      setLoading(false);

      setError(
        "Unable to load your orders."
      );
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [customerId]);

  // --------------------------------------------------
  // STATUS HELPERS
  // --------------------------------------------------

  const getStatusIndex = (status) => {
    const currentStatus =
      String(status || "")
        .toLowerCase()
        .trim();

    if (
      currentStatus === "rejected" ||
      currentStatus === "cancelled" ||
      currentStatus === "canceled"
    ) {
      return -1;
    }

    if (
      currentStatus === "delivered" ||
      currentStatus === "completed"
    ) {
      return 4;
    }

    if (
      currentStatus === "dispatched" ||
      currentStatus === "out_for_delivery"
    ) {
      return 3;
    }

    if (
      currentStatus === "ready" ||
      currentStatus === "food_ready"
    ) {
      return 2;
    }

    if (
      currentStatus === "preparing" ||
      currentStatus === "accepted" ||
      currentStatus === "confirmed"
    ) {
      return 1;
    }

    return 0;
  };

  const getStatusText = (status) => {
    const currentStatus =
      String(status || "")
        .toLowerCase()
        .trim();

    switch (currentStatus) {
      case "pending":
        return "Order Placed";

      case "accepted":
        return "Order Accepted";

      case "preparing":
        return "Preparing Your Order";

      case "ready":
        return "Food Ready";

      case "dispatched":
        return "Out for Delivery";

      case "out_for_delivery":
        return "Out for Delivery";

      case "delivered":
        return "Delivered";

      case "completed":
        return "Completed";

      case "rejected":
        return "Order Rejected";

      case "cancelled":
      case "canceled":
        return "Order Cancelled";

      default:
        return "Order Placed";
    }
  };

  // --------------------------------------------------
  // DATE FORMAT
  // --------------------------------------------------

  const formatDate = (value) => {
    if (!value) {
      return "Date unavailable";
    }

    try {
      let date;

      if (
        typeof value?.toDate === "function"
      ) {
        date = value.toDate();
      } else if (
        value?.seconds
      ) {
        date = new Date(
          value.seconds * 1000
        );
      } else {
        date = new Date(value);
      }

      if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
      }

      return date.toLocaleString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );
    } catch {
      return "Date unavailable";
    }
  };

  // --------------------------------------------------
  // PRICE FORMAT
  // --------------------------------------------------

  const formatPrice = (value) => {
    const amount = Number(value || 0);

    return `₹${amount.toLocaleString(
      "en-IN"
    )}`;
  };

  // --------------------------------------------------
  // PAYMENT TEXT
  // --------------------------------------------------

  const getPaymentText = (order) => {
    const method =
      String(
        order?.paymentMethod ||
          order?.paymentMode ||
          ""
      ).toLowerCase();

    if (
      method.includes("razorpay") ||
      method.includes("upi") ||
      method.includes("online")
    ) {
      return "Online Payment";
    }

    if (
      method.includes("cod") ||
      method.includes("cash")
    ) {
      return "Cash on Delivery";
    }

    return (
      order?.paymentMethod ||
      "Payment"
    );
  };

  // --------------------------------------------------
  // STATUS TIMELINE
  // --------------------------------------------------

  const renderTimeline = (order) => {
    const currentIndex =
      getStatusIndex(order.status);

    const steps = [
      {
        title: "Order Placed",
        icon: "📝",
      },
      {
        title: "Preparing",
        icon: "👨‍🍳",
      },
      {
        title: "Food Ready",
        icon: "🍽️",
      },
      {
        title: "Out for Delivery",
        icon: "🛵",
      },
      {
        title: "Delivered",
        icon: "✅",
      },
    ];

    if (currentIndex === -1) {
      return (
        <div className="order-status-box">
          <div className="order-status-rejected">
            ❌ {getStatusText(order.status)}
          </div>
        </div>
      );
    }

    return (
      <div className="order-timeline">
        {steps.map((step, index) => {
          const completed =
            index <= currentIndex;

          return (
            <div
              className={`timeline-step ${
                completed
                  ? "completed"
                  : ""
              }`}
              key={step.title}
            >
              <div className="timeline-icon">
                {step.icon}
              </div>

              <div className="timeline-title">
                {step.title}
              </div>

              {index <
                steps.length - 1 && (
                <div
                  className={`timeline-line ${
                    index <
                    currentIndex
                      ? "completed"
                      : ""
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="orders-page">
        <div className="orders-loading">
          <div className="orders-spinner" />
          <h2>Loading your orders...</h2>
          <p>
            Please wait while we fetch your
            orders.
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // NO CUSTOMER
  // --------------------------------------------------

  if (!customerId) {
    return (
      <div className="orders-page">
        <div className="orders-empty">
          <div className="orders-empty-icon">
            👤
          </div>

          <h2>Login to see your orders</h2>

          <p>
            Please login with your mobile
            number to view your Sugar Café
            orders.
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // ERROR
  // --------------------------------------------------

  if (error) {
    return (
      <div className="orders-page">
        <div className="orders-error">
          <div className="orders-error-icon">
            ⚠️
          </div>

          <h2>
            Unable to load orders
          </h2>

          <p>{error}</p>

          <button
            className="orders-retry-btn"
            onClick={() =>
              window.location.reload()
            }
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // NO ORDERS
  // --------------------------------------------------

  if (orders.length === 0) {
    return (
      <div className="orders-page">
        <div className="orders-empty">
          <div className="orders-empty-icon">
            ☕
          </div>

          <h2>No orders yet</h2>

          <p>
            Your Sugar Café orders will
            appear here after you place
            your first order.
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // ORDERS PAGE
  // --------------------------------------------------

  return (
    <div className="orders-page">
      <div className="orders-container">

        <div className="orders-header">
          <h1>My Orders</h1>

          <p>
            Customer ID:{" "}
            <strong>
              {customerId}
            </strong>
          </p>
        </div>

        <div className="orders-count">
          {orders.length}{" "}
          {orders.length === 1
            ? "Order"
            : "Orders"}
        </div>

        {orders.map((order) => {
          const items =
            Array.isArray(order.items)
              ? order.items
              : [];

          const total =
            Number(
              order.total ??
                order.grandTotal ??
                order.finalTotal ??
                0
            );

          return (
            <div
              className="order-card"
              key={order.id}
            >

              {/* ORDER HEADER */}

              <div className="order-card-header">

                <div>
                  <span className="order-label">
                    Order
                  </span>

                  <h2>
                    #
                    {order.orderNumber ||
                      order.id}
                  </h2>
                </div>

                <div className="order-date">
                  {formatDate(
                    order.createdAt
                  )}
                </div>

              </div>

              {/* STATUS */}

              <div className="order-current-status">
                <span>
                  Current Status
                </span>

                <strong>
                  {getStatusText(
                    order.status
                  )}
                </strong>
              </div>

              {renderTimeline(order)}

              {/* CUSTOMER */}

              <div className="order-section">
                <h3>
                  👤 Customer
                </h3>

                <div className="order-info-grid">

                  <div>
                    <span>Name</span>
                    <strong>
                      {order.customerName ||
                        "Customer"}
                    </strong>
                  </div>

                  <div>
                    <span>Mobile</span>
                    <strong>
                      {order.phone ||
                        order.customerPhone ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Customer ID
                    </span>
                    <strong>
                      {order.customerId ||
                        customerId}
                    </strong>
                  </div>

                </div>
              </div>

              {/* ITEMS */}

              <div className="order-section">
                <h3>
                  🛍️ Ordered Items
                </h3>

                <div className="order-items">

                  {items.length === 0 ? (
                    <p>
                      Order items unavailable.
                    </p>
                  ) : (
                    items.map(
                      (item, index) => {
                        const quantity =
                          Number(
                            item.quantity ||
                              item.qty ||
                              1
                          );

                        const price =
                          Number(
                            item.price ||
                              item.salePrice ||
                              0
                          );

                        return (
                          <div
                            className="order-item"
                            key={
                              item.id ||
                              item.menuId ||
                              index
                            }
                          >
                            <div>
                              <strong>
                                {item.name ||
                                  item.title ||
                                  "Item"}
                              </strong>

                              <span>
                                ×{" "}
                                {quantity}
                              </span>
                            </div>

                            <strong>
                              {formatPrice(
                                price *
                                  quantity
                              )}
                            </strong>
                          </div>
                        );
                      }
                    )
                  )}

                </div>
              </div>

              {/* ADDRESS */}

              <div className="order-section">
                <h3>
                  📍 Delivery Address
                </h3>

                <div className="order-address">
                  {order.address ||
                    order.deliveryAddress ||
                    "Address unavailable"}
                </div>
              </div>

              {/* BILL */}

              <div className="order-section">
                <h3>
                  💳 Bill Details
                </h3>

                <div className="order-bill">

                  {order.subtotal !==
                    undefined && (
                    <div>
                      <span>
                        Subtotal
                      </span>

                      <strong>
                        {formatPrice(
                          order.subtotal
                        )}
                      </strong>
                    </div>
                  )}

                  {order.deliveryCharge !==
                    undefined && (
                    <div>
                      <span>
                        Delivery
                      </span>

                      <strong>
                        {formatPrice(
                          order.deliveryCharge
                        )}
                      </strong>
                    </div>
                  )}

                  {order.discount !==
                    undefined &&
                    Number(
                      order.discount
                    ) > 0 && (
                      <div>
                        <span>
                          Discount
                        </span>

                        <strong>
                          -
                          {formatPrice(
                            order.discount
                          )}
                        </strong>
                      </div>
                    )}

                  <div className="order-total">
                    <span>
                      Total
                    </span>

                    <strong>
                      {formatPrice(
                        total
                      )}
                    </strong>
                  </div>

                </div>
              </div>

              {/* PAYMENT */}

              <div className="order-payment">
                <div>
                  <span>
                    Payment
                  </span>

                  <strong>
                    {getPaymentText(
                      order
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Payment Status
                  </span>

                  <strong>
                    {order.paymentStatus ||
                      "Pending"}
                  </strong>
                </div>
              </div>

            </div>
          );
        })}

      </div>
    </div>
  );
}

export default Orders;
