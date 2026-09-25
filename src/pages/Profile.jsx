import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase";
import SugarCafeRewardCard from "../components/SugarCafeRewardCard";

import "./Profile.css";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("sugarCafeUser");

      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);

        setUser({
          ...parsedUser,
          customerId:
            parsedUser.customerId ||
            localStorage.getItem("sugarCafeCustomerId") ||
            "",
        });
      }
    } catch (error) {
      console.error("Profile user load error:", error);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const customerId =
      user.customerId ||
      localStorage.getItem("sugarCafeCustomerId");

    if (!customerId) {
      setOrders([]);
      setLoadingOrders(false);
      return;
    }

    const ordersQuery = query(
      collection(db, "orders"),
      where("customerId", "==", customerId)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const orderList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        orderList.sort((a, b) => {
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

        setOrders(orderList);
        setLoadingOrders(false);
      },
      (error) => {
        console.error("Orders loading error:", error);
        setOrders([]);
        setLoadingOrders(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-card">
            <h2>Please Login</h2>
            <p>
              Login to view your profile, orders and SugarCafe rewards.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const customerId =
    user.customerId ||
    localStorage.getItem("sugarCafeCustomerId") ||
    "";

  const customerName =
    user.name ||
    user.displayName ||
    user.customerName ||
    "Customer";

  const phone =
    user.phone ||
    user.customerPhone ||
    "";

  const email =
    user.email ||
    "";

  const orderCount = orders.length;

  const handleLogout = () => {
    localStorage.removeItem("sugarCafeUser");
    localStorage.removeItem("sugarCafeCustomerId");

    window.location.href = "/login";
  };

  return (
    <div className="profile-page">
      <div className="profile-container">

        {/* =========================
            PROFILE HEADER
        ========================== */}
        <div className="profile-card profile-header-card">

          <div className="profile-avatar">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={customerName}
              />
            ) : (
              <span>
                {customerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="profile-header-info">
            <h1>{customerName}</h1>

            {phone && (
              <p>{phone}</p>
            )}

            {email && (
              <p>{email}</p>
            )}

            {customerId && (
              <div className="customer-id-box">
                <span>Customer ID</span>
                <strong>{customerId}</strong>
              </div>
            )}
          </div>
        </div>

        {/* =========================
            SUGARCAFE 6 + 1 REWARD
        ========================== */}
        {!loadingOrders && customerId && (
          <SugarCafeRewardCard
            orders={orders}
            customerId={customerId}
          />
        )}

        {/* =========================
            ORDER SUMMARY
        ========================== */}
        <div className="profile-card profile-summary-card">

          <div className="profile-summary-item">
            <strong>{orderCount}</strong>
            <span>My Orders</span>
          </div>

          <button
            className="profile-summary-item profile-summary-button"
            onClick={() => {
              window.location.href = "/orders";
            }}
          >
            <strong>View</strong>
            <span>Track Orders</span>
          </button>

        </div>

        {/* =========================
            ACCOUNT INFORMATION
        ========================== */}
        <div className="profile-card">

          <div className="profile-section-title">
            <h2>Account Information</h2>
          </div>

          <div className="profile-info-list">

            <div className="profile-info-row">
              <span>Name</span>
              <strong>{customerName}</strong>
            </div>

            {phone && (
              <div className="profile-info-row">
                <span>Phone</span>
                <strong>{phone}</strong>
              </div>
            )}

            {email && (
              <div className="profile-info-row">
                <span>Email</span>
                <strong>{email}</strong>
              </div>
            )}

            <div className="profile-info-row">
              <span>Customer ID</span>
              <strong>{customerId || "—"}</strong>
            </div>

          </div>
        </div>

        {/* =========================
            QUICK ACTIONS
        ========================== */}
        <div className="profile-card">

          <div className="profile-section-title">
            <h2>Quick Actions</h2>
          </div>

          <div className="profile-actions">

            <button
              onClick={() => {
                window.location.href = "/orders";
              }}
            >
              <span>📦</span>
              <div>
                <strong>My Orders</strong>
                <small>View all your orders</small>
              </div>
            </button>

            <button
              onClick={() => {
                window.location.href = "/menu";
              }}
            >
              <span>🍔</span>
              <div>
                <strong>Order Food</strong>
                <small>Browse SugarCafe menu</small>
              </div>
            </button>

          </div>
        </div>

        {/* =========================
            LOGOUT
        ========================== */}
        <button
          className="profile-logout-button"
          onClick={handleLogout}
        >
          Logout
        </button>

      </div>
    </div>
  );
}
