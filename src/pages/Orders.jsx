import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where
} from "firebase/firestore";

import { db } from "../firebase";
import SugarCafeRewardCard from "../components/SugarCafeRewardCard";
import "./Orders.css";

/* =========================================================
   HELPERS
========================================================= */

const toMillis = (value) => {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (value?.seconds) {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
};

const getItemQuantity = (item) => {
  const quantity = Number(item?.quantity);

  return Number.isFinite(quantity) && quantity > 0
    ? quantity
    : 1;
};

const getItemPrice = (item) => {
  const price = Number(
    item?.price ??
    item?.salePrice ??
    item?.amount ??
    0
  );

  return Number.isFinite(price) ? price : 0;
};

/* =========================================================
   ORDERS PAGE
========================================================= */

export default function Orders() {
  const [orderList, setOrderList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState("");

  /* =======================================================
     CUSTOMER ID
  ======================================================= */

  useEffect(() => {
    const storedCustomerId =
      localStorage.getItem("customerId");

    if (storedCustomerId) {
      setCustomerId(storedCustomerId);
    } else {
      setCustomerId("");
    }
  }, []);

  /* =======================================================
     FIRESTORE ORDERS LISTENER
  ======================================================= */

  useEffect(() => {
    if (!customerId) {
      setOrderList([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ordersQuery = query(
      collection(db, "orders"),
      where("customerId", "==", customerId)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const orders = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        orders.sort(
          (a, b) =>
            toMillis(b.createdAt || b.timestamp) -
            toMillis(a.createdAt || a.timestamp)
        );

        setOrderList(orders);
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

    return () => unsubscribe();
  }, [customerId]);

  /* =======================================================
     STATUS
  ======================================================= */

  const getStatusKey = (order) => {
    const status = String(
      order?.status || "New"
    ).toLowerCase();

    if (
      status === "delivered" ||
      status === "completed"
    ) {
      return "delivered";
    }

    if (
      status === "rejected" ||
      status === "cancelled" ||
      status === "canceled"
    ) {
      return "cancelled";
    }

    if (
      status === "ready" ||
      status === "food ready"
    ) {
      return "ready";
    }

    if (
      status === "preparing" ||
      status === "accepted" ||
      status === "confirmed"
    ) {
      return "preparing";
    }

    return "new";
  };

  /* =======================================================
     6+1 LOYALTY
     
     ONLY:
     Delivered + subtotal/total >= ₹500
     
     These are the ONLY orders counted toward 1-6.
  ======================================================= */

  const qualifyingLoyaltyOrders = useMemo(() => {
    return orderList.filter((order) => {
      const status = String(
        order?.status || ""
      ).toLowerCase();

      const billAmount = Number(
        order?.subtotal ??
        order?.total ??
        0
      );

      return (
        status === "delivered" &&
        Number.isFinite(billAmount) &&
        billAmount >= 500
      );
    });
  }, [orderList]);

  /* =======================================================
     COMPLETED LOYALTY CYCLES
     
     Example:
     Cycle 1 reward created -> maxCompletedCycle = 1
     Cycle 2 reward created -> maxCompletedCycle = 2
  ======================================================= */

  const loyaltyCycleData = useMemo(() => {
    const rewardOrders = orderList.filter((order) => {
      const cycle = Number(
        order?.loyaltyReward?.cycle
      );

      return (
        Number.isFinite(cycle) &&
        cycle > 0
      );
    });

    const maxCompletedCycle =
      rewardOrders.length > 0
        ? Math.max(
            ...rewardOrders.map((order) =>
              Number(order.loyaltyReward.cycle)
            )
          )
        : 0;

    /*
      Cycle 1 needs first 6 qualifying orders.
      Cycle 2 needs next 6.
      Cycle 3 needs next 6.

      Total thresholds:
      Cycle 1 => 6
      Cycle 2 => 12
      Cycle 3 => 18
    */

    const nextCycle =
      maxCompletedCycle + 1;

    const requiredQualifyingOrders =
      maxCompletedCycle * 6 + 6;

    /*
      Progress after already completed cycles.

      Example:
      7 qualifying orders + cycle 1 completed
      => 1 / 6

      12 qualifying orders + cycle 1 completed
      => 5 / 6

      13 qualifying orders + cycle 2 completed
      => 1 / 6
    */

    const progress = Math.max(
      0,
      Math.min(
        qualifyingLoyaltyOrders.length -
          maxCompletedCycle * 6,
        6
      )
    );

    return {
      maxCompletedCycle,
      nextCycle,
      requiredQualifyingOrders,
      progress
    };
  }, [
    orderList,
    qualifyingLoyaltyOrders
  ]);

  const loyaltyCycle =
    loyaltyCycleData.maxCompletedCycle;

  const loyaltyProgress =
    loyaltyCycleData.progress;

  /* =======================================================
     ACTIVE SCRATCH REWARD
     
     Only:
       scratch_pending
       available
     
     NOT:
       applied
       redeemed
       carried
  ======================================================= */

  const activeLoyaltyReward = useMemo(() => {
    const alreadyUsedSourceIds =
      new Set(
        orderList
          .map(
            (order) =>
              order?.loyaltyReward
                ?.sourceOrderId
          )
          .filter(Boolean)
      );

    const sourceOrders = orderList
      .filter((order) => {
        const reward =
          order?.loyaltyReward;

        if (!reward) {
          return false;
        }

        return (
          reward.status ===
            "scratch_pending" ||
          reward.status === "available"
        );
      })
      .sort(
        (a, b) =>
          toMillis(
            b?.loyaltyReward?.createdAt ||
              b?.createdAt
          ) -
          toMillis(
            a?.loyaltyReward?.createdAt ||
              a?.createdAt
          )
      );

    /*
      If a reward was already applied to another order,
      don't show the old source reward again.
    */

    const active = sourceOrders.find(
      (order) =>
        !alreadyUsedSourceIds.has(order.id)
    );

    return active || null;
  }, [orderList]);

  /*
    A scratch card actually exists only when the
    source order has been created.

    We do NOT create/show a fake scratch card merely
    because the customer has reached 6 orders.
  */

  const scratchCardUnlocked =
    Boolean(activeLoyaltyReward);

  /* =======================================================
     ORDER COUNTS
  ======================================================= */

  const totalOrders = orderList.length;

  const deliveredOrders = orderList.filter(
    (order) =>
      getStatusKey(order) === "delivered"
  ).length;

  const activeOrders = orderList.filter(
    (order) => {
      const key = getStatusKey(order);

      return (
        key === "new" ||
        key === "preparing" ||
        key === "ready"
      );
    }
  ).length;

  const rejectedOrders = orderList.filter(
    (order) =>
      getStatusKey(order) === "cancelled"
  ).length;

  /* =======================================================
     TOTAL SPENT
  ======================================================= */

  const totalSpent = useMemo(() => {
    return orderList
      .filter((order) => {
        const status = String(
          order?.status || ""
        ).toLowerCase();

        return (
          status === "delivered" ||
          status === "completed"
        );
      })
      .reduce(
        (sum, order) => {
          const total = Number(
            order?.total ?? 0
          );

          return (
            sum +
            (Number.isFinite(total)
              ? total
              : 0)
          );
        },
        0
      );
  }, [orderList]);

  /* =======================================================
     DATE
  ======================================================= */

  const formatDate = (value) => {
    const millis = toMillis(value);

    if (!millis) {
      return "Date unavailable";
    }

    return new Date(millis).toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  };

  /* =======================================================
     STATUS LABEL
  ======================================================= */

  const getStatusLabel = (order) => {
    const key = getStatusKey(order);

    switch (key) {
      case "new":
        return "New";

      case "preparing":
        return "Preparing";

      case "ready":
        return "Food Ready";

      case "delivered":
        return "Delivered";

      case "cancelled":
        return "Cancelled";

      default:
        return order?.status || "New";
    }
  };

  /* =======================================================
     STATUS CLASS
  ======================================================= */

  const getStatusClass = (order) => {
    return `order-status ${getStatusKey(
      order
    )}`;
  };

  /* =======================================================
     LOGIN / LOADING
  ======================================================= */

  if (!customerId && !loading) {
    return (
      <div className="orders-page">
        <div className="orders-empty">
          <div className="orders-empty-icon">
            🧾
          </div>

          <h2>Login Required</h2>

          <p>
            Please login to view your SugarCafe
            orders.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="orders-page">
        <div className="orders-loading">
          <div className="orders-loader" />
          <p>Loading your orders...</p>
        </div>
      </div>
    );
  }

  /* =======================================================
     SPLIT ORDERS
  ======================================================= */

  const runningOrders = orderList.filter(
    (order) => {
      const key = getStatusKey(order);

      return (
        key === "new" ||
        key === "preparing" ||
        key === "ready"
      );
    }
  );

  const deliveredOrderList =
    orderList.filter(
      (order) =>
        getStatusKey(order) === "delivered"
    );

  const cancelledOrderList =
    orderList.filter(
      (order) =>
        getStatusKey(order) === "cancelled"
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="orders-page">
      <div className="orders-container">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="orders-header">
          <div>
            <h1>My Orders</h1>

            <p>
              Track your SugarCafe orders
            </p>
          </div>
        </div>

        {/* =================================================
            6+1 SCRATCH CARD
        ================================================= */}

        <SugarCafeRewardCard
          orders={orderList}
          customerId={customerId}
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
          nextCycle={
            loyaltyCycleData.nextCycle
          }
          scratchCardUnlocked={
            scratchCardUnlocked
          }
          activeRewardOrder={
            activeLoyaltyReward
          }
        />

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="orders-summary">

          <div className="summary-card">
            <span className="summary-icon">
              🧾
            </span>

            <div>
              <strong>
                {totalOrders}
              </strong>

              <span>
                Total Orders
              </span>
            </div>
          </div>

          <div className="summary-card">
            <span className="summary-icon">
              🔥
            </span>

            <div>
              <strong>
                {activeOrders}
              </strong>

              <span>
                Running
              </span>
            </div>
          </div>

          <div className="summary-card">
            <span className="summary-icon">
              ✅
            </span>

            <div>
              <strong>
                {deliveredOrders}
              </strong>

              <span>
                Delivered
              </span>
            </div>
          </div>

          <div className="summary-card">
            <span className="summary-icon">
              💰
            </span>

            <div>
              <strong>
                ₹
                {totalSpent.toLocaleString(
                  "en-IN"
                )}
              </strong>

              <span>
                Total Spent
              </span>
            </div>
          </div>

        </div>

        {/* =================================================
            MINI LOYALTY PROGRESS
        ================================================= */}

        <div className="loyalty-mini-card">

          <div className="loyalty-mini-header">

            <div>
              <span className="loyalty-mini-icon">
                🎁
              </span>

              <div>
                <h3>
                  SugarCafe 6+1 Rewards
                </h3>

                <p>
                  {activeLoyaltyReward
                    ? activeLoyaltyReward
                        ?.loyaltyReward
                        ?.status ===
                      "scratch_pending"
                      ? "Scratch your card to reveal your reward."
                      : "Your reward is ready for your next order."
                    : `${loyaltyProgress}/6 qualifying orders`}
                </p>
              </div>
            </div>

            <strong>
              {loyaltyProgress}/6
            </strong>

          </div>

          <div className="loyalty-progress-track">
            <div
              className="loyalty-progress-fill"
              style={{
                width: `${
                  (loyaltyProgress / 6) *
                  100
                }%`
              }}
            />
          </div>

          <div className="loyalty-mini-footer">

            <span>
              ₹500+ delivered orders count
            </span>

            <span>
              Cycle {loyaltyCycle + 1}
            </span>

          </div>

        </div>

        {/* =================================================
            EMPTY STATE
        ================================================= */}

        {orderList.length === 0 && (
          <div className="orders-empty">

            <div className="orders-empty-icon">
              🍔
            </div>

            <h2>
              No Orders Yet
            </h2>

            <p>
              Your SugarCafe orders will
              appear here.
            </p>

          </div>
        )}

        {/* =================================================
            RUNNING ORDERS
        ================================================= */}

        {runningOrders.length > 0 && (
          <section className="orders-section">

            <div className="section-heading">
              <div>
                <h2>
                  Running Orders
                </h2>

                <p>
                  Your current orders
                </p>
              </div>

              <span>
                {runningOrders.length}
              </span>
            </div>

            <div className="orders-list">

              {runningOrders.map(
                (order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    formatDate={formatDate}
                    getStatusLabel={
                      getStatusLabel
                    }
                    getStatusClass={
                      getStatusClass
                    }
                  />
                )
              )}

            </div>

          </section>
        )}

        {/* =================================================
            DELIVERED ORDERS
        ================================================= */}

        {deliveredOrderList.length > 0 && (
          <section className="orders-section">

            <div className="section-heading">
              <div>
                <h2>
                  Delivered Orders
                </h2>

                <p>
                  Your completed orders
                </p>
              </div>

              <span>
                {deliveredOrderList.length}
              </span>
            </div>

            <div className="orders-list">

              {deliveredOrderList.map(
                (order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    formatDate={formatDate}
                    getStatusLabel={
                      getStatusLabel
                    }
                    getStatusClass={
                      getStatusClass
                    }
                  />
                )
              )}

            </div>

          </section>
        )}

        {/* =================================================
            CANCELLED / REJECTED ORDERS
        ================================================= */}

        {cancelledOrderList.length > 0 && (
          <section className="orders-section">

            <div className="section-heading">
              <div>
                <h2>
                  Cancelled Orders
                </h2>

                <p>
                  Cancelled or rejected orders
                </p>
              </div>

              <span>
                {cancelledOrderList.length}
              </span>
            </div>

            <div className="orders-list">

              {cancelledOrderList.map(
                (order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    formatDate={formatDate}
                    getStatusLabel={
                      getStatusLabel
                    }
                    getStatusClass={
                      getStatusClass
                    }
                  />
                )
              )}

            </div>

          </section>
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
  formatDate,
  getStatusLabel,
  getStatusClass
}) {
  const items = Array.isArray(
    order?.items
  )
    ? order.items
    : [];

  const reward =
    order?.loyaltyReward || null;

  const rewardStatus =
    reward?.status || "";

  /*
    IMPORTANT:
    scratch_pending must NOT reveal the reward
    name/image to the customer.

    Only available/applied/redeemed can show
    reward information.
  */

  const showRewardBadge =
    reward &&
    rewardStatus !== "scratch_pending";

  const isScratchPending =
    rewardStatus ===
    "scratch_pending";

  const isRewardAvailable =
    rewardStatus ===
    "available";

  const isRewardApplied =
    rewardStatus ===
    "applied";

  return (
    <article className="order-card">

      {/* =================================================
          ORDER HEADER
      ================================================= */}

      <div className="order-card-header">

        <div>
          <h3>
            #
            {order?.orderNumber ||
              order?.id?.slice(-6)
                .toUpperCase()}
          </h3>

          <p>
            {formatDate(
              order?.createdAt ||
                order?.timestamp
            )}
          </p>
        </div>

        <span
          className={getStatusClass(
            order
          )}
        >
          {getStatusLabel(order)}
        </span>

      </div>

      {/* =================================================
          REWARD BADGE
      ================================================= */}

      {showRewardBadge && (
        <div className="order-reward-badge">

          <span>
            🎁
          </span>

          <div>

            <strong>
              {reward.type ===
                "discount"
                ? "5% Discount Reward"
                : reward.itemName
                  ? `FREE ${reward.itemName}`
                  : "Reward"}
            </strong>

            <small>
              {isRewardAvailable
                ? "✨ Scratch completed — reward available for your next order"
                : isRewardApplied
                  ? "🎉 Reward applied to this order"
                  : rewardStatus ===
                    "redeemed"
                    ? "Reward redeemed"
                    : "Reward unlocked"}
            </small>

          </div>

        </div>
      )}

      {/* =================================================
          SCRATCH PENDING
          
          Do NOT show actual reward.
      ================================================= */}

      {isScratchPending && (
        <div className="order-scratch-pending">

          <span>
            🎁
          </span>

          <div>
            <strong>
              Scratch Card Unlocked!
            </strong>

            <small>
              Scratch your reward card above
              to reveal your reward.
            </small>
          </div>

        </div>
      )}

      {/* =================================================
          SPECIAL NOTE
      ================================================= */}

      {order?.specialNote && (
        <div className="order-special-note">

          <strong>
            Special Note
          </strong>

          <p>
            {order.specialNote}
          </p>

        </div>
      )}

      {/* =================================================
          ITEMS
      ================================================= */}

      <div className="order-items">

        {items.map(
          (item, index) => {
            const quantity =
              getItemQuantity(item);

            const price =
              getItemPrice(item);

            const itemName =
              item?.name ||
              item?.title ||
              "Item";

            const image =
              item?.image ||
              item?.imageUrl ||
              item?.photoURL ||
              "";

            return (
              <div
                className="order-item"
                key={
                  item?.id ||
                  item?.itemId ||
                  `${itemName}-${index}`
                }
              >

                {image ? (
                  <img
                    src={image}
                    alt={itemName}
                    className="order-item-image"
                  />
                ) : (
                  <div className="order-item-placeholder">
                    🍽️
                  </div>
                )}

                <div className="order-item-info">

                  <strong>
                    {itemName}
                  </strong>

                  <span>
                    Qty: {quantity}
                  </span>

                </div>

                <strong className="order-item-price">
                  ₹
                  {(
                    price *
                    quantity
                  ).toLocaleString(
                    "en-IN"
                  )}
                </strong>

              </div>
            );
          }
        )}

      </div>

      {/* =================================================
          ORDER TOTAL
      ================================================= */}

      <div className="order-card-footer">

        <div>
          <span>
            Total
          </span>

          <strong>
            ₹
            {Number(
              order?.total || 0
            ).toLocaleString(
              "en-IN"
            )}
          </strong>
        </div>

        {order?.paymentMethod && (
          <span className="payment-method">
            {String(
              order.paymentMethod
            ).toUpperCase()}
          </span>
        )}

      </div>

    </article>
  );
}
