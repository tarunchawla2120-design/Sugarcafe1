import { useEffect, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  db,
  auth,
} from "../firebase";

import "./Orders.css";

function Orders() {
  const [orders, setOrders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [loggedIn, setLoggedIn] =
    useState(false);

  // =====================================================
  // AUTH + LOAD CUSTOMER ORDERS
  // =====================================================

  useEffect(() => {
    let unsubscribeOrders = null;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        (user) => {

          // ===============================================
          // NOT LOGGED IN
          // ===============================================

          if (!user) {
            setLoggedIn(false);
            setOrders([]);
            setLoading(false);

            if (unsubscribeOrders) {
              unsubscribeOrders();
              unsubscribeOrders = null;
            }

            return;
          }

          // ===============================================
          // LOGGED IN
          // ===============================================

          setLoggedIn(true);
          setLoading(true);

          const ordersQuery =
            query(
              collection(
                db,
                "orders"
              ),

              where(
                "userId",
                "==",
                user.uid
              ),

              orderBy(
                "createdAt",
                "desc"
              )
            );

          unsubscribeOrders =
            onSnapshot(
              ordersQuery,

              (snapshot) => {

                const orderData =
                  snapshot.docs.map(
                    (doc) => ({
                      id:
                        doc.id,

                      ...doc.data(),
                    })
                  );

                setOrders(
                  orderData
                );

                setLoading(false);
              },

              (error) => {

                console.error(
                  "Orders loading error:",
                  error
                );

                setLoading(false);
              }
            );
        }
      );

    return () => {

      unsubscribeAuth();

      if (
        unsubscribeOrders
      ) {
        unsubscribeOrders();
      }
    };

  }, []);

  // =====================================================
  // DATE FORMAT
  // =====================================================

  const formatDate = (
    createdAt
  ) => {

    if (!createdAt) {
      return "—";
    }

    const date =
      createdAt.toDate
        ? createdAt.toDate()
        : new Date(
            createdAt
          );

    return date.toLocaleString(
      "en-IN",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short",
      }
    );
  };

  // =====================================================
  // STATUS CLASS
  // =====================================================

  const getStatusClass = (
    status
  ) => {

    const value =
      (
        status ||
        "New"
      ).toLowerCase();

    if (
      value.includes(
        "delivered"
      )
    ) {
      return "status-delivered";
    }

    if (
      value.includes(
        "dispatch"
      )
    ) {
      return "status-dispatched";
    }

    if (
      value.includes(
        "ready"
      )
    ) {
      return "status-ready";
    }

    if (
      value.includes(
        "prepar"
      )
    ) {
      return "status-preparing";
    }

    if (
      value.includes(
        "cancel"
      )
    ) {
      return "status-cancelled";
    }

    return "status-new";
  };

  // =====================================================
  // STATUS TEXT
  // =====================================================

  const getStatusText = (
    status
  ) => {

    switch (
      status
    ) {

      case "New":
        return "🆕 Order Received";

      case "Preparing":
        return "👨‍🍳 Preparing";

      case "Ready":
        return "✅ Food Ready";

      case "Dispatched":
        return "🛵 Out for Delivery";

      case "Delivered":
        return "🎉 Delivered";

      case "Cancelled":
        return "❌ Cancelled";

      default:
        return `📦 ${
          status || "New"
        }`;
    }
  };

  // =====================================================
  // LOGIN REQUIRED
  // =====================================================

  if (
    !loading &&
    !loggedIn
  ) {

    return (
      <div className="orders-page">

        <div className="no-orders">

          <div className="no-orders-icon">
            🔐
          </div>

          <h2>
            Please Login
          </h2>

          <p>
            Login to see your
            orders.
          </p>

        </div>

      </div>
    );
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (
      <div className="orders-page">

        <div className="orders-header">

          <div>

            <h2>
              📦 My Orders
            </h2>

            <p>
              Track your orders
              and delivery status
            </p>

          </div>

        </div>

        <div className="orders-loading">
          Loading your orders...
        </div>

      </div>
    );
  }

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

          <h2>
            📦 My Orders
          </h2>

          <p>
            Track your orders
            and delivery status
          </p>

        </div>

        <div className="orders-count">

          {orders.length}{" "}

          {orders.length === 1
            ? "Order"
            : "Orders"}

        </div>

      </div>

      {/* =================================================
          EMPTY
      ================================================= */}

      {orders.length === 0 ? (

        <div className="no-orders">

          <div className="no-orders-icon">
            🛒
          </div>

          <h2>
            No Orders Yet
          </h2>

          <p>
            Your placed orders
            will appear here.
          </p>

        </div>

      ) : (

        <div className="orders-list">

          {orders.map(
            (order) => (

              <div
                className="order-card"
                key={
                  order.id
                }
              >

                {/* =========================================
                    ORDER HEADER
                ========================================= */}

                <div className="order-top">

                  <div>

                    <h3>

                      #

                      {order.orderNumber ||
                        order.id.slice(
                          -6
                        )}

                    </h3>

                    <p className="order-date">

                      {formatDate(
                        order.createdAt
                      )}

                    </p>

                  </div>

                  <div
                    className={`order-status ${getStatusClass(
                      order.status
                    )}`}
                  >

                    {getStatusText(
                      order.status
                    )}

                  </div>

                </div>

                <div className="order-line" />

                {/* =========================================
                    ORDER ITEMS
                ========================================= */}

                <div className="order-items">

                  <h4>
                    ORDER ITEMS
                  </h4>

                  {(
                    order.items ||
                    []
                  ).map(
                    (
                      item,
                      index
                    ) => {

                      const quantity =
                        Number(
                          item.qty ||
                          item.quantity ||
                          1
                        );

                      const price =
                        Number(
                          item.price ||
                          0
                        );

                      return (
                        <div
                          className="order-item"
                          key={
                            item.id ||
                            index
                          }
                        >

                          <div className="order-item-left">

                            {item.image && (

                              <img
                                src={
                                  item.image
                                }
                                alt={
                                  item.name ||
                                  "Food"
                                }

                                onError={(
                                  e
                                ) => {

                                  e.currentTarget.style.display =
                                    "none";
                                }}
                              />

                            )}

                            <div>

                              <strong>
                                {item.name ||
                                  "Food Item"}
                              </strong>

                              <span>
                                ×{" "}
                                {quantity}
                              </span>

                            </div>

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

                <div className="order-line" />

                {/* =========================================
                    DELIVERY
                ========================================= */}

                <div className="order-delivery">

                  <h4>
                    📍 DELIVERY
                  </h4>

                  <p>
                    {order.address ||
                      "Address not available"}
                  </p>

                  {order.distance !=
                    null && (

                    <small>

                      Distance:{" "}

                      {Number(
                        order.distance
                      ).toFixed(
                        1
                      )}

                      km

                    </small>

                  )}

                </div>

                <div className="order-line" />

                {/* =========================================
                    BILL
                ========================================= */}

                <div className="order-bill">

                  <p>

                    <span>
                      Subtotal
                    </span>

                    <span>
                      ₹
                      {Number(
                        order.subtotal ||
                        0
                      )}
                    </span>

                  </p>

                  <p>

                    <span>
                      Delivery
                    </span>

                    <span>
                      ₹
                      {Number(
                        order.deliveryCharge ||
                        0
                      )}
                    </span>

                  </p>

                  <p>

                    <span>
                      GST
                    </span>

                    <span>
                      ₹
                      {Number(
                        order.gst ||
                        0
                      )}
                    </span>

                  </p>

                  <div className="order-total">

                    <strong>
                      Total
                    </strong>

                    <strong>
                      ₹
                      {Number(
                        order.total ||
                        0
                      )}
                    </strong>

                  </div>

                </div>

                <div className="order-line" />

                {/* =========================================
                    PAYMENT
                ========================================= */}

                <div className="order-payment">

                  <span>
                    Payment
                  </span>

                  <strong>
                    {order.paymentMethod ||
                      "Cash on Delivery"}
                  </strong>

                </div>

              </div>
            )
          )}

        </div>

      )}

    </div>
  );
}

export default Orders;