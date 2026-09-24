import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../firebase";
import Sidebar from "../components/admin/Sidebar";
import DashboardHeader from "../components/admin/DashboardHeader";
import StatsCards from "../components/admin/StatsCards";
import MenuManager from "../components/admin/MenuManager";
import KOT from "../components/admin/KOT";

import "../css/dashboard.css";

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN")}`;

const ms = (v) =>
  v?.toMillis?.() ??
  (typeof v?.seconds === "number"
    ? v.seconds * 1000
    : new Date(v || 0).getTime());

const normalizeStatus = (status) =>
  String(status || "New")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const isToday = (value) => {
  const time = ms(value);

  if (!time) return false;

  const date = new Date(time);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

export default function Dashboard() {
  const [menuCount, setMenuCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [revenue, setRevenue] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [newOrder, setNewOrder] = useState(null);

  const [loading, setLoading] = useState(true);

  const first = useRef(true);
  const known = useRef(new Set());
  const audio = useRef(null);

  /* --------------------------------
     BUZZER
  -------------------------------- */

  const playBell = () => {
    try {
      if (!audio.current) {
        audio.current = new Audio("/alarm_bell.mp3");
      }

      audio.current.currentTime = 0;
      audio.current.volume = 1;

      audio.current.play().catch(() => {});
    } catch (_) {}
  };

  /* --------------------------------
     LOAD MENU / CATEGORY
  -------------------------------- */

  const loadBasicData = async () => {
    try {
      const [menuSnap, categorySnap] = await Promise.all([
        getDocs(collection(db, "menu")),
        getDocs(collection(db, "categories")),
      ]);

      setMenuCount(menuSnap.size);
      setCategoryCount(categorySnap.size);
    } catch (error) {
      console.error("Dashboard basic data error:", error);
    }
  };

  /* --------------------------------
     ORDERS REALTIME
  -------------------------------- */

  useEffect(() => {
    loadBasicData();

    const unsubscribe = onSnapshot(
      collection(db, "orders"),
      (snap) => {
        const list = snap.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort(
            (a, b) =>
              ms(b.createdAt) - ms(a.createdAt)
          );

        setOrders(list);
        setLoading(false);

        /* --------------------------------
           NEW ORDER DETECTION
        -------------------------------- */

        if (!first.current) {
          snap.docChanges().forEach((change) => {
            if (
              change.type === "added" &&
              !known.current.has(change.doc.id)
            ) {
              const order = {
                id: change.doc.id,
                ...change.doc.data(),
              };

              const status = normalizeStatus(order.status);

              if (status === "new") {
                setNewOrder(order);
                playBell();

                if (
                  "Notification" in window &&
                  Notification.permission === "granted"
                ) {
                  new Notification(
                    "Sugar Cafe — New Order",
                    {
                      body: `Order #${
                        order.orderNumber ||
                        order.id.slice(-6).toUpperCase()
                      } received`,
                    }
                  );
                }
              }

              known.current.add(change.doc.id);
            }
          });
        } else {
          snap.docs.forEach((doc) =>
            known.current.add(doc.id)
          );

          first.current = false;
        }
      },
      (error) => {
        console.error("Orders listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* --------------------------------
     ORDER CALCULATIONS
  -------------------------------- */

  const todayOrders = useMemo(
    () =>
      orders.filter((order) =>
        isToday(order.createdAt)
      ),
    [orders]
  );

  const todayRevenue = useMemo(
    () =>
      todayOrders.reduce(
        (total, order) =>
          total + Number(order.total || 0),
        0
      ),
    [todayOrders]
  );

  useEffect(() => {
    setRevenue(todayRevenue);
  }, [todayRevenue]);

  const counts = useMemo(() => {
    const result = {
      new: 0,
      accepted: 0,
      preparing: 0,
      ready: 0,
      dispatched: 0,
      delivered: 0,
      cancelled: 0,
      pending: 0,
    };

    todayOrders.forEach((order) => {
      const status = normalizeStatus(order.status);

      if (status === "new") result.new++;

      if (
        status === "accepted" ||
        status === "confirmed"
      ) {
        result.accepted++;
      }

      if (
        status === "preparing" ||
        status === "in preparation"
      ) {
        result.preparing++;
      }

      if (
        status === "food ready" ||
        status === "ready"
      ) {
        result.ready++;
      }

      if (
        status === "dispatched" ||
        status === "out for delivery"
      ) {
        result.dispatched++;
      }

      if (status === "delivered") {
        result.delivered++;
      }

      if (
        status === "cancelled" ||
        status === "rejected"
      ) {
        result.cancelled++;
      }
    });

    result.pending =
      result.new +
      result.accepted +
      result.preparing +
      result.ready +
      result.dispatched;

    return result;
  }, [todayOrders]);

  /* --------------------------------
     PAYMENT SUMMARY
  -------------------------------- */

  const paymentSummary = useMemo(() => {
    let prepaid = 0;
    let cod = 0;
    let pending = 0;

    todayOrders.forEach((order) => {
      const paymentStatus = normalizeStatus(
        order.paymentStatus ||
          order.payment_status ||
          ""
      );

      const method = normalizeStatus(
        order.paymentMethod ||
          order.paymentMode ||
          order.payment_mode ||
          ""
      );

      const total = Number(order.total || 0);

      if (
        paymentStatus.includes("paid") ||
        paymentStatus.includes("success") ||
        method.includes("upi") ||
        method.includes("razorpay")
      ) {
        prepaid += total;
      } else if (
        method.includes("cod") ||
        method.includes("cash")
      ) {
        cod += total;
      } else {
        pending += total;
      }
    });

    return {
      prepaid,
      cod,
      pending,
    };
  }, [todayOrders]);

  /* --------------------------------
     ORDER TYPE
  -------------------------------- */

  const orderTypes = useMemo(() => {
    let delivery = 0;
    let takeaway = 0;

    todayOrders.forEach((order) => {
      const type = normalizeStatus(
        order.orderType ||
          order.orderMode ||
          order.type ||
          ""
      );

      if (
        type.includes("takeaway") ||
        type.includes("take away")
      ) {
        takeaway++;
      } else {
        delivery++;
      }
    });

    return {
      delivery,
      takeaway,
    };
  }, [todayOrders]);

  /* --------------------------------
     CUSTOMERS
  -------------------------------- */

  const customerCount = useMemo(() => {
    const set = new Set();

    todayOrders.forEach((order) => {
      const key =
        order.customerPhone ||
        order.phone ||
        order.mobile ||
        order.customerName ||
        order.name ||
        order.id;

      set.add(String(key));
    });

    return set.size;
  }, [todayOrders]);

  /* --------------------------------
     AVERAGE ORDER
  -------------------------------- */

  const averageOrder =
    todayOrders.length > 0
      ? todayRevenue / todayOrders.length
      : 0;

  /* --------------------------------
     RECENT ORDERS
  -------------------------------- */

  const recentOrders = useMemo(
    () => orders.slice(0, 8),
    [orders]
  );

  /* --------------------------------
     REQUEST NOTIFICATION
  -------------------------------- */

  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  return (
    <div className="dashboard dashboard-v2">

      {/* SIDEBAR */}
      <Sidebar />

      <main className="main admin-main">

        {/* HEADER */}
        <DashboardHeader
          onAdd={() => setShowModal(true)}
        />

        {/* WELCOME */}
        <div className="welcome-row">

          <div>
            <span className="dashboard-kicker">
              SUGAR CAFE · CONTROL CENTER
            </span>

            <h2>
              Today at a glance 👋
            </h2>

            <p>
              Monitor your orders, kitchen,
              customers and sales from one place.
            </p>
          </div>

          <button
            className="sound-test"
            onClick={playBell}
          >
            🔔 Test Buzzer
          </button>

        </div>

        {/* --------------------------------
            MAIN STATS
        -------------------------------- */}

        <StatsCards
          menuCount={menuCount}
          categoryCount={categoryCount}
          orderCount={todayOrders.length}
          revenue={todayRevenue}
        />

        {/* --------------------------------
            PROFESSIONAL KPI CARDS
        -------------------------------- */}

        <section className="professional-kpi-grid">

          <div className="pro-kpi">
            <span>🆕 New Orders</span>
            <strong>{counts.new}</strong>
            <small>Waiting for action</small>
          </div>

          <div className="pro-kpi">
            <span>🍳 Preparing</span>
            <strong>{counts.preparing}</strong>
            <small>Currently in kitchen</small>
          </div>

          <div className="pro-kpi">
            <span>🟢 Food Ready</span>
            <strong>{counts.ready}</strong>
            <small>Ready for dispatch</small>
          </div>

          <div className="pro-kpi">
            <span>⏳ Pending</span>
            <strong>{counts.pending}</strong>
            <small>Active orders</small>
          </div>

          <div className="pro-kpi">
            <span>👥 Customers</span>
            <strong>{customerCount}</strong>
            <small>Today's customers</small>
          </div>

          <div className="pro-kpi">
            <span>🧾 Avg. Order</span>
            <strong>{money(averageOrder)}</strong>
            <small>Per order today</small>
          </div>

        </section>

        {/* --------------------------------
            ORDER PIPELINE + STORE
        -------------------------------- */}

        <section className="overview-grid">

          <div className="panel quick-panel">

            <div className="panel-head">

              <div>
                <h3>Order Pipeline</h3>
                <span>
                  Live order status
                </span>
              </div>

              <a href="/admin/orders">
                View Orders →
              </a>

            </div>

            <div className="pipeline">

              <div>
                <b>🔴</b>
                <strong>New</strong>
                <span>{counts.new}</span>
              </div>

              <div>
                <b>🍳</b>
                <strong>Preparing</strong>
                <span>{counts.preparing}</span>
              </div>

              <div>
                <b>🟢</b>
                <strong>Food Ready</strong>
                <span>{counts.ready}</span>
              </div>

              <div>
                <b>🛵</b>
                <strong>Dispatched</strong>
                <span>{counts.dispatched}</span>
              </div>

              <div>
                <b>✓</b>
                <strong>Delivered</strong>
                <span>{counts.delivered}</span>
              </div>

            </div>

          </div>

          {/* STORE */}

          <div className="panel store-panel">

            <div className="panel-head">

              <div>
                <h3>Store Control</h3>
                <span>
                  Current store status
                </span>
              </div>

              <span className="live-dot">
                ● LIVE
              </span>

            </div>

            <div className="store-lines">

              <div>
                <span>Website / Store</span>
                <b>🟢 Open</b>
              </div>

              <div>
                <span>Accepting Orders</span>
                <b>🟢 ON</b>
              </div>

              <div>
                <span>Kitchen Timer</span>
                <b>15 min</b>
              </div>

              <div>
                <span>Extra Time</span>
                <b>+10 min</b>
              </div>

            </div>

            <a
              className="store-settings-link"
              href="/admin/settings"
            >
              Manage Store Settings →
            </a>

          </div>

        </section>

        {/* --------------------------------
            SALES + PAYMENTS
        -------------------------------- */}

        <section className="professional-grid">

          <div className="panel">

            <div className="panel-head">

              <div>
                <h3>Today's Sales</h3>
                <span>
                  Revenue overview
                </span>
              </div>

            </div>

            <div className="big-money">
              {money(todayRevenue)}
            </div>

            <div className="sales-meta">

              <div>
                <span>Orders</span>
                <b>{todayOrders.length}</b>
              </div>

              <div>
                <span>Average</span>
                <b>{money(averageOrder)}</b>
              </div>

            </div>

          </div>

          <div className="panel">

            <div className="panel-head">

              <div>
                <h3>Payments</h3>
                <span>
                  Today's collection
                </span>
              </div>

            </div>

            <div className="payment-lines">

              <div>
                <span>💳 Prepaid / UPI</span>
                <strong>
                  {money(paymentSummary.prepaid)}
                </strong>
              </div>

              <div>
                <span>💵 COD / Cash</span>
                <strong>
                  {money(paymentSummary.cod)}
                </strong>
              </div>

              <div>
                <span>⏳ Pending</span>
                <strong>
                  {money(paymentSummary.pending)}
                </strong>
              </div>

            </div>

          </div>

          <div className="panel">

            <div className="panel-head">

              <div>
                <h3>Order Types</h3>
                <span>
                  Today's orders
                </span>
              </div>

            </div>

            <div className="order-type-box">

              <div>
                <strong>
                  🛵 {orderTypes.delivery}
                </strong>

                <span>
                  Delivery
                </span>
              </div>

              <div>
                <strong>
                  🛍️ {orderTypes.takeaway}
                </strong>

                <span>
                  Takeaway
                </span>
              </div>

            </div>

          </div>

        </section>

        {/* --------------------------------
            RECENT ORDERS
        -------------------------------- */}

        <section className="panel recent-panel">

          <div className="panel-head">

            <div>
              <h3>Recent Orders</h3>

              <span>
                Live activity from Firebase
              </span>
            </div>

            <a href="/admin/orders">
              Open full orders →
            </a>

          </div>

          {loading ? (

            <div className="no-recent">
              Loading orders...
            </div>

          ) : recentOrders.length === 0 ? (

            <div className="no-recent">
              No orders yet.
            </div>

          ) : (

            <div className="recent-table">

              <div className="recent-row recent-head">

                <span>Order</span>
                <span>Customer</span>
                <span>Type</span>
                <span>Status</span>
                <span>Total</span>

              </div>

              {recentOrders.map((order) => {

                const status =
                  order.status || "New";

                const type =
                  order.orderType ||
                  order.orderMode ||
                  "Delivery";

                return (

                  <div
                    className="recent-row"
                    key={order.id}
                  >

                    <b>
                      #
                      {order.orderNumber ||
                        order.id
                          .slice(-6)
                          .toUpperCase()}
                    </b>

                    <span>
                      {order.customerName ||
                        order.name ||
                        "Customer"}
                    </span>

                    <span>
                      {type}
                    </span>

                    <span
                      className={`mini-status ${normalizeStatus(
                        status
                      ).replace(/\s+/g, "-")}`}
                    >
                      {status}
                    </span>

                    <strong>
                      {money(order.total)}
                    </strong>

                  </div>

                );
              })}

            </div>

          )}

        </section>

        {/* --------------------------------
            QUICK ACTIONS
        -------------------------------- */}

        <section className="quick-actions-section">

          <div className="section-title">

            <div>
              <h3>
                Quick Actions
              </h3>

              <span>
                Frequently used controls
              </span>
            </div>

          </div>

          <div className="quick-actions">

            <a href="/admin/orders">
              🔔
              <b>Manage Orders</b>
              <span>
                Accept / Reject / Ready
              </span>
            </a>

            <a href="/admin/menu">
              🍔
              <b>Manage Menu</b>
              <span>
                Add / Edit / ON-OFF
              </span>
            </a>

            <a href="/admin/categories">
              📂
              <b>Categories</b>
              <span>
                Manage categories
              </span>
            </a>

            <a href="/admin/offers">
              🎁
              <b>Offers</b>
              <span>
                Discounts & coupons
              </span>
            </a>

            <a href="/admin/customers">
              👥
              <b>Customers</b>
              <span>
                Customer history
              </span>
            </a>

            <a href="/admin/settings">
              ⚙️
              <b>Settings</b>
              <span>
                Store controls
              </span>
            </a>

          </div>

        </section>

        {/* --------------------------------
            MENU MANAGEMENT
        -------------------------------- */}

        <div className="dashboard-menu-section">

          <div className="section-title">

            <div>
              <h3>
                Menu Management
              </h3>

              <span>
                Add, edit, remove and control
                menu items without leaving
                the dashboard.
              </span>
            </div>

            <button
              onClick={() =>
                setShowModal(true)
              }
            >
              + Add Menu Item
            </button>

          </div>

          <MenuManager
            showModal={showModal}
            setShowModal={setShowModal}
          />

        </div>

      </main>

      {/* NEW ORDER KOT */}

      {newOrder && (
        <KOT
          order={newOrder}
          onClose={() =>
            setNewOrder(null)
          }
        />
      )}

    </div>
  );
}
