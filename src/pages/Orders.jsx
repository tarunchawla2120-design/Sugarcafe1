import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import { db } from "../firebase";
import "./Orders.css";

function Orders() {
  const navigate = useNavigate();

  const [customerId, setCustomerId] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedOrder, setExpandedOrder] = useState(null);

  // =====================================================
  // CUSTOMER ID
  // =====================================================

  useEffect(() => {
    try {
      const savedUser =
        localStorage.getItem("sugarCafeUser");

      const savedCustomerId =
        localStorage.getItem(
          "sugarCafeCustomerId"
        );

      if (savedUser) {
        const profile =
          JSON.parse(savedUser);

        const id =
          profile.customerId ||
          savedCustomerId ||
          "";

        setCustomerId(id);
      } else {
        setCustomerId(
          savedCustomerId || ""
        );
      }
    } catch (err) {
      console.error(
        "Customer profile error:",
        err
      );

      setCustomerId("");
    }
  }, []);

  // =====================================================
  // REALTIME ORDERS
  // =====================================================

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
          const orderList =
            snapshot.docs
              .map((orderDoc) => ({
                id: orderDoc.id,
                ...orderDoc.data(),
              }))
              .sort((a, b) => {
                const getTime = (
                  value
                ) => {
                  if (!value) return 0;

                  if (
                    typeof value.toMillis ===
                    "function"
                  ) {
                    return value.toMillis();
                  }

                  if (
                    typeof value.seconds ===
                    "number"
                  ) {
                    return (
                      value.seconds * 1000
                    );
                  }

                  const date =
                    new Date(value);

                  return Number.isNaN(
                    date.getTime()
                  )
                    ? 0
                    : date.getTime();
                };

                return (
                  getTime(b.createdAt) -
                  getTime(a.createdAt)
                );
              });

          setOrders(orderList);
          setLoading(false);
          setError("");

          // Automatically open newest order
          if (
            orderList.length > 0 &&
            expandedOrder === null
          ) {
            setExpandedOrder(
              orderList[0].id
            );
          }
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

  // =====================================================
  // STATUS
  // =====================================================

  const normalizeStatus = (status) =>
    String(status || "")
      .toLowerCase()
      .trim();

  const getStatusKey = (status) => {
    const current =
      normalizeStatus(status);

    if (
      current === "rejected" ||
      current === "cancelled" ||
      current === "canceled"
    ) {
      return "rejected";
    }

    if (
      current === "delivered" ||
      current === "completed"
    ) {
      return "delivered";
    }

    if (
      current === "dispatched" ||
      current === "out_for_delivery"
    ) {
      return "dispatched";
    }

    if (
      current === "food ready" ||
      current === "food_ready" ||
      current === "ready"
    ) {
      return "ready";
    }

    if (
      current === "preparing" ||
      current === "accepted" ||
      current === "confirmed"
    ) {
      return "preparing";
    }

    return "new";
  };

  const getStatusInfo = (status) => {
    const key =
      getStatusKey(status);

    const statusMap = {
      new: {
        title:
          "Waiting for Café Confirmation",
        shortTitle:
          "Waiting for Confirmation",
        icon: "🕐",
        color: "orange",
        description:
          "Your order has been received. Sugar Café staff will confirm it shortly.",
      },

      preparing: {
        title:
          "Order Confirmed",
        shortTitle:
          "Preparing",
        icon: "👨‍🍳",
        color: "green",
        description:
          "Sugar Café has accepted your order and is preparing your food.",
      },

      ready: {
        title:
          "Food Ready",
        shortTitle:
          "Food Ready",
        icon: "🍽️",
        color: "blue",
        description:
          "Your food is ready and will be dispatched shortly.",
      },

      dispatched: {
        title:
          "Out for Delivery",
        shortTitle:
          "Out for Delivery",
        icon: "🛵",
        color: "purple",
        description:
          "Your order is on the way.",
      },

      delivered: {
        title:
          "Delivered",
        shortTitle:
          "Delivered",
        icon: "✅",
        color: "green",
        description:
          "Your order has been delivered. Enjoy your meal!",
      },

      rejected: {
        title:
          "Order Rejected",
        shortTitle:
          "Rejected",
        icon: "❌",
        color: "red",
        description:
          "Unfortunately, Sugar Café could not accept this order.",
      },
    };

    return (
      statusMap[key] ||
      statusMap.new
    );
  };

  // =====================================================
  // TIMELINE
  // =====================================================

  const renderTimeline = (order) => {
    const currentKey =
      getStatusKey(order.status);

    if (currentKey === "rejected") {
      return (
        <div className="tracking-rejected">
          <div className="tracking-rejected-icon">
            ❌
          </div>

          <div>
            <strong>
              Order Rejected
            </strong>

            <p>
              {order.rejectionReason ||
                "This order was rejected by Sugar Café staff."}
            </p>
          </div>
        </div>
      );
    }

    const steps = [
      {
        key: "new",
        title:
          "Waiting for Confirmation",
        subtitle:
          "Order received",
        icon: "🕐",
      },
      {
        key: "preparing",
        title: "Preparing",
        subtitle:
          "Kitchen is preparing",
        icon: "👨‍🍳",
      },
      {
        key: "ready",
        title: "Food Ready",
        subtitle:
          "Ready for dispatch",
        icon: "🍽️",
      },
      {
        key: "dispatched",
        title: "Out for Delivery",
        subtitle:
          "On the way",
        icon: "🛵",
      },
      {
        key: "delivered",
        title: "Delivered",
        subtitle:
          "Order completed",
        icon: "✅",
      },
    ];

    const indexes = {
      new: 0,
      preparing: 1,
      ready: 2,
      dispatched: 3,
      delivered: 4,
    };

    const currentIndex =
      indexes[currentKey] ?? 0;

    return (
      <div className="tracking-timeline">
        {steps.map(
          (step, index) => {
            const completed =
              index <= currentIndex;

            const active =
              index === currentIndex;

            return (
              <div
                className={`tracking-step ${
                  completed
                    ? "completed"
                    : ""
                } ${
                  active
                    ? "active"
                    : ""
                }`}
                key={step.key}
              >
                <div className="tracking-left">
                  <div className="tracking-dot">
                    {completed
                      ? step.icon
                      : ""}
                  </div>

                  {index <
                    steps.length - 1 && (
                    <div
                      className={`tracking-line ${
                        index <
                        currentIndex
                          ? "completed"
                          : ""
                      }`}
                    />
                  )}
                </div>

                <div className="tracking-content">
                  <strong>
                    {step.title}
                  </strong>

                  <span>
                    {step.subtitle}
                  </span>
                </div>
              </div>
            );
          }
        )}
      </div>
    );
  };

  // =====================================================
  // DATE
  // =====================================================

  const formatDate = (value) => {
    if (!value) {
      return "Date unavailable";
    }

    try {
      let date;

      if (
        typeof value.toDate ===
        "function"
      ) {
        date = value.toDate();
      } else if (
        value.seconds
      ) {
        date = new Date(
          value.seconds * 1000
        );
      } else {
        date = new Date(value);
      }

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
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

  // =====================================================
  // PRICE
  // =====================================================

  const formatPrice = (value) => {
    return `₹${Number(
      value || 0
    ).toLocaleString("en-IN")}`;
  };

  // =====================================================
  // PAYMENT
  // =====================================================

  const getPaymentText = (
    order
  ) => {
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

  // =====================================================
  // ORDER ITEMS
  // =====================================================

  const getItems = (order) => {
    if (
      Array.isArray(order.items)
    ) {
      return order.items;
    }

    if (
      Array.isArray(order.cart)
    ) {
      return order.cart;
    }

    return [];
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="orders-page">
        <div className="orders-loading-card">
          <div className="loading-circle">
            ☕
          </div>

          <h2>
            Loading your orders
          </h2>

          <p>
            Please wait a moment...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // LOGIN
  // =====================================================

  if (!customerId) {
    return (
      <div className="orders-page">
        <div className="orders-empty-card">
          <div className="empty-icon">
            👤
          </div>

          <h2>
            Login to see your orders
          </h2>

          <p>
            Login with your mobile
            number to view and track
            your Sugar Café orders.
          </p>

          <button
            onClick={() =>
              navigate("/login", {
                state: {
                  from: "/orders",
                },
              })
            }
          >
            Login / Create Account
          </button>
        </div>
      </div>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <div className="orders-page">
        <div className="orders-empty-card">
          <div className="empty-icon">
            ⚠️
          </div>

          <h2>
            Unable to load orders
          </h2>

          <p>
            {error}
          </p>

          <button
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

  // =====================================================
  // NO ORDERS
  // =====================================================

  if (!orders.length) {
    return (
      <div className="orders-page">
        <div className="orders-empty-card">
          <div className="empty-icon">
            ☕
          </div>

          <h2>
            No orders yet
          </h2>

          <p>
            Your Sugar Café orders
            will appear here after
            you place your first order.
          </p>

          <button
            onClick={() =>
              navigate("/home")
            }
          >
            Explore Menu
          </button>
        </div>
      </div>
    );
  }

  // =====================================================
  // MAIN PAGE
  // =====================================================

  return (
    <div className="orders-page">

      <div className="orders-container">

        {/* HEADER */}

        <header className="orders-topbar">

          <div>
            <span className="orders-kicker">
              SUGAR CAFÉ
            </span>

            <h1>
              My Orders
            </h1>

            <p>
              Track your food from
              confirmation to delivery.
            </p>
          </div>

          <div className="customer-badge">
            <span>
              CUSTOMER ID
            </span>

            <strong>
              {customerId}
            </strong>
          </div>

        </header>

        {/* SUMMARY */}

        <div className="orders-summary">

          <div className="summary-item">
            <span>
              Total Orders
            </span>

            <strong>
              {orders.length}
            </strong>
          </div>

          <div className="summary-item">
            <span>
              Active
            </span>

            <strong>
              {
                orders.filter(
                  (order) => {
                    const key =
                      getStatusKey(
                        order.status
                      );

                    return (
                      key !==
                        "delivered" &&
                      key !==
                        "rejected"
                    );
                  }
                ).length
              }
            </strong>
          </div>

          <div className="summary-item">
            <span>
              Delivered
            </span>

            <strong>
              {
                orders.filter(
                  (order) =>
                    getStatusKey(
                      order.status
                    ) ===
                    "delivered"
                ).length
              }
            </strong>
          </div>

        </div>

        {/* ORDERS */}

        <div className="orders-list">

          {orders.map(
            (order, index) => {
              const statusInfo =
                getStatusInfo(
                  order.status
                );

              const items =
                getItems(order);

              const total =
                Number(
                  order.total ??
                    order.grandTotal ??
                    order.finalTotal ??
                    0
                );

              const isExpanded =
                expandedOrder ===
                order.id;

              return (
                <article
                  className={`order-card ${
                    isExpanded
                      ? "expanded"
                      : ""
                  }`}
                  key={order.id}
                >

                  {/* CARD HEADER */}

                  <button
                    className="order-card-summary"
                    onClick={() =>
                      setExpandedOrder(
                        isExpanded
                          ? null
                          : order.id
                      )
                    }
                  >

                    <div className="summary-main">

                      <div
                        className={`status-mini ${statusInfo.color}`}
                      >
                        {statusInfo.icon}
                      </div>

                      <div>
                        <span className="order-number">
                          #
                          {order.orderNumber ||
                            order.id}
                        </span>

                        <strong>
                          {
                            statusInfo.shortTitle
                          }
                        </strong>

                        <small>
                          {formatDate(
                            order.createdAt
                          )}
                        </small>
                      </div>

                    </div>

                    <div className="summary-right">

                      <strong>
                        {formatPrice(
                          total
                        )}
                      </strong>

                      <span
                        className={`status-pill ${statusInfo.color}`}
                      >
                        {statusInfo.shortTitle}
                      </span>

                      <span className="expand-icon">
                        {isExpanded
                          ? "⌃"
                          : "⌄"}
                      </span>

                    </div>

                  </button>

                  {/* DETAILS */}

                  {isExpanded && (
                    <div className="order-details">

                      {/* STATUS HERO */}

                      <div
                        className={`status-hero ${statusInfo.color}`}
                      >

                        <div className="status-hero-icon">
                          {
                            statusInfo.icon
                          }
                        </div>

                        <div>
                          <span>
                            CURRENT STATUS
                          </span>

                          <h2>
                            {
                              statusInfo.title
                            }
                          </h2>

                          <p>
                            {
                              statusInfo.description
                            }
                          </p>
                        </div>

                      </div>

                      {/* TRACKING */}

                      <section className="order-section tracking-section">

                        <div className="section-heading">
                          <div>
                            <span>
                              ORDER TRACKING
                            </span>

                            <h3>
                              Live order status
                            </h3>
                          </div>
                        </div>

                        {renderTimeline(
                          order
                        )}

                      </section>

                      {/* CUSTOMER */}

                      <section className="order-section">

                        <div className="section-heading">
                          <div>
                            <span>
                              CUSTOMER
                            </span>

                            <h3>
                              Customer Details
                            </h3>
                          </div>
                        </div>

                        <div className="customer-info-card">

                          <div className="customer-avatar">
                            {(
                              order.customerName ||
                              "C"
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {order.customerName ||
                                "Customer"}
                            </strong>

                            <span>
                              {order.phone ||
                                order.customerPhone ||
                                "Mobile unavailable"}
                            </span>

                            <small>
                              Customer ID:{" "}
                              {order.customerId ||
                                customerId}
                            </small>
                          </div>

                        </div>

                      </section>

                      {/* ITEMS */}

                      <section className="order-section">

                        <div className="section-heading">
                          <div>
                            <span>
                              ORDER
                            </span>

                            <h3>
                              Ordered Items
                            </h3>
                          </div>

                          <span className="item-count">
                            {items.length}{" "}
                            {items.length ===
                            1
                              ? "item"
                              : "items"}
                          </span>
                        </div>

                        <div className="items-card">

                          {items.length ===
                          0 ? (
                            <div className="no-items">
                              Order items
                              unavailable.
                            </div>
                          ) : (
                            items.map(
                              (
                                item,
                                itemIndex
                              ) => {
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
                                    className="food-item"
                                    key={
                                      item.id ||
                                      item.menuId ||
                                      itemIndex
                                    }
                                  >

                                    <div className="food-image">
                                      {item.image ? (
                                        <img
                                          src={
                                            item.image
                                          }
                                          alt=""
                                        />
                                      ) : (
                                        <span>
                                          🍽️
                                        </span>
                                      )}
                                    </div>

                                    <div className="food-info">
                                      <strong>
                                        {item.name ||
                                          item.title ||
                                          "Food Item"}
                                      </strong>

                                      <span>
                                        ₹
                                        {price.toLocaleString(
                                          "en-IN"
                                        )}{" "}
                                        ×{" "}
                                        {quantity}
                                      </span>
                                    </div>

                                    <strong className="food-price">
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

                      </section>

                      {/* ADDRESS */}

                      <section className="order-section">

                        <div className="section-heading">
                          <div>
                            <span>
                              DELIVERY
                            </span>

                            <h3>
                              Delivery Address
                            </h3>
                          </div>
                        </div>

                        <div className="address-card">
                          <div className="address-icon">
                            📍
                          </div>

                          <p>
                            {order.address ||
                              order.deliveryAddress ||
                              "Address unavailable"}
                          </p>
                        </div>

                      </section>

                      {/* BILL */}

                      <section className="order-section">

                        <div className="section-heading">
                          <div>
                            <span>
                              PAYMENT
                            </span>

                            <h3>
                              Bill Details
                            </h3>
                          </div>
                        </div>

                        <div className="bill-card">

                          <div>
                            <span>
                              Subtotal
                            </span>

                            <strong>
                              {formatPrice(
                                order.subtotal ??
                                  0
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Delivery
                            </span>

                            <strong>
                              {formatPrice(
                                order.deliveryCharge ??
                                  0
                              )}
                            </strong>
                          </div>

                          {Number(
                            order.discount ||
                              0
                          ) > 0 && (
                            <div className="discount-row">
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

                          {Number(
                            order.gst || 0
                          ) > 0 && (
                            <div>
                              <span>
                                GST
                              </span>

                              <strong>
                                {formatPrice(
                                  order.gst
                                )}
                              </strong>
                            </div>
                          )}

                          <div className="bill-total">
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

                        <div className="payment-status-card">

                          <div>
                            <span>
                              Payment Method
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

                            <strong
                              className={
                                String(
                                  order.paymentStatus ||
                                    ""
                                ).toLowerCase() ===
                                "paid"
                                  ? "paid"
                                  : "pending"
                              }
                            >
                              {order.paymentStatus ||
                                "Pending"}
                            </strong>
                          </div>

                        </div>

                      </section>

                      {/* FOOTER */}

                      <div className="order-actions">

                        <button
                          className="track-button"
                          onClick={() =>
                            setExpandedOrder(
                              order.id
                            )
                          }
                        >
                          📦 Tracking Active
                        </button>

                        <button
                          className="home-outline-button"
                          onClick={() =>
                            navigate(
                              "/home"
                            )
                          }
                        >
                          Order More
                        </button>

                      </div>

                    </div>
                  )}

                </article>
              );
            }
          )}

        </div>

      </div>
    </div>
  );
}

export default Orders;
