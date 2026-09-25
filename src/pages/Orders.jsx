import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase";
import SugarCafeRewardCard from "../components/SugarCafeRewardCard";

import "./Orders.css";

export default function Orders() {
  const [orderList, setOrderList] = useState([]);
  const [loading, setLoading] = useState(true);

  // =========================================================
  // CUSTOMER ID
  // =========================================================

  const getCustomerId = () => {
    try {
      const savedUser = localStorage.getItem("sugarCafeUser");

      if (savedUser) {
        const user = JSON.parse(savedUser);

        return (
          user.customerId ||
          localStorage.getItem("sugarCafeCustomerId") ||
          ""
        );
      }
    } catch (error) {
      console.error("Customer data error:", error);
    }

    return localStorage.getItem("sugarCafeCustomerId") || "";
  };

  const customerId = getCustomerId();

  // =========================================================
  // LOAD CUSTOMER ORDERS
  // =========================================================

  useEffect(() => {
    if (!customerId) {
      setOrderList([]);
      setLoading(false);
      return;
    }

    const ordersQuery = query(
      collection(db, "orders"),
      where("customerId", "==", customerId)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const orders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        orders.sort((a, b) => {
          const aTime =
            a.createdAt?.toMillis?.() ||
            new Date(a.createdAt || 0).getTime() ||
            0;

          const bTime =
            b.createdAt?.toMillis?.() ||
            new Date(b.createdAt || 0).getTime() ||
            0;

          return bTime - aTime;
        });

        setOrderList(orders);
        setLoading(false);
      },
      (error) => {
        console.error("Orders listener error:", error);
        setOrderList([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [customerId]);

  // =========================================================
  // STATUS
  // =========================================================

  const getStatusKey = (status) => {
    const value = String(status || "")
      .toLowerCase()
      .trim();

    if (
      value === "delivered" ||
      value === "completed"
    ) {
      return "delivered";
    }

    if (
      value === "rejected" ||
      value === "cancelled" ||
      value === "canceled"
    ) {
      return "rejected";
    }

    if (
      value === "food ready" ||
      value === "foodready" ||
      value === "ready"
    ) {
      return "ready";
    }

    if (
      value === "preparing" ||
      value === "accepted"
    ) {
      return "preparing";
    }

    if (
      value === "dispatched" ||
      value === "out for delivery"
    ) {
      return "dispatched";
    }

    return "new";
  };

  // =========================================================
  // ORDER COUNTS
  // =========================================================

  const deliveredOrders = useMemo(() => {
    return orderList.filter(
      (order) =>
        getStatusKey(order.status) === "delivered"
    );
  }, [orderList]);

  const activeOrders = useMemo(() => {
    return orderList.filter((order) => {
      const status = getStatusKey(order.status);

      return (
        status !== "delivered" &&
        status !== "rejected"
      );
    });
  }, [orderList]);

  const rejectedOrders = useMemo(() => {
    return orderList.filter(
      (order) =>
        getStatusKey(order.status) === "rejected"
    );
  }, [orderList]);

  // =========================================================
  // TOTAL SPENT
  // =========================================================

  const totalSpent = useMemo(() => {
    return deliveredOrders.reduce((sum, order) => {
      return (
        sum +
        Number(
          order.total ??
          order.grandTotal ??
          order.finalTotal ??
          0
        )
      );
    }, 0);
  }, [deliveredOrders]);

  // =========================================================
  // DATE FORMAT
  // =========================================================

  const formatDate = (order) => {
    let date = null;

    if (order.createdAt?.toDate) {
      date = order.createdAt.toDate();
    } else if (order.createdAt) {
      date = new Date(order.createdAt);
    }

    if (!date || Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // =========================================================
  // STATUS LABEL
  // =========================================================

  const getStatusLabel = (status) => {
    const key = getStatusKey(status);

    switch (key) {
      case "delivered":
        return "Delivered";

      case "rejected":
        return "Cancelled";

      case "ready":
        return "Food Ready";

      case "preparing":
        return "Preparing";

      case "dispatched":
        return "Out for Delivery";

      default:
        return "Order Received";
    }
  };

  // =========================================================
  // STATUS CLASS
  // =========================================================

  const getStatusClass = (status) => {
    return `order-status order-status-${getStatusKey(
      status
    )}`;
  };

  // =========================================================
  // LOGIN CHECK
  // =========================================================

  if (!customerId) {
    return (
      <div className="orders-page">
        <div className="orders-container">

          <div className="orders-empty">
            <div className="orders-empty-icon">
              📦
            </div>

            <h2>Please Login</h2>

            <p>
              Login to view your orders and
              SugarCafe rewards.
            </p>

            <button
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              Login
            </button>
          </div>

        </div>
      </div>
    );
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="orders-page">
        <div className="orders-container">

          <div className="orders-loading">
            <div className="orders-spinner" />
            <p>Loading your orders...</p>
          </div>

        </div>
      </div>
    );
  }

  // =========================================================
  // MAIN
  // =========================================================

  return (
    <div className="orders-page">

      <div className="orders-container">

        {/* =================================================
            PAGE HEADER
        ================================================== */}

        <div className="orders-header">

          <div>
            <h1>My Orders</h1>

            <p>
              Track your SugarCafe orders
            </p>
          </div>

          <button
            className="order-food-button"
            onClick={() => {
              window.location.href = "/menu";
            }}
          >
            + Order Food
          </button>

        </div>

        {/* =================================================
            SUGARCAFE 6 + 1 SCRATCH CARD
        ================================================== */}

        <SugarCafeRewardCard
          orders={orderList}
          customerId={customerId}
        />

        {/* =================================================
            ORDER SUMMARY
        ================================================== */}

        <div className="orders-summary">

          <div className="orders-summary-card">
            <strong>
              {orderList.length}
            </strong>

            <span>Total Orders</span>
          </div>

          <div className="orders-summary-card">
            <strong>
              {activeOrders.length}
            </strong>

            <span>Running Orders</span>
          </div>

          <div className="orders-summary-card">
            <strong>
              {deliveredOrders.length}
            </strong>

            <span>Delivered</span>
          </div>

          <div className="orders-summary-card">
            <strong>
              ₹{totalSpent.toFixed(0)}
            </strong>

            <span>Total Spent</span>
          </div>

        </div>

        {/* =================================================
            NO ORDERS
        ================================================== */}

        {orderList.length === 0 ? (
          <div className="orders-empty">

            <div className="orders-empty-icon">
              🍔
            </div>

            <h2>No Orders Yet</h2>

            <p>
              Your SugarCafe orders will appear here.
            </p>

            <button
              onClick={() => {
                window.location.href = "/menu";
              }}
            >
              Browse Menu
            </button>

          </div>
        ) : (
          <>
            {/* =================================================
                RUNNING ORDERS
            ================================================== */}

            {activeOrders.length > 0 && (
              <section className="orders-section">

                <div className="orders-section-title">
                  <h2>Running Orders</h2>
                  <span>
                    {activeOrders.length}
                  </span>
                </div>

                <div className="orders-list">

                  {activeOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      getStatusLabel={getStatusLabel}
                      getStatusClass={getStatusClass}
                      formatDate={formatDate}
                    />
                  ))}

                </div>

              </section>
            )}

            {/* =================================================
                DELIVERED ORDERS
            ================================================== */}

            {deliveredOrders.length > 0 && (
              <section className="orders-section">

                <div className="orders-section-title">
                  <h2>Delivered Orders</h2>
                  <span>
                    {deliveredOrders.length}
                  </span>
                </div>

                <div className="orders-list">

                  {deliveredOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      getStatusLabel={getStatusLabel}
                      getStatusClass={getStatusClass}
                      formatDate={formatDate}
                    />
                  ))}

                </div>

              </section>
            )}

            {/* =================================================
                CANCELLED ORDERS
            ================================================== */}

            {rejectedOrders.length > 0 && (
              <section className="orders-section">

                <div className="orders-section-title">
                  <h2>Cancelled Orders</h2>
                  <span>
                    {rejectedOrders.length}
                  </span>
                </div>

                <div className="orders-list">

                  {rejectedOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      getStatusLabel={getStatusLabel}
                      getStatusClass={getStatusClass}
                      formatDate={formatDate}
                    />
                  ))}

                </div>

              </section>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// =========================================================
// ORDER CARD
// =========================================================

function OrderCard({
  order,
  getStatusLabel,
  getStatusClass,
  formatDate,
}) {
  const total = Number(
    order.total ??
    order.grandTotal ??
    order.finalTotal ??
    0
  );

  const items = Array.isArray(order.items)
    ? order.items
    : [];

  return (
    <div className="order-card">

      {/* HEADER */}

      <div className="order-card-header">

        <div>
          <span className="order-number-label">
            Order
          </span>

          <strong>
            #{order.orderNumber || order.id}
          </strong>
        </div>

        <span
          className={getStatusClass(
            order.status
          )}
        >
          {getStatusLabel(order.status)}
        </span>

      </div>

      {/* DATE */}

      <div className="order-date">
        {formatDate(order)}
      </div>

      {/* ITEMS */}

      <div className="order-items">

        {items.map((item, index) => (
          <div
            className="order-item"
            key={`${order.id}-${index}`}
          >

            <div className="order-item-info">

              <strong>
                {item.name ||
                  item.title ||
                  "Menu Item"}
              </strong>

              <span>
                Qty: {Number(item.quantity || 1)}
              </span>

            </div>

            <strong>
              ₹
              {(
                Number(item.price || 0) *
                Number(item.quantity || 1)
              ).toFixed(0)}
            </strong>

          </div>
        ))}

      </div>

      {/* SPECIAL NOTE */}

      {order.specialNote && (
        <div className="order-special-note">

          <strong>
            Special Note
          </strong>

          <p>
            {order.specialNote}
          </p>

        </div>
      )}

      {/* TOTAL */}

      <div className="order-card-footer">

        <span>
          Total
        </span>

        <strong>
          ₹{total.toFixed(0)}
        </strong>

      </div>

    </div>
  );
}
