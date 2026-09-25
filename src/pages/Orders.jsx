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

/* =========================================================
   HELPERS
========================================================= */

function toMillis(value) {
  if (!value) return 0;

  if (
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (
    typeof value.seconds === "number"
  ) {
    return value.seconds * 1000;
  }

  const parsed =
    new Date(value).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function getItemQuantity(item) {
  return Number(
    item?.qty ??
      item?.quantity ??
      1
  );
}

function getItemPrice(item) {
  return Number(
    item?.price ?? 0
  );
}

/* =========================================================
   ORDERS
========================================================= */

export default function Orders() {
  const [orderList, setOrderList] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  /* =======================================================
     CUSTOMER ID
  ======================================================= */

  const getCustomerId = () => {
    try {
      const savedUser =
        localStorage.getItem(
          "sugarCafeUser"
        );

      if (savedUser) {
        const user =
          JSON.parse(savedUser);

        return (
          user.customerId ||
          localStorage.getItem(
            "sugarCafeCustomerId"
          ) ||
          ""
        );
      }
    } catch (error) {
      console.error(
        "Customer data error:",
        error
      );
    }

    return (
      localStorage.getItem(
        "sugarCafeCustomerId"
      ) || ""
    );
  };

  const customerId =
    getCustomerId();

  /* =======================================================
     LOAD CUSTOMER ORDERS
  ======================================================= */

  useEffect(() => {
    if (!customerId) {
      setOrderList([]);
      setLoading(false);

      return;
    }

    const ordersQuery =
      query(
        collection(
          db,
          "orders"
        ),
        where(
          "customerId",
          "==",
          customerId
        )
      );

    const unsubscribe =
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          const orders =
            snapshot.docs.map(
              (orderDoc) => ({
                id:
                  orderDoc.id,

                ...orderDoc.data(),
              })
            );

          orders.sort(
            (a, b) =>
              toMillis(
                b.createdAt
              ) -
              toMillis(
                a.createdAt
              )
          );

          setOrderList(
            orders
          );

          setLoading(false);
        },
        (error) => {
          console.error(
            "Orders listener error:",
            error
          );

          setOrderList([]);

          setLoading(false);
        }
      );

    return () =>
      unsubscribe();
  }, [customerId]);

  /* =======================================================
     STATUS
  ======================================================= */

  const getStatusKey =
    (status) => {
      const value =
        String(
          status || ""
        )
          .toLowerCase()
          .trim();

      if (
        value ===
          "delivered" ||
        value ===
          "completed"
      ) {
        return "delivered";
      }

      if (
        value ===
          "rejected" ||
        value ===
          "cancelled" ||
        value ===
          "canceled"
      ) {
        return "rejected";
      }

      if (
        value ===
          "food ready" ||
        value ===
          "foodready" ||
        value ===
          "ready"
      ) {
        return "ready";
      }

      if (
        value ===
          "preparing" ||
        value ===
          "accepted"
      ) {
        return "preparing";
      }

      if (
        value ===
          "dispatched" ||
        value ===
          "out for delivery"
      ) {
        return "dispatched";
      }

      return "new";
    };

  /* =======================================================
     QUALIFYING LOYALTY ORDERS
     
     ONLY:
     Delivered
     AND
     ₹500+ BILL
  ======================================================= */

  const qualifyingLoyaltyOrders =
    useMemo(() => {
      return orderList.filter(
        (order) => {
          const status =
            getStatusKey(
              order.status
            );

          const bill =
            Number(
              order.subtotal ??
                order.total ??
                order.grandTotal ??
                order.finalTotal ??
                0
            );

          return (
            status ===
              "delivered" &&
            bill >= 500
          );
        }
      );
    }, [orderList]);

  /* =======================================================
     LOYALTY CYCLE
  ======================================================= */

  const loyaltyCycle =
    useMemo(() => {
      return Math.floor(
        qualifyingLoyaltyOrders.length /
          6
      );
    }, [
      qualifyingLoyaltyOrders,
    ]);

  const loyaltyProgress =
    useMemo(() => {
      return (
        qualifyingLoyaltyOrders.length %
        6
      );
    }, [
      qualifyingLoyaltyOrders,
    ]);

  /* =======================================================
     ACTIVE REWARD
     
     Reward is stored inside order.loyaltyReward.
  ======================================================= */

  const activeLoyaltyReward =
    useMemo(() => {
      return (
        orderList
          .filter(
            (order) =>
              order.loyaltyReward &&
              order.loyaltyReward
                .status !==
                "redeemed"
          )
          .sort(
            (a, b) =>
              toMillis(
                b.createdAt
              ) -
              toMillis(
                a.createdAt
              )
          )[0] || null
      );
    }, [orderList]);

  /* =======================================================
     ORDER COUNTS
  ======================================================= */

  const deliveredOrders =
    useMemo(() => {
      return orderList.filter(
        (order) =>
          getStatusKey(
            order.status
          ) === "delivered"
      );
    }, [orderList]);

  const activeOrders =
    useMemo(() => {
      return orderList.filter(
        (order) => {
          const status =
            getStatusKey(
              order.status
            );

          return (
            status !==
              "delivered" &&
            status !==
              "rejected"
          );
        }
      );
    }, [orderList]);

  const rejectedOrders =
    useMemo(() => {
      return orderList.filter(
        (order) =>
          getStatusKey(
            order.status
          ) === "rejected"
      );
    }, [orderList]);

  /* =======================================================
     TOTAL SPENT
  ======================================================= */

  const totalSpent =
    useMemo(() => {
      return deliveredOrders.reduce(
        (sum, order) => {
          return (
            sum +
            Number(
              order.total ??
                order.grandTotal ??
                order.finalTotal ??
                0
            )
          );
        },
        0
      );
    }, [deliveredOrders]);

  /* =======================================================
     DATE FORMAT
  ======================================================= */

  const formatDate =
    (order) => {
      let date = null;

      if (
        order.createdAt?.toDate
      ) {
        date =
          order.createdAt.toDate();
      } else if (
        order.createdAt
      ) {
        date =
          new Date(
            order.createdAt
          );
      }

      if (
        !date ||
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
    };

  /* =======================================================
     STATUS LABEL
  ======================================================= */

  const getStatusLabel =
    (status) => {
      const key =
        getStatusKey(status);

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

  /* =======================================================
     STATUS CLASS
  ======================================================= */

  const getStatusClass =
    (status) => {
      return `order-status order-status-${getStatusKey(
        status
      )}`;
    };

  /* =======================================================
     LOGIN CHECK
  ======================================================= */

  if (!customerId) {
    return (
      <div className="orders-page">

        <div className="orders-container">

          <div className="orders-empty">

            <div className="orders-empty-icon">
              📦
            </div>

            <h2>
              Please Login
            </h2>

            <p>
              Login to view your orders
              and SugarCafe rewards.
            </p>

            <button
              onClick={() => {
                window.location.href =
                  "/login";
              }}
            >
              Login
            </button>

          </div>

        </div>

      </div>
    );
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="orders-page">

        <div className="orders-container">

          <div className="orders-loading">

            <div className="orders-spinner" />

            <p>
              Loading your orders...
            </p>

          </div>

        </div>

      </div>
    );
  }

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <div className="orders-page">

      <div className="orders-container">

        {/* =================================================
            PAGE HEADER
        ================================================== */}

        <div className="orders-header">

          <div>

            <h1>
              My Orders
            </h1>

            <p>
              Track your SugarCafe
              orders
            </p>

          </div>

          <button
            className="order-food-button"
            onClick={() => {
              window.location.href =
                "/menu";
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

          /* -----------------------------------------------
             IMPORTANT LOYALTY DATA
          ----------------------------------------------- */

          qualifyingOrders={
            qualifyingLoyaltyOrders
          }

          qualifyingCount={
            qualifyingLoyaltyOrders.length
          }

          loyaltyProgress={
            loyaltyProgress
          }

          loyaltyCycle={
            loyaltyCycle
          }

          activeRewardOrder={
            activeLoyaltyReward
          }
        />

        {/* =================================================
            ORDER SUMMARY
        ================================================== */}

        <div className="orders-summary">

          <div className="orders-summary-card">

            <strong>
              {
                orderList.length
              }
            </strong>

            <span>
              Total Orders
            </span>

          </div>

          <div className="orders-summary-card">

            <strong>
              {
                activeOrders.length
              }
            </strong>

            <span>
              Running Orders
            </span>

          </div>

          <div className="orders-summary-card">

            <strong>
              {
                deliveredOrders.length
              }
            </strong>

            <span>
              Delivered
            </span>

          </div>

          <div className="orders-summary-card">

            <strong>
              ₹
              {
                totalSpent.toFixed(
                  0
                )
              }
            </strong>

            <span>
              Total Spent
            </span>

          </div>

        </div>

        {/* =================================================
            LOYALTY PROGRESS MINI INFO
        ================================================== */}

        {qualifyingLoyaltyOrders.length >
          0 && (
          <div
            style={{
              margin:
                "0 0 24px",

              padding:
                "14px 16px",

              borderRadius:
                "16px",

              background:
                "linear-gradient(135deg,#fffaf0,#fff4dc)",

              border:
                "1px solid #f1d08a",
            }}
          >

            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "space-between",

                alignItems:
                  "center",

                gap:
                  "12px",
              }}
            >

              <div>

                <strong>
                  🎁 Sugar Rewards
                </strong>

                <div
                  style={{
                    marginTop:
                      "4px",

                    fontSize:
                      "13px",

                    color:
                      "#777",
                  }}
                >
                  {
                    loyaltyProgress
                  }
                  /6 qualifying orders
                </div>

              </div>

              <div
                style={{
                  fontWeight:
                    "800",

                  color:
                    "#9a6700",
                }}
              >
                ₹500+
              </div>

            </div>

            <div
              style={{
                marginTop:
                  "10px",

                height:
                  "7px",

                borderRadius:
                  "20px",

                background:
                  "#eadfca",

                overflow:
                  "hidden",
              }}
            >

              <div
                style={{
                  width:
                    `${
                      (
                        loyaltyProgress /
                        6
                      ) *
                      100
                    }%`,

                  height:
                    "100%",

                  borderRadius:
                    "20px",

                  background:
                    "linear-gradient(90deg,#f59e0b,#f97316)",
                }}
              />

            </div>

          </div>
        )}

        {/* =================================================
            NO ORDERS
        ================================================== */}

        {orderList.length ===
        0 ? (
          <div className="orders-empty">

            <div className="orders-empty-icon">
              🍔
            </div>

            <h2>
              No Orders Yet
            </h2>

            <p>
              Your SugarCafe orders
              will appear here.
            </p>

            <button
              onClick={() => {
                window.location.href =
                  "/menu";
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

            {activeOrders.length >
              0 && (
              <section className="orders-section">

                <div className="orders-section-title">

                  <h2>
                    Running Orders
                  </h2>

                  <span>
                    {
                      activeOrders.length
                    }
                  </span>

                </div>

                <div className="orders-list">

                  {activeOrders.map(
                    (order) => (
                      <OrderCard
                        key={
                          order.id
                        }
                        order={
                          order
                        }
                        getStatusLabel={
                          getStatusLabel
                        }
                        getStatusClass={
                          getStatusClass
                        }
                        formatDate={
                          formatDate
                        }
                      />
                    )
                  )}

                </div>

              </section>
            )}

            {/* =================================================
                DELIVERED ORDERS
            ================================================== */}

            {deliveredOrders.length >
              0 && (
              <section className="orders-section">

                <div className="orders-section-title">

                  <h2>
                    Delivered Orders
                  </h2>

                  <span>
                    {
                      deliveredOrders.length
                    }
                  </span>

                </div>

                <div className="orders-list">

                  {deliveredOrders.map(
                    (order) => (
                      <OrderCard
                        key={
                          order.id
                        }
                        order={
                          order
                        }
                        getStatusLabel={
                          getStatusLabel
                        }
                        getStatusClass={
                          getStatusClass
                        }
                        formatDate={
                          formatDate
                        }
                      />
                    )
                  )}

                </div>

              </section>
            )}

            {/* =================================================
                CANCELLED ORDERS
            ================================================== */}

            {rejectedOrders.length >
              0 && (
              <section className="orders-section">

                <div className="orders-section-title">

                  <h2>
                    Cancelled Orders
                  </h2>

                  <span>
                    {
                      rejectedOrders.length
                    }
                  </span>

                </div>

                <div className="orders-list">

                  {rejectedOrders.map(
                    (order) => (
                      <OrderCard
                        key={
                          order.id
                        }
                        order={
                          order
                        }
                        getStatusLabel={
                          getStatusLabel
                        }
                        getStatusClass={
                          getStatusClass
                        }
                        formatDate={
                          formatDate
                        }
                      />
                    )
                  )}

                </div>

              </section>
            )}

          </>
        )}

      </div>

    </div>
  );
}

/* =========================================================
   ORDER CARD
========================================================= */

function OrderCard({
  order,
  getStatusLabel,
  getStatusClass,
  formatDate,
}) {
  const total =
    Number(
      order.total ??
        order.grandTotal ??
        order.finalTotal ??
        0
    );

  const items =
    Array.isArray(
      order.items
    )
      ? order.items
      : [];

  const reward =
    order.loyaltyReward ||
    null;

  return (
    <div className="order-card">

      {/* =================================================
          HEADER
      ================================================== */}

      <div className="order-card-header">

        <div>

          <span className="order-number-label">
            Order
          </span>

          <strong>
            #
            {
              order.orderNumber ||
              order.id
            }
          </strong>

        </div>

        <span
          className={getStatusClass(
            order.status
          )}
        >
          {
            getStatusLabel(
              order.status
            )
          }
        </span>

      </div>

      {/* =================================================
          DATE
      ================================================== */}

      <div className="order-date">
        {
          formatDate(
            order
          )
        }
      </div>

      {/* =================================================
          LOYALTY REWARD BADGE
      ================================================== */}

      {reward && (
        <div
          style={{
            margin:
              "12px 0",

            padding:
              "12px 14px",

            borderRadius:
              "14px",

            background:
              "linear-gradient(135deg,#fff9e8,#fff1c7)",

            border:
              "1px solid #edc96b",
          }}
        >

          <div
            style={{
              fontSize:
                "10px",

              fontWeight:
                "900",

              letterSpacing:
                "1.3px",

              color:
                "#946200",
            }}
          >
            🎁 SUGAR REWARD
          </div>

          <div
            style={{
              marginTop:
                "4px",

              fontWeight:
                "800",

              fontSize:
                "16px",
            }}
          >

            {reward.type ===
            "discount"
              ? `🎉 ${Number(
                  reward.discountPercent ||
                    5
                )}% OFF`
              : `🎁 FREE ${
                  reward.itemName ||
                  "Reward Item"
                }`}

          </div>

          <div
            style={{
              marginTop:
                "4px",

              fontSize:
                "12px",

              color:
                "#777",
            }}
          >

            {reward.status ===
            "carried"
              ? "Reward saved for your next order"
              : reward.status ===
                "redeemed"
              ? "Reward redeemed"
              : reward.status ===
                "applied"
              ? "Reward applied to this order"
              : "Reward unlocked"}

          </div>

        </div>
      )}

      {/* =================================================
          ITEMS
      ================================================== */}

      <div className="order-items">

        {items.map(
          (item, index) => {
            const qty =
              getItemQuantity(
                item
              );

            const price =
              getItemPrice(
                item
              );

            const itemTotal =
              price * qty;

            return (
              <div
                className="order-item"
                key={`${order.id}-${index}`}
              >

                <div className="order-item-info">

                  <strong>
                    {
                      item.name ||
                      item.title ||
                      "Menu Item"
                    }

                    {item.isFreeReward && (
                      <span
                        style={{
                          marginLeft:
                            "6px",

                          color:
                            "#15803d",

                          fontSize:
                            "11px",
                        }}
                      >
                        FREE
                      </span>
                    )}
                  </strong>

                  <span>
                    Qty:{" "}
                    {qty}
                  </span>

                </div>

                <strong>
                  ₹
                  {
                    itemTotal.toFixed(
                      0
                    )
                  }
                </strong>

              </div>
            );
          }
        )}

      </div>

      {/* =================================================
          SPECIAL NOTE
      ================================================== */}

      {order.specialNote && (
        <div className="order-special-note">

          <strong>
            Special Note
          </strong>

          <p>
            {
              order.specialNote
            }
          </p>

        </div>
      )}

      {/* =================================================
          TOTAL
      ================================================== */}

      <div className="order-card-footer">

        <span>
          Total
        </span>

        <strong>
          ₹
          {
            total.toFixed(
              0
            )
          }
        </strong>

      </div>

    </div>
  );
}
