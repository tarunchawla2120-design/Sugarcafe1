import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { FaUser, FaPhoneAlt, FaMapMarkerAlt } from "react-icons/fa";
import { db } from "../firebase";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [orderCount, setOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // =====================================================
  // LOAD CUSTOMER PROFILE
  // =====================================================

  useEffect(() => {
    try {
      const savedUser =
        localStorage.getItem("sugarCafeUser");

      if (!savedUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const data = JSON.parse(savedUser);

      const customerId =
        data.customerId ||
        localStorage.getItem("sugarCafeCustomerId") ||
        "";

      const updatedProfile = {
        ...data,
        customerId,
        addresses: Array.isArray(data.addresses)
          ? data.addresses
          : [],
      };

      setProfile(updatedProfile);
      setLoading(false);

      // =================================================
      // REAL-TIME ORDER COUNT
      // =================================================

      if (!customerId) {
        setOrderCount(0);
        return;
      }

      const ordersQuery = query(
        collection(db, "orders"),
        where("customerId", "==", customerId)
      );

      const unsubscribe = onSnapshot(
        ordersQuery,
        (snapshot) => {
          setOrderCount(snapshot.size);
        },
        (error) => {
          console.error(
            "Profile orders error:",
            error
          );

          setOrderCount(0);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error(
        "Profile loading error:",
        error
      );

      setProfile(null);
      setLoading(false);
    }
  }, []);

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = () => {
    const confirmLogout =
      window.confirm(
        "Are you sure you want to logout?"
      );

    if (!confirmLogout) {
      return;
    }

    localStorage.removeItem(
      "sugarCafeUser"
    );

    localStorage.removeItem(
      "sugarCafeCustomerId"
    );

    setProfile(null);
    setOrderCount(0);

    navigate("/");
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <h2>
            Loading profile...
          </h2>
        </div>
      </div>
    );
  }

  // =====================================================
  // NOT LOGGED IN
  // =====================================================

  if (!profile) {
    return (
      <div className="profile-page">

        <div className="profile-card profile-login-card">

          <div className="profile-avatar">
            <FaUser />
          </div>

          <h2>
            Welcome to Sugar Café
          </h2>

          <p>
            Login to create your customer
            account and see your orders.
          </p>

          <button
            className="profile-primary-btn"
            onClick={() =>
              navigate("/login", {
                state: {
                  from: "/profile",
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
  // PROFILE
  // =====================================================

  return (
    <div className="profile-page">

      <div className="profile-card">

        {/* AVATAR */}

        <div className="profile-avatar">
          <FaUser />
        </div>

        {/* NAME */}

        <h2>
          {profile.name ||
            "Sugar Café Customer"}
        </h2>

        <p className="profile-welcome">
          Welcome back! 👋
        </p>

        {/* CUSTOMER DETAILS */}

        <div className="profile-details">

          <div className="profile-detail-row">

            <FaPhoneAlt />

            <div>
              <small>
                Mobile Number
              </small>

              <strong>
                {profile.phone ||
                  "Not available"}
              </strong>
            </div>

          </div>

          <div className="profile-detail-row">

            <FaUser />

            <div>
              <small>
                Customer ID
              </small>

              <strong>
                {profile.customerId ||
                  "Not available"}
              </strong>
            </div>

          </div>

        </div>

        {/* QUICK ACTIONS */}

        <div className="profile-actions">

          <button
            className="profile-action-btn"
            onClick={() =>
              navigate("/orders")
            }
          >
            <span className="profile-action-icon">
              📦
            </span>

            <span>
              <strong>
                My Orders
              </strong>

              <small>
                {orderCount}{" "}
                {orderCount === 1
                  ? "Order"
                  : "Orders"}
              </small>
            </span>
          </button>

          <button
            className="profile-action-btn"
            onClick={() =>
              navigate("/orders")
            }
          >
            <span className="profile-action-icon">
              🚚
            </span>

            <span>
              <strong>
                Track My Orders
              </strong>

              <small>
                View live order status
              </small>
            </span>
          </button>

        </div>

        {/* SAVED ADDRESSES */}

        <div className="profile-section">

          <div className="profile-section-title">
            <FaMapMarkerAlt />

            <strong>
              Saved Addresses
            </strong>
          </div>

          {profile.addresses &&
          profile.addresses.length > 0 ? (
            profile.addresses
              .slice(0, 3)
              .map(
                (saved, index) => (
                  <div
                    className="profile-address"
                    key={
                      saved.id ||
                      index
                    }
                  >
                    <strong>
                      {saved.label ||
                        "Delivery Address"}
                    </strong>

                    <span>
                      {saved.fullAddress ||
                        saved.address ||
                        "Address"}
                    </span>
                  </div>
                )
              )
          ) : (
            <p className="profile-empty">
              No saved addresses yet.
            </p>
          )}

        </div>

        {/* ACCOUNT INFO */}

        <div className="profile-account-box">

          <strong>
            Your Sugar Café Account
          </strong>

          <p>
            Your Customer ID is connected
            to your orders. You can use
            this account to view your
            previous and new orders.
          </p>

        </div>

        {/* LOGOUT */}

        <button
          className="profile-logout-btn"
          onClick={
            handleLogout
          }
        >
          Logout
        </button>

      </div>

    </div>
  );
}

export default Profile;
