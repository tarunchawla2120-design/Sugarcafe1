import { useEffect, useMemo, useState } from "react";
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
  const [, setNow] = useState(Date.now());

  // =====================================================
  // CUSTOMER ID
  // =====================================================

  useEffect(() => {
    try {
      const savedUser =
        localStorage.getItem("sugarCafeUser");

      const savedCustomerId =
        localStorage.getItem("sugarCafeCustomerId");

      if (savedUser) {
        const profile = JSON.parse(savedUser);

        setCustomerId(
          profile.customerId ||
            savedCustomerId ||
            ""
        );
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

  // =====================================================
  // REALTIME CLOCK
  // =====================================================

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
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

    const ordersQuery = query(
      collection(db, "orders"),
      where(
        "customerId",
        "==",
        customerId
      )
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const getTime = (value) => {
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
            return value.seconds * 1000;
          }

          const date = new Date(value);

          return Number.isNaN(
            date.getTime()
          )
            ? 0
            : date.getTime();
        };

        const orderList =
          snapshot.docs
            .map((orderDoc) => ({
              id: orderDoc.id,
              ...orderDoc.data(),
            }))
            .sort(
              (a, b) =>
                getTime(b.createdAt) -
                getTime(a.createdAt)
            );

        setOrders(orderList);
        setLoading(false);
        setError("");

        setExpandedOrder((current) => {
          if (
            current === null &&
            orderList.length > 0
          ) {
            return orderList[0].id;
          }

          return current;
        });
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

    return () => unsubscribe();
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
      [
        "rejected",
        "cancelled",
        "canceled",
      ].includes(current)
    ) {
      return "rejected";
    }

    if (
      [
        "delivered",
        "completed",
      ].includes(current)
    ) {
      return "delivered";
    }

    if (
      [
        "dispatched",
        "out_for_delivery",
        "out for delivery",
      ].includes(current)
    ) {
      return "dispatched";
    }

    if (
      [
        "food ready",
        "food_ready",
        "ready",
      ].includes(current)
    ) {
      return "ready";
    }

    if (
      [
        "preparing",
        "accepted",
        "confirmed",
      ].includes(current)
    ) {
      return "preparing";
    }

    return "new";
  };

  const statusData = {
    new: {
      title:
        "Waiting for Café Confirmation",
      short:
        "Waiting for Confirmation",
      icon: "🕐",
      color: "orange",
      description:
        "Your order has been received. Sugar Café staff will confirm it shortly.",
    },

    preparing: {
      title:
        "Order Confirmed",
      short:
        "Preparing",
      icon: "👨‍🍳",
      color: "green",
      description:
        "Sugar Café has accepted your order and the kitchen is preparing it.",
    },

    ready: {
      title:
        "Food Ready",
      short:
        "Food Ready",
      icon: "🍽️",
      color: "blue",
      description:
        "Your food is ready and will be dispatched shortly.",
    },

    dispatched: {
      title:
        "Out for Delivery",
      short:
        "Out for Delivery",
      icon: "🛵",
      color: "purple",
      description:
        "Your order is on the way.",
    },

    delivered: {
      title:
        "Delivered",
      short:
        "Delivered",
      icon: "✅",
      color: "green",
      description:
        "Your order has been delivered. Enjoy your meal!",
    },

    rejected: {
      title:
        "Order Rejected",
      short:
        "Rejected",
      icon: "❌",
      color: "red",
      description:
        "Unfortunately, Sugar Café could not accept this order.",
    },
  };

  const getStatusInfo = (status) =>
    statusData[
      getStatusKey(status)
    ] || statusData.new;

  // =====================================================
  // DATE / TIME
  // =====================================================

  const getMillis = (value) => {
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
      return value.seconds * 1000;
    }

    const date = new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? 0
      : date.getTime();
  };

  const formatDate = (value) => {
    const millis = getMillis(value);

    if (!millis) {
      return "Not available";
    }

    return new Date(
      millis
    ).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (value) => {
    const millis = getMillis(value);

    if (!millis) {
      return "—";
    }

    return new Date(
      millis
    ).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // =====================================================
  // COUNTDOWN
  // =====================================================

  const getCountdown = (order) => {
    if (
      getStatusKey(order.status) !==
      "preparing"
    ) {
      return null;
    }

    const end =
      getMillis(
        order.preparationEndAt
      );

    if (!end) {
      return null;
    }

    const remaining = Math.max(
      0,
      end - Date.now()
    );

    const totalSeconds =
      Math.floor(
        remaining / 1000
      );

    const minutes =
      Math.floor(
        totalSeconds / 60
      );

    const seconds =
      totalSeconds % 60;

    return {
      expired:
        remaining <= 0,

      text: `${String(
        minutes
      ).padStart(2, "0")}:${String(
        seconds
      ).padStart(2, "0")}`,

      minutes,
      seconds,
    };
  };

  // =====================================================
  // TIMELINE
  // =====================================================

  const renderTimeline = (order) => {
    const currentKey =
      getStatusKey(order.status);

    if (
      currentKey ===
      "rejected"
    ) {
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
          "Order Received",
        subtitle:
          "Waiting for café confirmation",
        icon: "📥",
        time:
          order.createdAt,
      },

      {
        key: "preparing",
        title:
          "Order Confirmed",
        subtitle:
          "Kitchen is preparing your food",
        icon: "👨‍🍳",
        time:
          order.acceptedAt ||
          order.preparationStartedAt,
      },

      {
        key: "ready",
        title:
          "Food Ready",
        subtitle:
          "Ready for dispatch",
        icon: "🍽️",
        time:
          order.foodReadyAt,
      },

      {
        key: "dispatched",
        title:
          "Out for Delivery",
        subtitle:
          "Order is on the way",
        icon: "🛵",
        time:
          order.dispatchedAt,
      },

      {
        key: "delivered",
        title:
          "Delivered",
        subtitle:
          "Order completed",
        icon: "✅",
        time:
          order.deliveredAt,
      },
    ];

    const indexMap = {
      new: 0,
      preparing: 1,
      ready: 2,
      dispatched: 3,
      delivered: 4,
    };

    const currentIndex =
      indexMap[currentKey] ?? 0;

    return (
      <div className="tracking-timeline">
        {steps.map(
          (step, index) => {
            const completed =
              index <= currentIndex;

            const active =
              index ===
              currentIndex;

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
                    steps.length -
                      1 && (
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

                  {step.time && (
                    <small>
                      {formatTime(
                        step.time
                      )}
                    </small>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    );
  };

  // =====================================================
  // PRICE
  // =====================================================

  const formatPrice = (value) =>
    `₹${Number(
      value || 0
    ).toLocaleString("en-IN")}`;

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
  // ITEMS
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
  // ORDER COUNTS
  // =====================================================

  const activeOrders = useMemo(
    () =>
      orders.filter((order) => {
        const key =
          getStatusKey(
            order.status
          );

        return (
          key !== "delivered" &&
          key !== "rejected"
        );
      }),
    [orders]
  );

  const deliveredOrders =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            getStatusKey(
              order.status
            ) === "delivered"
        ),
      [orders]
    );

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
  // MAIN
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
              {activeOrders.length}
            </strong>
          </div>

          <div className="summary-item">
            <span>
              Delivered
            </span>

            <strong>
              {deliveredOrders.length}
            </strong>
          </div>

        </div>

        {/* ACTIVE ORDER BANNER */}

        {activeOrders.length >
          0 && (
          <div className="active-orders-banner">
            <div className="active-pulse">
              🔴
            </div>

            <div>
              <strong>
                {activeOrders.length ===
                1
                  ? "Your order is active"
                  : `${activeOrders.length} active orders`}
              </strong>

              <span>
                Order status is updating
                automatically.
              </span>
            </div>
          </div>
        )}

        {/* ORDERS */}

        <div className="orders-list">

          {orders.map((order) => {
            const statusInfo =
              getStatusInfo(
                order.status
              );

            const statusKey =
              getStatusKey(
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

            const countdown =
              getCountdown(order);

            const isActive =
              statusKey !==
                "delivered" &&
              statusKey !==
                "rejected";

            return (
              <article
                className={`order-card ${
                  isExpanded
                    ? "expanded"
                    : ""
                } ${
                  isActive
                    ? "active-order-card"
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
                      {
                        statusInfo.icon
                      }
                    </div>

                    <div>
                      <span className="order-number">
                        #
                        {order.orderNumber ||
                          order.id}
                      </span>

                      <strong>
                        {
                          statusInfo.short
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
                      {
                        statusInfo.short
                      }
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

                    {/* COUNTDOWN */}

                    {countdown && (
                      <div
                        className={`preparation-countdown ${
                          countdown.expired
                            ? "expired"
                            : ""
                        }`}
                      >

                        <div className="countdown-icon">
                          ⏱️
                        </div>

                        <div className="countdown-info">
                          <span>
                            {countdown.expired
                              ? "Preparation time completed"
                              : "Kitchen preparation time"}
                          </span>

                          <strong>
                            {countdown.expired
                              ? "Food will be ready shortly"
                              : countdown.text}
                          </strong>

                          {!countdown.expired && (
                            <small>
                              Sugar Café is preparing
                              your order.
                            </small>
                          )}
                        </div>

                      </div>
                    )}

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

                        {isActive && (
                          <span className="live-badge">
                            ● LIVE
                          </span>
                        )}
                      </div>

                      {renderTimeline(
                        order
                      )}

                    </section>

                    {/* ORDER TIME INFO */}

                    <section className="order-section">

                      <div className="section-heading">
                        <div>
                          <span>
                            ORDER JOURNEY
                          </span>

                          <h3>
                            Important times
                          </h3>
                        </div>
                      </div>

                      <div className="time-grid">

                        <div>
                          <span>
                            Order Placed
                          </span>

                          <strong>
                            {formatTime(
                              order.createdAt
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Accepted
                          </span>

                          <strong>
                            {formatTime(
                              order.acceptedAt ||
                                order.preparationStartedAt
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Food Ready
                          </span>

                          <strong>
                            {formatTime(
                              order.foodReadyAt
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Dispatched
                          </span>

                          <strong>
                            {formatTime(
                              order.dispatchedAt
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Delivered
                          </span>

                          <strong>
                            {formatTime(
                              order.deliveredAt
                            )}
                          </strong>
                        </div>

                      </div>

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

                    {/* ACTIONS */}

                    <div className="order-actions">

                      {isActive && (
                        <div className="tracking-active-message">
                          🔄 Your order status will
                          update automatically.
                        </div>
                      )}

                      <button
                        className="home-outline-button"
                        onClick={() =>
                          navigate(
                            "/home"
                          )
                        }
                      >
                        + Order More
                      </button>

                    </div>

                  </div>
                )}

              </article>
            );
          })}

        </div>

      </div>
    </div>
  );
}

export default Orders;
