import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  Timestamp,
  updateDoc
} from "firebase/firestore";

import { db } from "../firebase";
import { useStoreSettings } from "../context/StoreContext";
import Sidebar from "../components/admin/Sidebar";
import "./AdminOrders.css";

const STATUS = [
  "All",
  "New",
  "Preparing",
  "Food Ready",
  "Dispatched",
  "Delivered",
  "Rejected"
];

/* =========================================================
   HELPERS
========================================================= */

function toMillis(value) {
  if (!value) return null;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? null : parsed;
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function label(order) {
  return (
    order.orderNumber ||
    order.orderNo ||
    order.orderId ||
    order.id?.slice(-8).toUpperCase() ||
    "—"
  );
}

function itemsFor(order) {
  return (
    order.items ||
    order.orderItems ||
    order.cart ||
    order.products ||
    []
  );
}

function addressFor(order) {
  if (typeof order.address === "string") {
    return order.address;
  }

  if (order.address && typeof order.address === "object") {
    return (
      order.address.fullAddress ||
      order.address.address ||
      [
        order.address.houseNo,
        order.address.area,
        order.address.locality,
        order.address.landmark,
        order.address.city,
        order.address.state,
        order.address.pincode
      ]
        .filter(Boolean)
        .join(", ")
    );
  }

  return (
    order.deliveryAddress ||
    order.customerAddress ||
    order.fullAddress ||
    "Address not available"
  );
}

/* =========================================================
   DAILY SCRATCH HELPERS
========================================================= */

function isDailyScratchItem(item) {
  return (
    item?.isFreeReward === true &&
    item?.dailyScratchReward === true
  );
}

function getDailyScratchReward(order) {
  return order?.dailyScratchReward || null;
}

function getDailyScratchRewardText(order) {
  const reward = getDailyScratchReward(order);

  if (!reward?.enabled) {
    return "";
  }

  if (
    reward.type === "discount" ||
    Number(reward.discountPercent) === 5
  ) {
    const amount =
      Number(reward.appliedDiscount || 0);

    return amount > 0
      ? `5% OFF · ${money(amount)} discount`
      : "5% OFF";
  }

  if (
    reward.type === "free_menu_item" ||
    reward.type === "free_item"
  ) {
    return (
      `FREE ${
        reward.itemName ||
        reward.title ||
        "Reward Item"
      }`
    );
  }

  return (
    reward.title ||
    "Scratch & Win Reward"
  );
}

/* =========================================================
   ELECTRON PRINT BRIDGE
========================================================= */

function getElectronPrinter() {
  try {
    if (
      typeof window !== "undefined" &&
      window.electronAPI &&
      typeof window.electronAPI.printKOT === "function"
    ) {
      return window.electronAPI;
    }

    if (
      typeof window !== "undefined" &&
      window.sugarCafeDesktop &&
      typeof window.sugarCafeDesktop.printKOT === "function"
    ) {
      return window.sugarCafeDesktop;
    }
  } catch (error) {
    console.error("Electron bridge error:", error);
  }

  return null;
}

/* =========================================================
   DAILY SCRATCH BADGE
========================================================= */

function DailyScratchBadge({ order }) {
  const reward = getDailyScratchReward(order);

  if (!reward?.enabled) {
    return null;
  }

  const isDiscount =
    reward.type === "discount" ||
    Number(reward.discountPercent) === 5;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background:
          "linear-gradient(135deg,#fff7ed,#ffedd5)",
        border: "1px solid #fed7aa",
        display: "flex",
        alignItems: "center",
        gap: 9,
        color: "#9a3412",
        fontSize: 13,
        fontWeight: 700
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          display: "grid",
          placeItems: "center",
          background: "#fff",
          fontSize: 16,
          flexShrink: 0
        }}
      >
        🎁
      </span>

      <span>
        <strong
          style={{
            display: "block",
            fontSize: 11,
            letterSpacing: ".05em",
            marginBottom: 2
          }}
        >
          DAILY SCRATCH & WIN
        </strong>

        <span>
          {getDailyScratchRewardText(order)}
        </span>

        {isDiscount &&
          Number(reward.appliedDiscount || 0) > 0 && (
            <small
              style={{
                display: "block",
                marginTop: 2,
                fontWeight: 600,
                opacity: 0.8
              }}
            >
              Applied on this order
            </small>
          )}
      </span>
    </div>
  );
}

