import { useEffect, useState } from "react";
import "./Navbar.css";
import LocationModal from "./LocationModal";
import CustomerMenu from "./CustomerMenu";
import { useNavigate } from "react-router-dom";

import {
  FaMapMarkerAlt,
  FaUserCircle,
  FaUser,
  FaMotorcycle,
} from "react-icons/fa";

import { MdStorefront } from "react-icons/md";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase";

function Navbar() {
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [orderType, setOrderType] =
    useState("Delivery");

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [location, setLocation] = useState({
    title: "Sarwamangala Para",
    address: "Sarwamangala Para, Korba",
  });

  const [showLocationModal, setShowLocationModal] =
    useState(false);

  const [user, setUser] =
    useState(null);

  const [userData, setUserData] =
    useState(null);

  const [activeOrder, setActiveOrder] =
    useState(null);

  const [customerMenuOpen, setCustomerMenuOpen] =
    useState(false);

  /* =========================
     FIREBASE USER
  ========================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          if (!currentUser) {
            setUser(null);
            setUserData(null);
            return;
          }

          setUser(currentUser);

          try {
            const userRef = doc(
              db,
              "users",
              currentUser.uid
            );

            const userSnap =
              await getDoc(userRef);

            const existing =
              userSnap.exists()
                ? userSnap.data()
                : {};

            const customerId =
              existing.customerId ||
              `SC-CUST-${currentUser.uid
                .slice(-8)
                .toUpperCase()}`;

            const profile = {
              uid: currentUser.uid,
              customerId,
              phone:
                currentUser.phoneNumber ||
                existing.phone ||
                "",
              name:
                existing.name ||
                "Sugar Customer",
              email:
                currentUser.email ||
                existing.email ||
                "",
              phoneVerified:
                Boolean(
                  currentUser.phoneNumber
                ),
              rewards:
                existing.rewards ?? 0,
              favourites:
                existing.favourites || [],
              addresses:
                existing.addresses || [],
              createdAt:
                existing.createdAt ||
                new Date(),
            };

            if (
              userSnap.exists() ||
              !currentUser.isAnonymous
            ) {
              await setDoc(
                userRef,
                profile,
                { merge: true }
              );

              localStorage.setItem(
                "sugarCafeUser",
                JSON.stringify(profile)
              );
            }

            setUserData(profile);
          } catch (error) {
            console.error(
              "User data error:",
              error
            );
          }
        }
      );

    return () => unsubscribe();
  }, []);

  /* =========================
     REALTIME ACTIVE ORDER
  ========================= */

  useEffect(() => {
    if (!user?.uid) {
      setActiveOrder(null);
      return undefined;
    }

    const activeStatuses = [
      "New",
      "Preparing",
      "Food Ready",
      "Dispatched",
    ];

    const ordersQuery = query(
      collection(db, "orders"),
      where(
        "userId",
        "==",
        user.uid
      )
    );

    const unsubscribe =
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          const active =
            snapshot.docs
              .map((orderDoc) => ({
                id: orderDoc.id,
                ...orderDoc.data(),
              }))
              .filter((order) =>
                activeStatuses.includes(
                  order.status
                )
              )
              .sort((a, b) => {
                const da =
                  a.createdAt?.toDate
                    ? a.createdAt.toDate()
                    : new Date(
                        a.createdAt || 0
                      );

                const dbb =
                  b.createdAt?.toDate
                    ? b.createdAt.toDate()
                    : new Date(
                        b.createdAt || 0
                      );

                return dbb - da;
              })[0] || null;

          setActiveOrder(active);
        },
        (error) => {
          console.error(
            "Active order listener error:",
            error
          );

          setActiveOrder(null);
        }
      );

    return () => unsubscribe();
  }, [user]);

  /* =========================
     LOAD SAVED LOCATION
  ========================= */

  useEffect(() => {
    const saved =
      localStorage.getItem(
        "userLocation"
      );

    if (!saved) {
      return;
    }

    try {
      const savedLocation =
        JSON.parse(saved);

      if (savedLocation.address) {
        setLocation({
          title:
            savedLocation.houseNumber ||
            savedLocation.address.split(
              ","
            )[0],

          address:
            savedLocation.fullAddress ||
            savedLocation.address,
        });
      }
    } catch (error) {
      console.error(
        "Saved location error:",
        error
      );
    }
  }, []);

  /* =========================
     PROFILE
  ========================= */

  const handleProfileClick = () => {
    if (
      user &&
      userData?.name &&
      userData.name !==
        "Sugar Customer" &&
      userData?.phone
    ) {
      navigate("/profile");
    } else {
      navigate("/login", {
        state: {
          from: "/profile",
        },
      });
    }
  };

  /* =========================
     CUSTOMER MENU
  ========================= */

  const handleCustomerMenu = () => {
    setCustomerMenuOpen(true);
  };

  const closeCustomerMenu = () => {
    setCustomerMenuOpen(false);
  };

  /* =========================================================
     DAILY SCRATCH HOME OFFER
  ========================================================= */

  const DailyScratchOffer = () => {
    return (
      <div
        style={{
          margin:
            "12px 16px 16px",
          position: "relative",
          overflow: "hidden",
          borderRadius: 22,
          padding: "17px 16px",
          background:
            "linear-gradient(135deg,#111827 0%,#24140c 48%,#7c2d12 100%)",
          boxShadow:
            "0 8px 24px rgba(0,0,0,.16)",
          color: "#fff",
        }}
      >
        {/* DECORATION */}

        <div
          style={{
            position: "absolute",
            width: 110,
            height: 110,
            borderRadius: "50%",
            right: -45,
            top: -45,
            background:
              "rgba(251,146,60,.18)",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 75,
            height: 75,
            borderRadius: "50%",
            left: -35,
            bottom: -35,
            background:
              "rgba(255,255,255,.05)",
          }}
        />

        {/* TOP */}

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding:
                "5px 9px",
              borderRadius: 999,
              background:
                "rgba(255,255,255,.11)",
              border:
                "1px solid rgba(255,255,255,.14)",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing:
                ".05em",
            }}
          >
            🎁 DAILY REWARD
          </div>

          <span
            style={{
              color: "#fed7aa",
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            EVERY DAY
          </span>
        </div>

        {/* MAIN */}

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 55,
              height: 55,
              minWidth: 55,
              borderRadius: 16,
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(145deg,#fff7ed,#fed7aa)",
              boxShadow:
                "0 6px 16px rgba(0,0,0,.18)",
              fontSize: 29,
            }}
          >
            🎁
          </div>

          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                lineHeight: 1.1,
                fontWeight: 900,
              }}
            >
              Daily Scratch & Win
            </h2>

            <p
              style={{
                margin:
                  "5px 0 0",
                color: "#fed7aa",
                fontSize: 12,
                lineHeight: 1.4,
                fontWeight: 600,
              }}
            >
              Order ₹499+ and unlock
              your scratch card.
            </p>
          </div>
        </div>

        {/* REWARD TEASER */}

        <div
          style={{
            position: "relative",
            marginTop: 13,
            padding:
              "9px 11px",
            borderRadius: 12,
            background:
              "rgba(255,255,255,.08)",
            border:
              "1px solid rgba(255,255,255,.1)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          ✨ Scratch to reveal your surprise reward

          <div
            style={{
              marginTop: 3,
              color:
                "rgba(255,255,255,.62)",
              fontSize: 10,
              fontWeight: 500,
            }}
          >
            Your reward is revealed only
            after eligible checkout.
          </div>
        </div>

        {/* BUTTON */}

        <button
          type="button"
          onClick={() =>
            navigate("/menu")
          }
          style={{
            position: "relative",
            width: "100%",
            marginTop: 12,
            border: 0,
            borderRadius: 13,
            padding:
              "12px 14px",
            background:
              "linear-gradient(135deg,#fb923c,#ea580c)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
            boxShadow:
              "0 6px 16px rgba(234,88,12,.28)",
          }}
        >
          ORDER NOW & SCRATCH 🎁
        </button>
      </div>
    );
  };

  return (
    <>
      <header className="navbar">

        {/* =========================
            LOCATION + PROFILE
        ========================= */}

        <div className="navbar-top">

          <button
            className="location-selector"
            onClick={() =>
              setShowLocationModal(true)
            }
            aria-label="Detect current location"
          >
            <FaMapMarkerAlt className="location-pin" />

            <div className="location-info">
              <div className="location-title">
                {location.title}
              </div>

              <div className="location-address">
                {location.address}
              </div>
            </div>
          </button>

          <button
            className={`profile-circle ${
              activeOrder
                ? "has-active-order"
                : ""
            }`}
            onClick={
              handleCustomerMenu
            }
            aria-label="Customer menu"
            title="Customer Menu"
          >
            {activeOrder ? (
              <>
                <FaMotorcycle />

                <span
                  className="active-order-dot"
                  aria-hidden="true"
                />
              </>
            ) : user ? (
              <FaUser />
            ) : (
              <FaUserCircle />
            )}
          </button>

        </div>

        {/* =========================
            DELIVERY / TAKEAWAY
        ========================= */}

        <div className="order-tabs">

          <button
            className={`order-tab ${
              orderType === "Delivery"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrderType(
                "Delivery"
              )
            }
          >
            <div className="order-tab-title">
              Delivery
            </div>

            <div className="order-tab-subtitle">
              Under 25 Mins
            </div>
          </button>

          <button
            className={`order-tab ${
              orderType === "Takeaway"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrderType(
                "Takeaway"
              )
            }
          >
            <div className="order-tab-title">
              Takeaway
            </div>

            <div className="order-tab-subtitle">
              Select Store
            </div>
          </button>

        </div>

        {/* =========================
            DELIVERY LOCATION
        ========================= */}

        {orderType ===
          "Delivery" && (
          <div className="detect-box">

            <div className="detect-message">

              <div className="detect-icon">
                <FaMapMarkerAlt />
              </div>

              <div className="detect-text">
                <div>
                  Give us your exact location
                  for
                </div>

                <div>
                  seamless delivery
                </div>
              </div>

            </div>

            <button
              className="detect-btn"
              onClick={() =>
                setShowLocationModal(
                  true
                )
              }
            >
              Detect Location
            </button>

          </div>
        )}

        {/* =================================================
            DAILY SCRATCH & WIN
            ONLY DELIVERY MODE
        ================================================= */}

        {orderType ===
          "Delivery" && (
          <DailyScratchOffer />
        )}

        {/* =========================
            TAKEAWAY
        ========================= */}

        {orderType ===
          "Takeaway" && (
          <div className="takeaway-box">

            <MdStorefront className="takeaway-icon" />

            <div>
              <strong>
                Takeaway
              </strong>

              <p>
                Select your preferred
                store
              </p>
            </div>

          </div>
        )}

        {/* =========================
            LOCATION MODAL
        ========================= */}

        {showLocationModal && (
          <LocationModal
            user={user}
            onClose={() =>
              setShowLocationModal(
                false
              )
            }
            onLocationSaved={(
              savedLocation
            ) => {
              setLocation({
                title:
                  savedLocation.address
                    ? savedLocation.address.split(
                        ","
                      )[0]
                    : "Current Location",

                address:
                  savedLocation.houseNumber
                    ? `${savedLocation.houseNumber}, ${savedLocation.address}`
                    : savedLocation.address,
              });
            }}
          />
        )}

      </header>

      {/* =========================
          CUSTOMER MENU
      ========================= */}

      {customerMenuOpen && (
        <CustomerMenu
          onClose={
            closeCustomerMenu
          }
        />
      )}
    </>
  );
}

export default Navbar;
