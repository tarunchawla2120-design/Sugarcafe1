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
   KOT MODAL
========================================================= */

function KOTModal({ order, onClose, onPrint }) {
  if (!order) return null;

  const items = itemsFor(order);

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

        <div className="sc-kot-head">
          <div>
            <b>☕ SUGAR CAFE</b>
            <span>KITCHEN ORDER TICKET</span>
          </div>

          <button onClick={onClose}>×</button>
        </div>

        <div className="sc-kot-meta">

          <b>#{label(order)}</b>

          <span>
            {date.toLocaleDateString("en-IN")} ·{" "}
            {date.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit"
            })}
          </span>

          <em>{order.orderType || "Delivery"}</em>

        </div>

        <section>

          <small>CUSTOMER</small>

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

        <section>

          <small>ORDER ITEMS</small>

          {items.length ? (
            items.map((item, i) => {

              const qty = Number(
                item.qty ||
                item.quantity ||
                1
              );

              return (
                <div
                  className="kot-item"
                  key={item.id || i}
                >
                  <span>
                    {item.name ||
                      item.productName ||
                      "Food Item"}{" "}
                    ×{qty}
                  </span>

                  <b>
                    {money(
                      Number(item.price || 0) *
                        qty
                    )}
                  </b>
                </div>
              );

            })
          ) : (
            <div>No items found.</div>
          )}

        </section>

        {(order.instructions ||
          order.specialNote ||
          order.note) && (
          <div className="kot-note">
            <b>★ SPECIAL NOTE:</b>{" "}
            {order.instructions ||
              order.specialNote ||
              order.note}
          </div>
        )}

        <div className="kot-total">

          <span>Total</span>

          <b>
            {money(order.total)}
          </b>

        </div>

        <div className="kot-actions">

          <button
            onClick={() => onPrint(order)}
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

      /* ---------------------------------------------------
         BROWSER CHECK
      --------------------------------------------------- */

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

      /* ---------------------------------------------------
         SEND TO MAIN.JS
      --------------------------------------------------- */

      const result =
        await electron.printKOT(order);

      console.log(
        "Electron print result:",
        result
      );

      /* ---------------------------------------------------
         PRINT FAILED
      --------------------------------------------------- */

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

    /* ---------------------------------------------------
       UPDATE FIREBASE FIRST
    --------------------------------------------------- */

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

    /* ---------------------------------------------------
       PREPARE PRINT PAYLOAD
    --------------------------------------------------- */

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

    /* ---------------------------------------------------
       AUTOMATIC PRINT - 3 ATTEMPTS
    --------------------------------------------------- */

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

    /* ---------------------------------------------------
       FINAL PRINT FAILURE
    --------------------------------------------------- */

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

            <h1>Orders</h1>

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
              <b>{counts.New || 0}</b>
            </button>

          </div>

        </header>

        {/* SEARCH */}

        <section className="order-toolbar">

          <div className="search">

            <span>⌕</span>

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

            <div>📦</div>

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

                          return (

                            <div
                              className="item-row"
                              key={
                                item.id ||
                                i
                              }
                            >

                              <span>

                                {item.name ||
                                  item.productName ||
                                  "Food Item"}

                                <small>
                                  ×{qty}
                                </small>

                              </span>

                              <strong>
                                {money(
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

                    {status === "Food Ready" && (
                      <>

                        <button
                          className="action dispatch"
                          onClick={() =>
                            dispatch(order)
                          }
                        >
                          🛵 Dispatch
                        </button>

                        <button
                          className="action outline"
                          onClick={() =>
                            setKotOrder(order)
                          }
                        >
                          🧾 View KOT
                        </button>

                      </>
                    )}

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

                    {status === "Delivered" && (
                      <button
                        className="action outline"
                        onClick={() =>
                          setKotOrder(order)
                        }
                      >
                        🧾 View KOT
                      </button>
                    )}

                    {status === "Rejected" && (
                      <div className="rejected">
                        Rejected ·{" "}
                        {order.rejectionReason ||
                          "Staff rejected"}
                      </div>
                    )}

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