/* =========================================================
   KOT MODAL
========================================================= */

function KOTModal({ order, onClose, onPrint }) {
  if (!order) return null;

  const items = itemsFor(order);
  const scratchReward =
    getDailyScratchReward(order);

  const created = toMillis(order.createdAt);
  const date = created ? new Date(created) : new Date();

  return (
    <div
      className="sc-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="sc-kot-modal">

        {/* HEADER */}

        <div className="sc-kot-head">
          <div>
            <b>☕ SUGAR CAFE</b>
            <span>KITCHEN ORDER TICKET</span>
          </div>

          <button onClick={onClose}>
            ×
          </button>
        </div>

        {/* ORDER META */}

        <div className="sc-kot-meta">
          <b>
            #{label(order)}
          </b>

          <span>
            {date.toLocaleDateString("en-IN")} ·{" "}
            {date.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit"
            })}
          </span>

          <em>
            {order.orderType || "Delivery"}
          </em>
        </div>

        {/* CUSTOMER */}

        <section>
          <small>
            CUSTOMER
          </small>

          <strong>
            {order.customerName ||
              order.name ||
              "Customer"}
          </strong>

          <div>
            {order.phone ||
              order.mobile ||
              "—"}
          </div>

          <div>
            {addressFor(order)}
          </div>
        </section>

        {/* DAILY SCRATCH REWARD */}

        {scratchReward?.enabled && (
          <section
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: "#fff7ed",
              border: "1px solid #fed7aa"
            }}
          >
            <small
              style={{
                color: "#9a3412",
                fontWeight: 800
              }}
            >
              🎁 DAILY SCRATCH & WIN
            </small>

            <strong
              style={{
                display: "block",
                marginTop: 4,
                color: "#7c2d12"
              }}
            >
              {getDailyScratchRewardText(order)}
            </strong>

            {(
              scratchReward.type ===
                "discount" ||
              Number(
                scratchReward.discountPercent
              ) === 5
            ) &&
              Number(
                scratchReward.appliedDiscount || 0
              ) > 0 && (
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 12,
                    color: "#9a3412"
                  }}
                >
                  Discount applied:{" "}
                  {money(
                    scratchReward.appliedDiscount
                  )}
                </div>
              )}
          </section>
        )}

        {/* ITEMS */}

        <section>
          <small>
            ORDER ITEMS
          </small>

          {items.length ? (
            items.map((item, i) => {
              const qty = Number(
                item.qty ||
                  item.quantity ||
                  1
              );

              const dailyScratchFree =
                isDailyScratchItem(item);

              const itemTotal =
                Number(item.price || 0) *
                qty;

              return (
                <div
                  className="kot-item"
                  key={item.id || i}
                >
                  <span>
                    {dailyScratchFree && (
                      <span
                        style={{
                          marginRight: 5,
                          fontWeight: 800
                        }}
                      >
                        🎁
                      </span>
                    )}

                    {dailyScratchFree
                      ? `FREE ${
                          item.name ||
                          item.productName ||
                          "Food Item"
                        }`
                      : (
                          item.name ||
                          item.productName ||
                          "Food Item"
                        )}

                    {" "}×{qty}
                  </span>

                  <b>
                    {dailyScratchFree
                      ? "FREE"
                      : money(itemTotal)}
                  </b>
                </div>
              );
            })
          ) : (
            <div>
              No items found.
            </div>
          )}
        </section>

        {/* SPECIAL NOTE */}

        {(order.instructions ||
          order.specialNote ||
          order.note) && (
          <div className="kot-note">
            <b>
              ★ SPECIAL NOTE:
            </b>{" "}
            {order.instructions ||
              order.specialNote ||
              order.note}
          </div>
        )}

        {/* TOTAL */}

        <div className="kot-total">
          <span>
            Total
          </span>

          <b>
            {money(order.total)}
          </b>
        </div>

        {/* MODAL ACTIONS */}

        <div className="kot-actions">
          <button
            onClick={() =>
              onPrint(order)
            }
          >
            🖨 Print KOT
          </button>

          <button
            className="dark"
            onClick={onClose}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   ADMIN ORDERS
