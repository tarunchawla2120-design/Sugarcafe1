import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase";
import "./Orders.css";

function Orders() {
  const [customerId, setCustomerId] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================================
  // LOAD CUSTOMER ID
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
  // LOAD CUSTOMER ORDERS
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
        ),
        orderBy(
          "createdAt",
          "desc"
        )
      );

      unsubscribe =
        onSnapshot(
          ordersQuery,
          (snapshot) => {
            const orderList =
              snapshot.docs.map(
                (orderDoc) => ({
                  id: orderDoc.id,
                  ...orderDoc.data(),
                })
              );

            setOrders(orderList);
            setLoading(false);
          },
          (firebaseError) => {
            console.error(
              "Orders listener error:",
              firebaseError
            );

            setLoading(false);

            if (
              firebaseError.code ===
              "failed-precondition"
            ) {
              setError(
                "Orders database index is being prepared. Please refresh after a moment."
              );
            } else {
              setError(
                "Unable to load your orders. Please try again."
              );
            }
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

  const getStatusIndex = (
    status
  ) => {
    const value =
      String(status || "")
        .toLowerCase();

    if (
      value === "new" ||
      value === "pending" ||
      value === "accepted"
    ) {
      return 0;
    }

    if (
      value === "preparing" ||
      value === "processing"
    ) {
      return 1;
    }

    if (
      value === "ready" ||
      value === "food ready"
    ) {
      return 2;
    }

    if (
      value === "dispatched" ||
      value === "out for delivery"
    ) {
      return 3;
    }

    if (
      value === "delivered" ||
      value === "completed"
    ) {
      return 4;
    }

    if (
      value === "rejected" ||
      value === "cancelled" ||
      value === "canceled"
    ) {
      return -1;
    }

    return 0;
  };

  const getStatusText = (
    status
  ) => {
    const value =
      String(status || "")
        .toLowerCase();

    if (
      value === "new" ||
      value === "pending"
    ) {
      return "Order Received";
    }

    if (
      value === "accepted" ||
      value === "preparing" ||
      value === "processing"
    ) {
      return "Preparing";
    }

    if (
      value === "ready" ||
      value === "food ready"
    ) {
      return "Food Ready";
    }

    if (
      value === "dispatched" ||
      value === "out for delivery"
    ) {
      return "Out for Delivery";
    }

    if (
      value === "delivered" ||
      value === "completed"
    ) {
      return "Delivered";
    }

    if (
      value === "rejected" ||
      value === "cancelled" ||
      value === "canceled"
    ) {
      return "Cancelled";
    }

    return status || "Order Received";
  };

  // =====================================================
  // DATE
  // =====================================================

  const formatDate = (
    createdAt
  ) => {
    try {
      if (
        createdAt?.toDate
      ) {
        return createdAt
          .toDate()
          .toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          });
      }

      if (
        createdAt?.seconds
      ) {
        return new Date(
          createdAt.seconds * 1000
        ).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }

      if (createdAt) {
        return new Date(
          createdAt
        ).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }

      return "";
    } catch {
      return "";
    }
  };

  // =====================================================
  // NO CUSTOMER ACCOUNT
  // =====================================================

  if (!loading && !customerId) {
    return (
      <div className="orders-page">

        <div className="no-orders">

          <div className="no-orders-icon">
            👤
          </div>

          <h2>
            Login to see your orders
          </h2>

          <p>
            Your orders will automatically
            appear here after you login.
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

        <div className="no-orders">

          <div className="no-orders-icon">
            ⏳
          </div>

          <h2>
            Loading your orders...
          </h2>

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

        <div className="no-orders">

          <div className="no-orders-icon">
            ⚠️
          </div>

          <h2>
            Unable to load orders
          </h2>

          <p>
            {error}
          </p>

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

        <div className="no-orders">

          <div className="no-orders-icon">
            📦
          </div>

          <h2>
            No Orders Yet
          </h2>

          <p>
            Your completed and current
            orders will appear here.
          </p>

        </div>

      </div>
    );
  }

  // =====================================================
  // ORDER PAGE
  // =====================================================

  return (
    <div className="orders-page">

      <div className="orders-header">

        <h2>
          My Orders
        </h2>

        <p>
          Customer ID:{" "}
          <strong>
            {customerId}
          </strong>
        </p>

      </div>

      {orders.map((order) => {

        const statusIndex =
          getStatusIndex(
            order.status
          );

        const cancelled =
          statusIndex === -1;

        return (
          <div
            className="tracked-order-card"
            key={order.id}
          >

            {/* HEADER */}

            <div className="tracked-order-header">

              <div>
                <strong>
                  {order.orderNumber ||
                    `Order #${order.id.slice(
                      0,
                      6
                    )}`}
                </strong>

                <small>
                  {formatDate(
                    order.createdAt
                  )}
                </small>
              </div>

              <div className="order-total">
                ₹
                {Number(
                  order.total || 0
                )}
              </div>

            </div>

            {/* STATUS */}

            <div className="order-current-status">

              <strong>
                {cancelled
                  ? "❌ Cancelled"
                  : getStatusText(
                      order.status
                    )}
              </strong>

            </div>

            {/* TRACKING */}

            {!cancelled && (
              <div className="tracking-timeline">

                {[
                  {
                    icon: "🆕",
                    text: "Order Received",
                  },
                  {
                    icon: "👨‍🍳",
                    text: "Preparing",
                  },
                  {
                    icon: "✅",
                    text: "Food Ready",
                  },
                  {
                    icon: "🛵",
                    text: "Out for Delivery",
                  },
                  {
                    icon: "🎉",
                    text: "Delivered",
                  },
                ].map(
                  (step, index) => {

                    const active =
                      index <=
                      statusIndex;

                    return (
                      <div
                        className={`tracking-step ${
                          active
                            ? "active"
                            : ""
                        }`}
                        key={
                          step.text
                        }
                      >

                        <div className="tracking-icon">
                          {step.icon}
                        </div>

                        <span>
                          {step.text}
                        </span>

                      </div>
                    );
                  }
                )}

              </div>
            )}

            {/* CUSTOMER */}

            <div className="tracked-section">

              <h4>
                Customer
              </h4>

              <p>
                👤{" "}
                {order.customerName ||
                  "Customer"}
              </p>

              {order.phone && (
                <p>
                  📱 {order.phone}
                </p>
              )}

            </div>

            {/* ITEMS */}

            <div className="tracked-section">

              <h4>
                Items
              </h4>

              {Array.isArray(
                order.items
              ) &&
                order.items.map(
                  (item, index) => (
                    <div
                      className="tracked-item"
                      key={`${item.id || item.name}-${index}`}
                    >

                      <span>
                        {item.name}
                        {" × "}
                        {Number(
                          item.qty ||
                            item.quantity ||
                            1
                        )}
                      </span>

                      <span>
                        ₹
                        {Number(
                          item.price ||
                            0
                        ) *
                          Number(
                            item.qty ||
                              item.quantity ||
                              1
                          )}
                      </span>

                    </div>
                  )
                )}

            </div>

            {/* ADDRESS */}

            {order.address && (
              <div className="tracked-section">

                <h4>
                  Delivery Address
                </h4>

                <p>
                  📍 {order.address}
                </p>

              </div>
            )}

            {/* BILL */}

            <div className="tracked-section">

              <h4>
                Bill Details
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
                    order.deliveryCharge ||
                      0
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

              <div className="bill-row bill-total">
                <span>
                  Total
                </span>

                <span>
                  ₹
                  {Number(
                    order.total || 0
                  )}
                </span>
              </div>

            </div>

            {/* PAYMENT */}

            <div className="tracked-payment">

              <strong>
                Payment
              </strong>

              <span>
                {order.paymentMethod ||
                  "Cash on Delivery"}
              </span>

              <span
                className={
                  String(
                    order.paymentStatus ||
                      ""
                  ).toLowerCase() ===
                  "paid"
                    ? "payment-paid"
                    : "payment-pending"
                }
              >
                {order.paymentStatus ||
                  "Pending"}
              </span>

            </div>

          </div>
        );
      })}

    </div>
  );
}

export default Orders;
