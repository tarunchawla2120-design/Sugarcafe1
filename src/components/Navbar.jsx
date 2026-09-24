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

  const [isAdmin, setIsAdmin] = useState(false);

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

  const [user, setUser] = useState(null);

  const [userData, setUserData] = useState(null);

  const [activeOrder, setActiveOrder] =
    useState(null);

  // Customer side menu
  const [customerMenuOpen, setCustomerMenuOpen] =
    useState(false);

  /* =========================
     FIREBASE USER
  ========================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
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

          const existing = userSnap.exists()
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
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
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
     OPEN CUSTOMER MENU
  ========================= */

  const handleCustomerMenu = () => {
    setCustomerMenuOpen(true);
  };

  /* =========================
     CLOSE CUSTOMER MENU
  ========================= */

  const closeCustomerMenu = () => {
    setCustomerMenuOpen(false);
  };

  return (
    <>
      <header className="navbar">

        {/* =========================
            LOCATION + PROFILE
        ========================= */}

        <div className="navbar-top">

          {/* LOCATION */}

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

          {/* PROFILE / CUSTOMER MENU */}

          <button
            className={`profile-circle ${
              activeOrder
                ? "has-active-order"
                : ""
            }`}
            onClick={handleCustomerMenu}
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

          {/* DELIVERY */}

          <button
            className={`order-tab ${
              orderType === "Delivery"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrderType("Delivery")
            }
          >
            <div className="order-tab-title">
              Delivery
            </div>

        <div className="order-tab-subtitle">
  Under 25 Mins
</div>
          </button>

          {/* TAKEAWAY */}

          <button
            className={`order-tab ${
              orderType === "Takeaway"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrderType("Takeaway")
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

        {orderType === "Delivery" && (
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
                setShowLocationModal(true)
              }
            >
              Detect Location
            </button>

          </div>
        )}

        {/* =========================
            TAKEAWAY
        ========================= */}

        {orderType === "Takeaway" && (
          <div className="takeaway-box">

            <MdStorefront className="takeaway-icon" />

            <div>

              <strong>
                Takeaway
              </strong>

              <p>
                Select your preferred store
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
              setShowLocationModal(false)
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
          onClose={closeCustomerMenu}
        />
      )}
    </>
  );
}

export default Navbar;