========================================================= */

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newOrder, setNewOrder] = useState(null);
  const [kotOrder, setKotOrder] = useState(null);

  const [now, setNow] = useState(Date.now());

  const store = useStoreSettings();

  const buzzedPreparation =
    useRef(new Set());

  const knownIds =
    useRef(new Set());

  const firstSnapshot =
    useRef(true);

  const alarmRef =
    useRef(null);

  /* =======================================================
     BELL
  ======================================================= */

  const playBell = () => {
    if (store.buzzerEnabled === false) {
      return;
    }

    try {
      if (!alarmRef.current) {
        alarmRef.current =
          new Audio("/alarm_bell.mp3");
      }

      alarmRef.current.currentTime = 0;
      alarmRef.current.volume = 1;

      const promise =
        alarmRef.current.play();

      if (promise?.catch) {
        promise.catch(() => {});
      }
    } catch (error) {
      console.error(
        "Bell error:",
        error
      );
    }
  };

  /* =======================================================
     FIREBASE ORDERS
  ======================================================= */

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "orders"),

      (snapshot) => {
        const data =
          snapshot.docs
            .map((d) => ({
              id: d.id,
              ...d.data()
            }))
            .sort(
              (a, b) =>
                (toMillis(b.createdAt) || 0) -
                (toMillis(a.createdAt) || 0)
            );

        setOrders(data);
        setLoading(false);

        snapshot.docChanges().forEach(
          (change) => {
            if (
              change.type === "added" &&
              !firstSnapshot.current &&
              !knownIds.current.has(
                change.doc.id
              )
            ) {
              const incoming = {
                id: change.doc.id,
                ...change.doc.data()
              };

              if (
                (incoming.status || "New") ===
                "New"
              ) {
                setNewOrder(incoming);
                playBell();
              }
            }

            knownIds.current.add(
              change.doc.id
            );
          }
        );

        firstSnapshot.current = false;
      },

      (err) => {
        console.error(
          "Orders listener error:",
          err
        );

        setError(
          "Orders load nahi ho paaye. Firebase connection/rules check karein."
        );

        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  /* =======================================================
     CLOCK
  ======================================================= */

  useEffect(() => {
    const id = setInterval(
      () => setNow(Date.now()),
      1000
    );

    return () =>
      clearInterval(id);
  }, []);

  /* =======================================================
     PREPARATION TIMER BELL
  ======================================================= */

  useEffect(() => {
    if (store.buzzerEnabled === false) {
      return;
    }

    orders.forEach((order) => {
      if (
        (order.status || "New") !==
        "Preparing"
      ) {
        return;
      }

      const end =
        toMillis(
          order.preparationEndAt
        );

      if (
        !end ||
        end > now ||
        buzzedPreparation.current.has(
          order.id
        )
      ) {
        return;
      }

      buzzedPreparation.current.add(
        order.id
      );

      playBell();
    });
  }, [
    now,
    orders,
    store.buzzerEnabled
  ]);

  /* =======================================================
     CLEANUP AUDIO
  ======================================================= */

  useEffect(() => {
    return () => {
      if (alarmRef.current) {
        alarmRef.current.pause();
        alarmRef.current = null;
      }
    };
  }, []);

  /* =======================================================
     UPDATE ORDER
  ======================================================= */

  const updateOrder = async (
    order,
    updates
  ) => {
    try {
      await updateDoc(
        doc(db, "orders", order.id),
        updates
      );

      if (
        newOrder?.id === order.id
      ) {
        setNewOrder(null);
      }

      return true;
    } catch (e) {
      console.error(
        "Order update error:",
        e
      );

      alert(
        "Order update nahi ho paya."
      );

      return false;
    }
  };

  /* =======================================================
     PRINT KOT
  ======================================================= */

  const printKOT = async (order) => {
    try {
      const electron =
        getElectronPrinter();

      if (!electron) {
        console.warn(
          "Electron print bridge unavailable."
        );

        alert(
          "Automatic KOT printing ke liye SugarCafe Dashboard Windows App open karein.\n\n" +
          "Chrome/browser se silent printing possible nahi hai."
        );

        return false;
      }

      console.log(
        "Sending order to Electron printer:",
        order
      );

      const result =
        await electron.printKOT(order);

      console.log(
        "Electron print result:",
        result
      );

      if (!result?.success) {
        const reason =
          result?.error ||
          result?.failureReason ||
          "Unknown printing error";

        console.error(
          "KOT printing failed:",
          reason
        );

        alert(
          "KOT printing failed.\n\n" +
          reason +
          "\n\n" +
          "TVS-E RP 3230 printer check karein."
        );

        return false;
      }

      console.log(
        "KOT + Counter Slip printed successfully.",
        result.printer || ""
      );

      return true;
    } catch (error) {
      console.error(
        "KOT print exception:",
        error
      );

      alert(
        "KOT printing mein error aaya.\n\n" +
        (error?.message ||
          "Unknown error")
      );

      return false;
    }
  };

  /* =======================================================
     ACCEPT ORDER
  ======================================================= */

  const accept = async (order) => {
    const minutes =
      Number(
        order.preparationMinutes ??
        15
      );

    const started =
      Date.now();

    const end =
      started +
      minutes * 60000;

    const accepted =
      await updateOrder(
        order,
        {
          status: "Preparing",

          acceptedAt:
            Timestamp.fromMillis(
              started
            ),

          preparationStartedAt:
            Timestamp.fromMillis(
              started
            ),

          preparationEndAt:
            Timestamp.fromMillis(
              end
            ),

          preparationMinutes:
            minutes,

          rejectedAt: null
        }
      );

    if (!accepted) {
      return;
    }

    const printPayload = {
      ...order,

      status: "Preparing",

      acceptedAt: {
        seconds:
          Math.floor(
            started / 1000
          )
      },

      preparationStartedAt: {
        seconds:
          Math.floor(
            started / 1000
          )
      },

      preparationEndAt: {
        seconds:
          Math.floor(
            end / 1000
          )
      },

      preparationMinutes:
        minutes
    };

    let printed = false;

    for (
      let attempt = 1;
      attempt <= 3 && !printed;
      attempt++
    ) {
      console.log(
        `KOT print attempt ${attempt}/3`
      );

      printed =
        await printKOT(
          printPayload
        );

      if (
        !printed &&
        attempt < 3
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              1000
            )
        );
      }
    }

    if (!printed) {
      alert(
        "Order accepted successfully.\n\n" +
        "Lekin KOT + Counter Slip print nahi hui.\n\n" +
        "SugarCafe Dashboard App aur TVS-E RP 3230 printer check karein."
      );
    }
  };

  /* =======================================================
     REJECT
  ======================================================= */

  const reject = (order) => {
    const reason =
      window.prompt(
        "Reject reason (optional):",
        "Unable to accept this order"
      );

    return updateOrder(
      order,
      {
        status: "Rejected",

        rejectionReason:
          reason ||
          "Order rejected by staff",

        rejectedAt:
          Timestamp.now()
      }
    );
  };

  /* =======================================================
     EXTRA TIME
  ======================================================= */

  const extra = (order) => {
    const mins =
      Number(
        order.extraPreparationMinutes ??
        10
      );

    const base =
      toMillis(
        order.preparationEndAt
      ) || now;

    return updateOrder(
      order,
      {
        preparationEndAt:
          Timestamp.fromMillis(
            base +
              mins * 60000
          ),

        extraTimeAdded:
          mins
      }
    );
  };

  /* =======================================================
     READY
  ======================================================= */

  const ready = (order) =>
    updateOrder(
      order,
      {
        status: "Food Ready",
        foodReadyAt:
          Timestamp.now()
      }
    );

  /* =======================================================
     DISPATCH
  ======================================================= */

  const dispatch = (order) =>
    updateOrder(
      order,
      {
        status: "Dispatched",
        dispatchedAt:
          Timestamp.now()
      }
    );

  /* =======================================================
     DELIVERED
  ======================================================= */

  const delivered = (order) =>
    updateOrder(
      order,
      {
        status: "Delivered",
        deliveredAt:
          Timestamp.now()
      }
    );

  /* =======================================================
     UPI
  ======================================================= */

  const verifyUpi = (order) =>
    updateOrder(
      order,
      {
        paymentStatus: "Paid",
        paymentVerifiedAt:
          Timestamp.now()
      }
    );

  /* =======================================================
     COUNTS
  ======================================================= */

  const counts = useMemo(
    () =>
      STATUS.reduce(
        (a, s) => {
          a[s] =
            s === "All"
              ? orders.length
              : orders.filter(
                  (o) =>
                    (o.status ||
                      "New") === s
                ).length;

          return a;
        },
        {}
      ),
    [orders]
  );

  /* =======================================================
     FILTER
  ======================================================= */

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        const q =
          query
            .trim()
            .toLowerCase();

        const status =
          o.status || "New";

        const searchable = [
          label(o),
          o.customerName,
          o.name,
          o.phone,
          o.mobile,
          addressFor(o),
          o.orderType
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (filter === "All" ||
            status === filter) &&
          (!q ||
            searchable.includes(q))
        );
      }),
    [
      orders,
      filter,
      query
    ]
  );

  /* =======================================================
     PREPARATION TIMER
  ======================================================= */

  const remaining = (order) => {
    const end =
      toMillis(
        order.preparationEndAt
      );

    if (!end) {
      return "15:00";
    }

    const sec =
      Math.max(
        0,
        Math.floor(
          (end - now) / 1000
        )
      );

    return `${String(
      Math.floor(sec / 60)
    ).padStart(2, "0")}:${String(
      sec % 60
    ).padStart(2, "0")}`;
  };

  /* =======================================================
     ACCEPT TIMER
  ======================================================= */

  const acceptRemaining = (order) => {
    const end =
      (toMillis(
        order.createdAt
      ) || now) +
      Number(
        order.acceptanceSeconds ||
        60
      ) *
        1000;

    const sec =
      Math.max(
        0,
        Math.floor(
          (end - now) / 1000
        )
      );

    return `${String(
      Math.floor(sec / 60)
    ).padStart(2, "0")}:${String(
      sec % 60
    ).padStart(2, "0")}`;
  };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="sc-orders-shell">

      <Sidebar />

      <main className="sc-orders-main">

        {/* HEADER */}

        <header className="orders-top">
          <div>
            <div className="brand-kicker">
              SUGAR CAFE · LIVE CONTROL
            </div>

            <h1>
              Orders
            </h1>

            <p>
              Every order, status and
              kitchen action in one place.
            </p>
          </div>

          <div className="top-actions">

            <div className="store-status">
              <i
                className={
                  (
                    store.isOpen &&
                    store.acceptingOrders &&
                    store.inHours
                  )
                    ? "on"
                    : "off"
                }
              />

              {(
                store.isOpen &&
                store.acceptingOrders &&
                store.inHours
              )
                ? "Delivery Open"
                : "Delivery Closed"}

              <small>
                {store.orderTimingLabel}
              </small>
            </div>

            <button
              className="notification-button"
              onClick={playBell}
            >
              🔔
              <b>
                {counts.New || 0}
              </b>
            </button>

          </div>
        </header>

        {/* SEARCH */}

        <section className="order-toolbar">

          <div className="search">

            <span>
              ⌕
            </span>

            <input
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              placeholder="Search order, customer, phone or address"
            />

          </div>

          <button className="today">
            Today ▾
          </button>

        </section>

        {/* STATUS */}

        <section className="status-tabs">

          {STATUS.map((s) => (
            <button
              key={s}
              className={
                filter === s
                  ? `active ${s
                      .toLowerCase()
                      .replace(
                        /\s+/g,
                        "-"
                      )}`
                  : ""
              }
              onClick={() =>
                setFilter(s)
              }
            >
              {s === "All"
                ? "All Orders"
                : s}

              <b>
                {counts[s] || 0}
              </b>
            </button>
          ))}

        </section>

        {/* ERROR */}

        {error && (
          <div className="error-banner">
            ⚠️ {error}
          </div>
        )}

        {/* ORDERS */}

        {loading ? (
          <div className="empty-card">
            Loading live orders…
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-card">

            <div>
              📦
            </div>

            <h2>
              No orders found
            </h2>

            <p>
              New customer orders will
              appear here automatically.
            </p>

          </div>
        ) : (
          <div className="orders-grid">

            {filtered.map((order) => {

              const status =
                order.status || "New";

              const items =
                itemsFor(order);

              const created =
                toMillis(
                  order.createdAt
                );

              const preparationEnd =
                toMillis(
                  order.preparationEndAt
                );

              const expired =
                preparationEnd !== null &&
                preparationEnd <= now;

              return (
                <article
                  className={`order-card ${status
                    .toLowerCase()
                    .replace(
                      /\s+/g,
                      "-"
                    )}`}
                  key={order.id}
                >

                  {/* ORDER MAIN */}

                  <div className="order-main">

                    <div className="order-head">

                      <div>

                        <span className="order-no">
                          #{label(order)}
                        </span>

                        <span
                          className={`status-badge ${status
                            .toLowerCase()
                            .replace(
                              /\s+/g,
                              "-"
                            )}`}
                        >
                          {status}
                        </span>

                      </div>

                      <span className="order-time">
                        {created
                          ? new Date(
                              created
                            ).toLocaleTimeString(
                              "en-IN",
                              {
                                hour:
                                  "2-digit",
                                minute:
                                  "2-digit"
                              }
                            )
                          : "—"}
                      </span>

                    </div>

                    <div className="customer-block">

                      <strong>
                        {order.customerName ||
                          order.name ||
                          "Customer"}
                      </strong>

                      <span>
                        ☎{" "}
                        {order.phone ||
                          order.mobile ||
                          "—"}
                      </span>

                      <span>
                        📍{" "}
                        {order.orderType ||
                          "Delivery"}{" "}
                        ·{" "}
                        {addressFor(order)}
                      </span>

                      {/* DAILY SCRATCH */}

                      <DailyScratchBadge
                        order={order}
                      />

                    </div>

                  </div>

                  {/* ITEMS */}

                  <div className="items-block">

                    {items
                      .slice(0, 5)
                      .map(
                        (item, i) => {

                          const qty =
                            Number(
                              item.qty ||
                                item.quantity ||
                                1
                            );

                          const freeScratch =
                            isDailyScratchItem(
                              item
                            );

                          return (
                            <div
                              className="item-row"
                              key={
                                item.id ||
                                i
                              }
                            >

                              <span>

                                {freeScratch && (
                                  <span
                                    style={{
                                      marginRight: 4
                                    }}
                                  >
                                    🎁
                                  </span>
                                )}

                                {freeScratch
                                  ? `FREE ${
                                      item.name ||
                                      item.productName ||
                                      "Food Item"
                                    }`
                                  : (
                                      item.name ||
                                      item.productName ||
                                      "Food Item"
                                    )}

                                <small>
                                  ×{qty}
                                </small>

                              </span>

                              <strong>
                                {freeScratch
                                  ? "FREE"
                                  : money(
                                      Number(
                                        item.price ||
                                          0
                                      ) *
                                        qty
                                    )}
                              </strong>

                            </div>
                          );
                        }
                      )}

                    {items.length > 5 && (
                      <span className="more">
                        +{items.length - 5} more items
                      </span>
                    )}

                    {/* DAILY SCRATCH SUMMARY */}

                    {getDailyScratchReward(
                      order
                    )?.enabled && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: "8px 10px",
                          borderRadius: 9,
                          background:
                            "#fff7ed",
                          border:
                            "1px solid #fed7aa",
                          color: "#9a3412",
                          fontSize: 12,
                          fontWeight: 700
                        }}
                      >
                        🎁 Scratch Reward:{" "}
                        {getDailyScratchRewardText(
                          order
                        )}
                      </div>
                    )}

                    <div className="total-row">

                      <span>
                        Total
                      </span>

                      <strong>
                        {money(
                          order.total
                        )}
                      </strong>

                    </div>

                    <div className="payment">

                      {order.paymentMethod ||
                        "Cash on Delivery"}

                      {" · "}

                      <b
                        className={
                          order.paymentStatus ===
                          "Paid"
                            ? "paid"
                            : "pending"
                        }
                      >
                        {order.paymentStatus ||
                          "Pending"}
                      </b>

                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="action-block">

                    {/* NEW */}

                    {status === "New" && (
                      <>
                        <div className="timer acceptance">

                          <span>
                            Accept within
                          </span>

                          <strong>
                            {acceptRemaining(
                              order
                            )}
                          </strong>

                        </div>

                        <button
                          className="action accept"
                          onClick={() =>
                            accept(order)
                          }
                        >
                          ✓ Accept Order
                        </button>

                        <button
                          className="action reject"
                          onClick={() =>
                            reject(order)
                          }
                        >
                          ✕ Reject
                        </button>
                      </>
                    )}

                    {/* PREPARING */}

                    {status === "Preparing" && (
                      <>
                        <div
                          className={`timer preparation ${
                            expired
                              ? "expired"
                              : ""
                          }`}
                        >

                          <span>
                            {expired
                              ? "Time completed"
                              : "Kitchen Timer"}
                          </span>

                          <strong>
                            {remaining(
                              order
                            )}
                          </strong>

                        </div>

                        <div className="action-row">

                          <button
                            className="action extra"
                            onClick={() =>
                              extra(order)
                            }
                          >
                            +10 Min
                          </button>

                          <button
                            className="action ready"
                            onClick={() =>
                              ready(order)
                            }
                          >
                            Mark Ready
                          </button>

                        </div>
                      </>
                    )}

                    {/* FOOD READY */}

                    {status === "Food Ready" && (
                      <button
                        className="action dispatch"
                        onClick={() =>
                          dispatch(order)
                        }
                      >
                        🛵 Dispatch
                      </button>
                    )}

                    {/* DISPATCHED */}

                    {status === "Dispatched" && (
                      <button
                        className="action ready"
                        onClick={() =>
                          delivered(order)
                        }
                      >
                        ✓ Mark Delivered
                      </button>
                    )}

                    {/* REJECTED */}

                    {status === "Rejected" && (
                      <div className="rejected">
                        Rejected ·{" "}
                        {order.rejectionReason ||
                          "Staff rejected"}
                      </div>
                    )}

                    {/* UNIVERSAL VIEW KOT */}

                    <button
                      className="action outline view-kot-btn"
                      onClick={() =>
                        setKotOrder(order)
                      }
                    >
                      🧾 View KOT
                    </button>

                    {/* UPI */}

                    {order.paymentMethod ===
                      "UPI Payment" &&
                      order.paymentStatus !==
                        "Paid" &&
                      status !== "Rejected" && (
                        <button
                          className="action payment-btn"
                          onClick={() =>
                            verifyUpi(order)
                          }
                        >
                          💳 Mark UPI Paid
                        </button>
                      )}

                  </div>

                </article>
              );
            })}

          </div>
        )}

      </main>

      {/* ===================================================
          NEW ORDER ALERT
      =================================================== */}

      {newOrder && (
        <div className="new-order-overlay">

          <div className="new-order-alert">

            <button
              className="alert-close"
              onClick={() =>
                setNewOrder(null)
              }
            >
              ×
            </button>

            <div className="new-icon">
              🔔
            </div>

            <div>

              <span>
                NEW ORDER RECEIVED
              </span>

              <h2>
                Order #{label(newOrder)}
              </h2>

              <p>
                {newOrder.customerName ||
                  newOrder.name ||
                  "Customer"}{" "}
                ·{" "}
                {money(
                  newOrder.total
                )}
              </p>

              {/* DAILY SCRATCH IN ALERT */}

              {getDailyScratchReward(
                newOrder
              )?.enabled && (
                <div
                  style={{
                    marginTop: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 9px",
                    borderRadius: 8,
                    background: "#fff7ed",
                    border:
                      "1px solid #fed7aa",
                    color: "#9a3412",
                    fontSize: 12,
                    fontWeight: 800
                  }}
                >
                  🎁{" "}
                  {getDailyScratchRewardText(
                    newOrder
                  )}
                </div>
              )}

            </div>

            <div className="alert-actions">

              <button
                className="action accept big"
                onClick={() =>
                  accept(newOrder)
                }
              >
                ✓ ACCEPT ORDER
              </button>

              <button
                className="action reject big"
                onClick={() =>
                  reject(newOrder)
                }
              >
                ✕ REJECT
              </button>

              <button
                className="action outline big"
                onClick={() => {
                  setKotOrder(
                    newOrder
                  );

                  setNewOrder(null);
                }}
              >
                🧾 VIEW KOT
              </button>

            </div>

          </div>
        </div>
      )}

      {/* ===================================================
          KOT MODAL
      =================================================== */}

      <KOTModal
        order={kotOrder}
        onClose={() =>
          setKotOrder(null)
        }
        onPrint={printKOT}
      />

    </div>
  );
}

export default AdminOrders;
