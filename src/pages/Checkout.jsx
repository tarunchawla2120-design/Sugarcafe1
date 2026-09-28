/* =========================================================
   SUGAR CAFE — CHECKOUT FINAL
========================================================= */

import { useState, useEffect, useMemo, useCallback } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

import { db, auth } from "../firebase";

/* =========================================================
   CONSTANTS
========================================================= */

const MAX_DELIVERY_DISTANCE = 15;

const DELIVERY_PER_KM = 20;

const MIN_DELIVERY_CHARGE = 20;

const MAX_DELIVERY_CHARGE = 300;

/* ---------- LOYALTY ---------- */

const LOYALTY_MIN_BILL = 500;

const LOYALTY_TARGET = 6;

/* ---------- DAILY SCRATCH ---------- */

const DAILY_SCRATCH_MIN_BILL = 499;

const DAILY_SCRATCH_REWARDS = [
  {
    type: "discount",
    discountPercent: 5,
    label: "5% OFF",
  },

  {
    type: "free",
    itemName: "Cheese Aloo Puff",
    label: "FREE Cheese Aloo Puff",
  },

  {
    type: "free",
    itemName: "Veg Aloo Tikka Burger",
    label: "FREE Veg Aloo Tikka Burger",
  },

  {
    type: "free",
    itemName: "French Fries",
    label: "FREE French Fries",
  },
];

/* =========================================================
   LEAFLET ICON
========================================================= */

const markerIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",

  iconSize: [25, 41],

  iconAnchor: [12, 41],
});

/* =========================================================
   DISTANCE
========================================================= */

function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

/* =========================================================
   MAP LOCATION PICKER
========================================================= */

function LocationPicker({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    },
  });

  return null;
}

/* =========================================================
   DAILY SCRATCH RESULT CARD
========================================================= */

function DailyScratchCard({ reward }) {
  if (!reward) return null;

  return (
    <div
      style={{
        marginTop: 18,

        padding:
          "20px 16px 24px",

        borderRadius: 24,

        background:
          "linear-gradient(145deg,#0d2d38,#09252f)",

        border:
          "1px solid rgba(82,227,154,.28)",

        textAlign: "center",

        boxShadow:
          "0 10px 35px rgba(0,0,0,.18)",
      }}
    >
      {/* CELEBRATION */}

      <div
        style={{
          fontSize: 28,
          marginBottom: 4,
        }}
      >
        ✨ 🎉 ✨
      </div>

      {/* GIFT */}

      <div
        style={{
          fontSize: 58,
          lineHeight: 1,
          marginBottom: 12,
        }}
      >
        🎁
      </div>

      {/* WON */}

      <div
        style={{
          color: "#5ee39a",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: 3,
          marginBottom: 10,
        }}
      >
        YOU WON
      </div>

      {/* REWARD */}

      <h3
        style={{
          margin: 0,
          color: "#fff",
          fontSize: 28,
          lineHeight: 1.15,
          fontWeight: 900,
        }}
      >
        {reward.label}
      </h3>

      {/* DESCRIPTION */}

      <p
        style={{
          margin: "12px 0 0",
          color:
            "rgba(255,255,255,.62)",
          fontSize: 14,
        }}
      >
        Your free reward will be
        added to this order.
      </p>
    </div>
  );
}

/* =========================================================
   CHECKOUT
========================================================= */

export default function Checkout() {
  const navigate = useNavigate();

  const cart = useCart();

  const {
    cartItems = [],
    clearCart,
  } = cart || {};

  /* =======================================================
     CUSTOMER
  ======================================================= */

  const [customerName, setCustomerName] =
    useState(
      localStorage.getItem(
        "customerName"
      ) || ""
    );

  const [customerPhone, setCustomerPhone] =
    useState(
      localStorage.getItem(
        "customerPhone"
      ) || ""
    );

  const [currentUser, setCurrentUser] =
    useState(null);

  /* =======================================================
     ORDER TYPE
  ======================================================= */

  const [orderType, setOrderType] =
    useState("delivery");

  /* =======================================================
     LOCATION
  ======================================================= */

  const [location, setLocation] =
    useState(null);

  const [address, setAddress] =
    useState("");

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [locationConfirmed, setLocationConfirmed] =
    useState(false);

  const [locationError, setLocationError] =
    useState("");

  /* =======================================================
     CUSTOMER NOTE
  ======================================================= */

  const [specialNote, setSpecialNote] =
    useState("");

  /* =======================================================
     PAYMENT
  ======================================================= */

  const [paymentMethod, setPaymentMethod] =
    useState("Cash on Delivery");

  /* =======================================================
     LOYALTY
  ======================================================= */

  const [loyaltyCount, setLoyaltyCount] =
    useState(0);

  const [loyaltyLoading, setLoyaltyLoading] =
    useState(true);

  /* =======================================================
     DAILY SCRATCH
  ======================================================= */

  const [scratchReward, setScratchReward] =
    useState(null);

  const [scratchUnlocked, setScratchUnlocked] =
    useState(false);

  /* =======================================================
     ORDER
  ======================================================= */

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          setCurrentUser(
            user || null
          );
        }
      );

    return () => unsubscribe();
  }, []);

  /* =======================================================
     CART TOTAL
  ======================================================= */

  const subtotal = useMemo(() => {
    return cartItems.reduce(
      (sum, item) => {
        const price = Number(
          item.price ??
            item.salePrice ??
            item.amount ??
            0
        );

        const quantity = Number(
          item.quantity ?? 1
        );

        return (
          sum +
          price * quantity
        );
      },
      0
    );
  }, [cartItems]);

  /* =======================================================
     DELIVERY DISTANCE
  ======================================================= */

  const deliveryDistance = useMemo(() => {
    if (!location) return 0;

    /*
      Sugar Cafe approximate
      base location.
    */

    const cafeLat = 22.3595;

    const cafeLng = 82.7501;

    return calculateDistance(
      cafeLat,
      cafeLng,
      location.lat,
      location.lng
    );
  }, [location]);

  /* =======================================================
     DELIVERY CHARGE
  ======================================================= */

  const deliveryCharge = useMemo(() => {
    if (
      orderType !== "delivery"
    ) {
      return 0;
    }

    if (!location) {
      return 0;
    }

    const charge = Math.ceil(
      deliveryDistance *
        DELIVERY_PER_KM
    );

    return Math.min(
      Math.max(
        charge,
        MIN_DELIVERY_CHARGE
      ),
      MAX_DELIVERY_CHARGE
    );
  }, [
    orderType,
    location,
    deliveryDistance,
  ]);

  /* =======================================================
     DELIVERY AVAILABLE
  ======================================================= */

  const deliveryAvailable =
    orderType === "takeaway"
      ? true
      : !!location &&
        deliveryDistance <=
          MAX_DELIVERY_DISTANCE;

  /* =======================================================
     TOTAL
  ======================================================= */

  const total = useMemo(() => {
    return Math.max(
      0,
      subtotal +
        deliveryCharge
    );
  }, [
    subtotal,
    deliveryCharge,
  ]);

  /* =======================================================
     SCRATCH ELIGIBILITY
  ======================================================= */

  const scratchEligible =
    subtotal >=
    DAILY_SCRATCH_MIN_BILL;

  const amountToUnlockScratch =
    Math.max(
      0,
      DAILY_SCRATCH_MIN_BILL -
        subtotal
    );

  /* =======================================================
     CUSTOMER LOAD
  ======================================================= */

  useEffect(() => {
    const savedName =
      localStorage.getItem(
        "customerName"
      );

    const savedPhone =
      localStorage.getItem(
        "customerPhone"
      );

    if (savedName) {
      setCustomerName(
        savedName
      );
    }

    if (savedPhone) {
      setCustomerPhone(
        savedPhone
      );
    }
  }, []);

  /* =======================================================
     LOYALTY COUNT
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadLoyalty() {
      setLoyaltyLoading(true);

      try {
        const customerId =
          currentUser?.uid ||
          localStorage.getItem(
            "customerId"
          ) ||
          customerPhone;

        if (!customerId) {
          setLoyaltyCount(0);
          return;
        }

        const q = query(
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

        const snapshot =
          await getDocs(q);

        const qualifyingOrders =
          snapshot.docs.filter(
            (doc) => {
              const data =
                doc.data();

              const bill =
                Number(
                  data.subtotal ??
                    data.bill ??
                    data.total ??
                    0
                );

              return (
                String(
                  data.status || ""
                ).toLowerCase() ===
                  "delivered" &&
                bill >=
                  LOYALTY_MIN_BILL
              );
            }
          );

        if (!cancelled) {
          setLoyaltyCount(
            Math.min(
              qualifyingOrders.length,
              LOYALTY_TARGET
            )
          );
        }
      } catch (err) {
        console.error(
          "Loyalty loading error:",
          err
        );

        if (!cancelled) {
          setLoyaltyCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoyaltyLoading(
            false
          );
        }
      }
    }

    loadLoyalty();

    return () => {
      cancelled = true;
    };
  }, [
    currentUser,
    customerPhone,
  ]);

  /* =======================================================
     REVERSE GEOCODING
  ======================================================= */

  const reverseGeocode =
    useCallback(
      async (lat, lng) => {
        try {
          const response =
            await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
              {
                headers: {
                  Accept:
                    "application/json",

                  "User-Agent":
                    "SugarCafe/1.0",
                },
              }
            );

          if (!response.ok) {
            throw new Error(
              "Unable to get address"
            );
          }

          const data =
            await response.json();

          return (
            data.display_name ||
            "Selected location"
          );
        } catch (err) {
          console.error(
            "Reverse geocoding error:",
            err
          );

          return "Selected location";
        }
      },
      []
    );

  /* =======================================================
     LOCATION SELECT
  ======================================================= */

  const handleLocationSelect =
    useCallback(
      async ({
        lat,
        lng,
      }) => {
        setLocation({
          lat,
          lng,
        });

        setLocationConfirmed(
          false
        );

        setLocationError("");

        const newAddress =
          await reverseGeocode(
            lat,
            lng
          );

        setAddress(
          newAddress
        );
      },
      [reverseGeocode]
    );

  /* =======================================================
     CURRENT LOCATION
  ======================================================= */

  const useCurrentLocation =
    useCallback(() => {
      if (
        !navigator.geolocation
      ) {
        setLocationError(
          "Location is not supported on this device."
        );

        return;
      }

      setLocationLoading(true);

      setLocationError("");

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat =
            position.coords
              .latitude;

          const lng =
            position.coords
              .longitude;

          await handleLocationSelect({
            lat,
            lng,
          });

          setLocationLoading(
            false
          );
        },

        (err) => {
          console.error(
            "Location error:",
            err
          );

          setLocationError(
            "Unable to detect your location. Please allow location access."
          );

          setLocationLoading(
            false
          );
        },

        {
          enableHighAccuracy:
            true,

          timeout: 15000,

          maximumAge: 0,
        }
      );
    }, [
      handleLocationSelect,
    ]);

  /* =======================================================
     CONFIRM LOCATION
  ======================================================= */

  const confirmLocation =
    () => {
      if (!location) {
        setLocationError(
          "Please select your delivery location."
        );

        return;
      }

      if (
        deliveryDistance >
        MAX_DELIVERY_DISTANCE
      ) {
        setLocationError(
          `Delivery is available only within ${MAX_DELIVERY_DISTANCE} km.`
        );

        return;
      }

      setLocationConfirmed(
        true
      );

      setLocationError("");
    };

  /* =======================================================
     ORDER TYPE CHANGE
  ======================================================= */

  const handleOrderTypeChange =
    (type) => {
      setOrderType(type);

      setLocationError("");

      if (
        type === "takeaway"
      ) {
        setLocationConfirmed(
          true
        );
      } else {
        setLocationConfirmed(
          false
        );
      }
    };

  /* =======================================================
     SCRATCH UNLOCK
  ======================================================= */

  const unlockScratch = () => {
    if (!scratchEligible) {
      return;
    }

    const randomIndex =
      Math.floor(
        Math.random() *
          DAILY_SCRATCH_REWARDS.length
      );

    const reward =
      DAILY_SCRATCH_REWARDS[
        randomIndex
      ];

    setScratchReward(
      reward
    );

    setScratchUnlocked(
      true
    );
  };

  /* =======================================================
     CUSTOMER VALIDATION
  ======================================================= */

  const validateCheckout =
    () => {
      setError("");

      if (
        !customerName.trim()
      ) {
        setError(
          "Please enter your name."
        );

        return false;
      }

      if (
        customerPhone.trim()
          .length < 10
      ) {
        setError(
          "Please enter a valid phone number."
        );

        return false;
      }

      if (
        orderType ===
        "delivery"
      ) {
        if (!location) {
          setError(
            "Please select your delivery location."
          );

          return false;
        }

        if (
          !locationConfirmed
        ) {
          setError(
            "Please confirm your delivery location."
          );

          return false;
        }

        if (
          deliveryDistance >
          MAX_DELIVERY_DISTANCE
        ) {
          setError(
            "This location is outside our delivery area."
          );

          return false;
        }
      }

      if (
        !cartItems.length
      ) {
        setError(
          "Your cart is empty."
        );

        return false;
      }

      return true;
    };

  /* =======================================================
     BUILD ORDER DATA
  ======================================================= */

  const buildOrderData =
    () => {
      const customerId =
        currentUser?.uid ||
        localStorage.getItem(
          "customerId"
        ) ||
        customerPhone;

      /* ---------- CART ITEMS ---------- */

      const items =
        cartItems.map(
          (item) => ({
            id:
              item.id ||
              item.menuId ||
              null,

            name:
              item.name ||
              item.title ||
              "Item",

            price: Number(
              item.price ??
                item.salePrice ??
                item.amount ??
                0
            ),

            quantity: Number(
              item.quantity ?? 1
            ),

            image:
              item.image ||
              item.imageUrl ||
              "",

            category:
              item.category ||
              "",
          })
        );

      /* ===================================================
         ADD FREE SCRATCH REWARD TO ORDER
      =================================================== */

      if (
        scratchReward?.type ===
          "free" &&
        scratchReward?.itemName
      ) {
        items.push({
          id: `daily-scratch-${scratchReward.itemName
            .toLowerCase()
            .replace(/\s+/g, "-")}`,

          name: `🎁 FREE ${scratchReward.itemName}`,

          price: 0,

          quantity: 1,

          image: "",

          category:
            "Daily Scratch Reward",

          isFreeReward: true,

          rewardSource:
            "Daily Scratch & Win",
        });
      }

      return {
        customerId,

        customer: {
          name:
            customerName.trim(),

          phone:
            customerPhone.trim(),
        },

        customerName:
          customerName.trim(),

        customerPhone:
          customerPhone.trim(),

        orderType,

        address:
          orderType ===
          "delivery"
            ? address
            : "Takeaway",

        location:
          orderType ===
          "delivery"
            ? location
            : null,

        latitude:
          orderType ===
          "delivery"
            ? location?.lat ||
              null
            : null,

        longitude:
          orderType ===
          "delivery"
            ? location?.lng ||
              null
            : null,

        deliveryDistance:
          orderType ===
          "delivery"
            ? Number(
                deliveryDistance.toFixed(
                  2
                )
              )
            : 0,

        items,

        subtotal,

        deliveryCharge,

        discount: 0,

        gst: 0,

        total,

        bill: subtotal,

        paymentMethod,

        paymentStatus:
          paymentMethod ===
          "Cash on Delivery"
            ? "Pending"
            : "Pending",

        status: "Pending",

        specialInstructions:
          specialNote.trim(),

        specialNote:
          specialNote.trim(),

        dailyScratchEligible:
          scratchEligible,

        dailyScratchReward:
          scratchReward || null,

        loyaltyProgress:
          loyaltyCount,

        createdAt:
          Timestamp.now(),

        source:
          "Sugar Cafe Website",
      };
    };

  /* =======================================================
     CREATE FIRESTORE ORDER
  ======================================================= */

  const createFirestoreOrder =
    async (
      orderData,
      paymentId = null
    ) => {
      const finalData = {
        ...orderData,

        paymentId:
          paymentId || null,

        paymentStatus:
          paymentId
            ? "Paid"
            : orderData.paymentStatus,
      };

      const docRef =
        await addDoc(
          collection(
            db,
            "orders"
          ),
          finalData
        );

      return docRef.id;
    };

  /* =======================================================
     RAZORPAY LOADER
  ======================================================= */

  const loadRazorpay =
    () => {
      return new Promise(
        (resolve) => {
          if (
            window.Razorpay
          ) {
            resolve(true);

            return;
          }

          const script =
            document.createElement(
              "script"
            );

          script.src =
            "https://checkout.razorpay.com/v1/checkout.js";

          script.onload = () =>
            resolve(true);

          script.onerror = () =>
            resolve(false);

          document.body.appendChild(
            script
          );
        }
      );
    };

  /* =======================================================
     ONLINE PAYMENT
  ======================================================= */

  const handleOnlinePayment =
    async () => {
      const loaded =
        await loadRazorpay();

      if (!loaded) {
        throw new Error(
          "Razorpay failed to load."
        );
      }

      const createResponse =
        await fetch(
          "/api/payment/create-order",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              amount:
                Math.round(
                  total * 100
                ),

              currency: "INR",
            }),
          }
        );

      const createData =
        await createResponse.json();

      if (
        !createResponse.ok ||
        !createData?.id
      ) {
        throw new Error(
          createData?.error ||
            "Unable to create payment order."
        );
      }

      return new Promise(
        (
          resolve,
          reject
        ) => {
          const options = {
            key:
              createData.keyId ||
              createData.key ||
              import.meta.env
                .VITE_RAZORPAY_KEY_ID,

            amount:
              createData.amount ||
              Math.round(
                total * 100
              ),

            currency:
              createData.currency ||
              "INR",

            name:
              "Sugar Cafe",

            description:
              "Sugar Cafe Order",

            order_id:
              createData.id,

            prefill: {
              name:
                customerName,

              contact:
                customerPhone,
            },

            theme: {
              color:
                "#ff7058",
            },

            handler:
              async function (
                response
              ) {
                try {
                  const verifyResponse =
                    await fetch(
                      "/api/payment/verify",
                      {
                        method:
                          "POST",

                        headers: {
                          "Content-Type":
                            "application/json",
                        },

                        body:
                          JSON.stringify(
                            {
                              razorpay_order_id:
                                response.razorpay_order_id,

                              razorpay_payment_id:
                                response.razorpay_payment_id,

                              razorpay_signature:
                                response.razorpay_signature,

                              amount:
                                Math.round(
                                  total *
                                    100
                                ),
                            }
                          ),
                      }
                    );

                  const verifyData =
                    await verifyResponse.json();

                  if (
                    !verifyResponse.ok ||
                    !verifyData?.success
                  ) {
                    reject(
                      new Error(
                        verifyData?.error ||
                          "Payment verification failed."
                      )
                    );

                    return;
                  }

                  resolve(
                    response.razorpay_payment_id
                  );
                } catch (err) {
                  reject(err);
                }
              },

            modal: {
              ondismiss:
                () => {
                  reject(
                    new Error(
                      "Payment cancelled."
                    )
                  );
                },
            },
          };

          const razorpay =
            new window.Razorpay(
              options
            );

          razorpay.on(
            "payment.failed",
            (response) => {
              reject(
                new Error(
                  response?.error
                    ?.description ||
                    "Payment failed."
                )
              );
            }
          );

          razorpay.open();
        }
      );
    };

  /* =======================================================
     PLACE ORDER
  ======================================================= */

  const handlePlaceOrder =
    async () => {
      if (placingOrder) {
        return;
      }

      const valid =
        validateCheckout();

      if (!valid) {
        return;
      }

      try {
        setPlacingOrder(
          true
        );

        setError("");

        localStorage.setItem(
          "customerName",
          customerName.trim()
        );

        localStorage.setItem(
          "customerPhone",
          customerPhone.trim()
        );

        const orderData =
          buildOrderData();

        /* =================================================
           COD
        ================================================= */

        if (
          paymentMethod ===
          "Cash on Delivery"
        ) {
          const orderId =
            await createFirestoreOrder(
              orderData
            );

          localStorage.setItem(
            "lastOrderId",
            orderId
          );

          if (clearCart) {
            clearCart();
          }

          navigate(
            `/order-success?orderId=${orderId}`
          );

          return;
        }

        /* =================================================
           ONLINE PAYMENT
        ================================================= */

        const paymentId =
          await handleOnlinePayment();

        const orderId =
          await createFirestoreOrder(
            {
              ...orderData,

              paymentMethod:
                "Online Payment",

              paymentStatus:
                "Paid",

              razorpayPaymentId:
                paymentId,
            },

            paymentId
          );

        localStorage.setItem(
          "lastOrderId",
          orderId
        );

        if (clearCart) {
          clearCart();
        }

        navigate(
          `/order-success?orderId=${orderId}`
        );
      } catch (err) {
        console.error(
          "Place order error:",
          err
        );

        setError(
          err?.message ||
            "Unable to place order. Please try again."
        );
      } finally {
        setPlacingOrder(
          false
        );
      }
    };

  /* =======================================================
     EMPTY CART
  ======================================================= */

  if (!cartItems.length) {
    return (
      <div className="checkout-page">

        <div className="checkout-card">

          <div
            style={{
              textAlign:
                "center",

              padding:
                "40px 10px",
            }}
          >

            <div
              style={{
                fontSize: 55,
                marginBottom: 15,
              }}
            >
              🛒
            </div>

            <h2
              style={{
                color: "#fff",
                margin: 0,
              }}
            >
              Your cart is empty
            </h2>

            <button
              type="button"
              className="place-order-btn"
              style={{
                marginTop: 20,
              }}
              onClick={() =>
                navigate("/")
              }
            >
              Browse Menu
            </button>

          </div>

        </div>

      </div>
    );
  }

  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div className="checkout-page">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div
        style={{
          marginBottom: 22,
          padding:
            "4px 4px",
        }}
      >

        <button
          type="button"
          onClick={() =>
            navigate(-1)
          }
          style={{
            border: 0,
            background:
              "transparent",

            color: "#111",

            fontSize: 26,

            cursor:
              "pointer",

            marginBottom: 8,
          }}
        >
          ←
        </button>

        <div
          style={{
            color: "#111",
            fontSize: 15,
            marginBottom: 2,
          }}
        >
          SUGAR CAFE
        </div>

        <h1
          style={{
            margin: 0,
            color: "#111",
            fontSize: 42,
            lineHeight: 1.05,
            fontWeight: 900,
          }}
        >
          Checkout
        </h1>

        <p
          style={{
            margin:
              "8px 0 0",

            color: "#111",

            fontSize: 18,
          }}
        >
          Almost there! Your
          delicious food is one
          step away ✨
        </p>

        <div
          style={{
            marginTop: 15,

            color: "#111",

            fontWeight: 700,
          }}
        >
          ✓{" "}
          <strong>
            100% Secure
          </strong>
        </div>

      </div>

      {/* ==================================================
          ORDER TYPE
      ================================================== */}

      <section className="checkout-card">

        <div className="section-heading">

          <div className="section-icon">
            🛵
          </div>

          <div>

            <span className="section-kicker">
              CHOOSE YOUR OPTION
            </span>

            <h2>
              Order Type
            </h2>

            <p>
              How would you like to
              receive your order?
            </p>

          </div>

        </div>

        <div className="order-type-options">

          {/* DELIVERY */}

          <button
            type="button"
            className={`order-type-option ${
              orderType ===
              "delivery"
                ? "active"
                : ""
            }`}
            onClick={() =>
              handleOrderTypeChange(
                "delivery"
              )
            }
          >

            <div className="order-type-icon">
              🛵
            </div>

            <div className="order-type-content">

              <strong>
                Delivery
              </strong>

              <small>
                We deliver to your
                location
              </small>

            </div>

            <div className="order-type-radio">
              {orderType ===
                "delivery" &&
                "✓"}
            </div>

          </button>

          {/* TAKEAWAY */}

          <button
            type="button"
            className={`order-type-option ${
              orderType ===
              "takeaway"
                ? "active"
                : ""
            }`}
            onClick={() =>
              handleOrderTypeChange(
                "takeaway"
              )
            }
          >

            <div className="order-type-icon">
              🛍️
            </div>

            <div className="order-type-content">

              <strong>
                Takeaway
              </strong>

              <small>
                Pick up from our
                cafe
              </small>

            </div>

            <div className="order-type-radio">
              {orderType ===
                "takeaway" &&
                "✓"}
            </div>

          </button>

        </div>

      </section>

      {/* ==================================================
          DELIVERY LOCATION
      ================================================== */}

      {orderType ===
        "delivery" && (
        <section className="checkout-card location-card">

          <div className="section-heading">

            <div className="section-icon">
              📍
            </div>

            <div>

              <span className="section-kicker">
                DELIVERY
              </span>

              <h2>
                Delivery Location
              </h2>

              <p>
                Your location is detected
                automatically
              </p>

            </div>

          </div>

          <div className="location-controls">

            <button
              type="button"
              className="location-button"
              onClick={
                useCurrentLocation
              }
              disabled={
                locationLoading
              }
            >
              📍{" "}
              {locationLoading
                ? "Detecting location..."
                : "Use My Current Location"}
            </button>

            <p
              style={{
                margin: 0,

                color:
                  "rgba(255,255,255,.6)",

                fontSize: 14,
              }}
            >
              Move the map to set
              delivery location
            </p>

            <div
              style={{
                width:
                  "100%",

                overflow:
                  "hidden",

                borderRadius:
                  20,

                marginTop: 4,
              }}
            >

              <MapContainer
                center={
                  location
                    ? [
                        location.lat,
                        location.lng,
                      ]
                    : [
                        22.3595,
                        82.7501,
                      ]
                }
                zoom={14}
                scrollWheelZoom={
                  true
                }
                style={{
                  height: 280,
                  width: "100%",
                }}
              >

                <TileLayer
                  attribution="© OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <LocationPicker
                  onSelect={
                    handleLocationSelect
                  }
                />

                {location && (
                  <Marker
                    position={[
                      location.lat,
                      location.lng,
                    ]}
                    icon={
                      markerIcon
                    }
                  />
                )}

              </MapContainer>

            </div>

            {/* ADDRESS */}

            {address && (
              <div className="address-preview">

                <div
                  style={{
                    fontSize: 23,
                  }}
                >
                  📍
                </div>

                <div className="address-preview-content">

                  <span>
                    Selected address
                  </span>

                  <strong>
                    {address}
                  </strong>

                </div>

              </div>
            )}

            {/* DISTANCE */}

            {location && (
              <div className="distance-status">

                📏 Distance:{" "}

                <strong>
                  {deliveryDistance.toFixed(
                    2
                  )} km
                </strong>

                {" / "}

                {deliveryAvailable ? (
                  <span
                    style={{
                      color:
                        "#5ee39a",

                      fontWeight:
                        700,
                    }}
                  >
                    ✓ Delivery available
                  </span>
                ) : (
                  <span
                    style={{
                      color:
                        "#ff765e",

                      fontWeight:
                        700,
                    }}
                  >
                    ✕ Outside delivery
                    area
                  </span>
                )}

              </div>
            )}

            {/* CONFIRM */}

            <button
              type="button"
              className="location-button"
              onClick={
                confirmLocation
              }
              disabled={
                !location ||
                !deliveryAvailable
              }
            >
              ✓ Confirm Delivery
              Location
            </button>

            {locationError && (
              <div
                style={{
                  color:
                    "#ff765e",

                  fontSize: 14,

                  lineHeight:
                    1.4,
                }}
              >
                {locationError}
              </div>
            )}

          </div>

        </section>
      )}

      {/* ==================================================
          CUSTOMER
      ================================================== */}

      <section className="checkout-card">

        <div className="section-heading">

          <div className="section-icon">
            👤
          </div>

          <div>

            <span className="section-kicker">
              CUSTOMER
            </span>

            <h2>
              Your Details
            </h2>

            <p>
              These details will be
              used for your order.
            </p>

          </div>

        </div>

        <div className="customer-profile-box">

          <div className="customer-avatar">
            👤
          </div>

          <div>

            <strong>
              {customerName ||
                "Customer"}
            </strong>

            <span>
              {customerPhone ||
                "Phone number not added"}
            </span>

          </div>

        </div>

        {/* FALLBACK INPUTS */}

        {(!customerName ||
          !customerPhone) && (
          <div
            style={{
              marginTop: 18,

              display:
                "flex",

              flexDirection:
                "column",

              gap: 10,
            }}
          >

            {!customerName && (
              <input
                value={
                  customerName
                }
                onChange={(e) =>
                  setCustomerName(
                    e.target
                      .value
                  )
                }
                placeholder="Your name"
                style={{
                  width:
                    "100%",

                  boxSizing:
                    "border-box",

                  padding:
                    "13px 15px",

                  borderRadius:
                    14,

                  border:
                    "1px solid #d1d5db",

                  fontSize: 15,
                }}
              />
            )}

            {!customerPhone && (
              <input
                value={
                  customerPhone
                }
                onChange={(e) =>
                  setCustomerPhone(
                    e.target
                      .value
                  )
                }
                placeholder="Phone number"
                inputMode="numeric"
                style={{
                  width:
                    "100%",

                  boxSizing:
                    "border-box",

                  padding:
                    "13px 15px",

                  borderRadius:
                    14,

                  border:
                    "1px solid #d1d5db",

                  fontSize: 15,
                }}
              />
            )}

          </div>
        )}

      </section>

      {/* ==================================================
          SPECIAL INSTRUCTIONS
      ================================================== */}

      <section className="checkout-card special-instructions">

        <div className="section-heading">

          <div className="section-icon">
            📝
          </div>

          <div>

            <span className="section-kicker">
              OPTIONAL
            </span>

            <h2>
              Special Instructions
            </h2>

            <p>
              Anything we should know
              about your order?
            </p>

          </div>

        </div>

        <textarea
          value={
            specialNote
          }
          onChange={(e) =>
            setSpecialNote(
              e.target.value.slice(
                0,
                500
              )
            )
          }
          placeholder="Example: Less spicy, no onion, extra sauce..."
          maxLength={500}
        />

        <div className="character-count">
          {specialNote.length}/500
        </div>

      </section>

      {/* ==================================================
          LOYALTY
      ================================================== */}

      <section className="checkout-card loyalty-card">

        <div className="section-heading">

          <div className="section-icon">
            🎁
          </div>

          <div>

            <span className="section-kicker">
              SUGAR REWARDS
            </span>

            <h2>
              6 + 1 Loyalty
            </h2>

            <p>
              Orders of ₹500+ count
              toward your reward.
            </p>

          </div>

        </div>

        <div className="loyalty-progress-row">

          {Array.from({
            length: 6,
          }).map(
            (_, index) => (
              <div
                key={index}
                className={`loyalty-dot ${
                  index <
                  loyaltyCount
                    ? "active"
                    : ""
                }`}
              >
                {index <
                loyaltyCount
                  ? "✓"
                  : index + 1}
              </div>
            )
          )}

        </div>

        <div className="loyalty-status-text">

          {loyaltyLoading ? (
            "Checking your rewards..."
          ) : (
            <>
              <strong>
                {loyaltyCount}/6
              </strong>{" "}
              qualifying orders

              {loyaltyCount <
                LOYALTY_TARGET && (
                <span
                  style={{
                    marginLeft: 8,
                  }}
                >
                  (
                  {LOYALTY_TARGET -
                    loyaltyCount}{" "}
                  more to go)
                </span>
              )}
            </>
          )}

        </div>

        <div
          style={{
            marginTop: 12,

            color:
              "rgba(255,255,255,.55)",

            fontSize: 13,
          }}
        >
          ₹500+ delivered orders
          count towards your next
          Scratch Card.
        </div>

      </section>

      {/* ==================================================
          PAYMENT
      ================================================== */}

      <section className="checkout-card">

        <div className="section-heading">

          <div className="section-icon">
            💳
          </div>

          <div>

            <span className="section-kicker">
              SECURE CHECKOUT
            </span>

            <h2>
              Payment Method
            </h2>

            <p>
              Choose how you want to
              pay
            </p>

          </div>

        </div>

        <div className="payment-options">

          {/* COD */}

          <button
            type="button"
            className={`payment-option ${
              paymentMethod ===
              "Cash on Delivery"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setPaymentMethod(
                "Cash on Delivery"
              )
            }
          >

            <span className="payment-option-icon">
              💵
            </span>

            <span>

              <strong>
                Cash on Delivery
              </strong>

              <small>
                Pay when your order
                arrives
              </small>

            </span>

            <span className="radio-modern">
              {paymentMethod ===
                "Cash on Delivery" &&
                "✓"}
            </span>

          </button>

          {/* ONLINE PAYMENT */}

          <button
            type="button"
            className={`payment-option ${
              paymentMethod ===
              "Online Payment"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setPaymentMethod(
                "Online Payment"
              )
            }
          >

            <span className="payment-option-icon">
              📱
            </span>

            <span>

              <strong>
                Online Payment
              </strong>

              <small>
                UPI / Card / Net
                Banking
              </small>

            </span>

            <span className="radio-modern">
              {paymentMethod ===
                "Online Payment" &&
                "✓"}
            </span>

          </button>

        </div>

      </section>

      {/* ==================================================
          DAILY SCRATCH & WIN
      ================================================== */}

      <section className="checkout-card scratch-card-section">

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap: 18,
          }}
        >

          <div
            className="section-icon"
            style={{
              background:
                "#fff",

              color:
                "#111",

              flexShrink: 0,
            }}
          >
            🎁
          </div>

          <div
            style={{
              minWidth: 0,
              flex: 1,
            }}
          >

            <span className="section-kicker">
              DAILY SCRATCH & WIN
            </span>

            {scratchEligible ? (
              <>
                <h2
                  style={{
                    margin: 0,

                    color:
                      "#fff",

                    fontSize: 22,
                  }}
                >
                  Your Daily Reward
                </h2>

                <p
                  style={{
                    margin:
                      "6px 0 0",

                    color:
                      "rgba(255,255,255,.55)",
                  }}
                >
                  One order. One
                  surprise. Every day.
                </p>
              </>
            ) : (
              <>
                <h2
                  style={{
                    margin: 0,

                    color:
                      "#fff",

                    fontSize: 22,
                  }}
                >
                  Add ₹
                  {
                    amountToUnlockScratch
                  }{" "}
                  more
                </h2>

                <p
                  style={{
                    margin:
                      "6px 0 0",

                    color:
                      "rgba(255,255,255,.55)",
                  }}
                >
                  to unlock today's
                  Scratch & Win
                </p>
              </>
            )}

          </div>

          {scratchEligible &&
            !scratchReward && (
              <button
                type="button"
                onClick={
                  unlockScratch
                }
                className="unlock-scratch-btn"
                style={{
                  width:
                    "auto",

                  minWidth:
                    95,

                  padding:
                    "10px 14px",

                  flexShrink:
                    0,
                }}
              >
                Scratch
              </button>
            )}

        </div>

        {/* =================================================
            SCRATCH RESULT
        ================================================= */}

        {scratchUnlocked &&
          scratchReward && (
            <DailyScratchCard
              reward={
                scratchReward
              }
            />
          )}

      </section>

      {/* ==================================================
          ORDER SUMMARY
      ================================================== */}

      <section className="checkout-card bill-card">

        <div className="section-heading">

          <div className="section-icon">
            🧾
          </div>

          <div>

            <span className="section-kicker">
              YOUR ORDER
            </span>

            <h2>
              Order Summary
            </h2>

          </div>

        </div>

        <div className="bill-items">

          {/* CART ITEMS */}

          {cartItems.map(
            (item, index) => {
              const price =
                Number(
                  item.price ??
                    item.salePrice ??
                    item.amount ??
                    0
                );

              const quantity =
                Number(
                  item.quantity ?? 1
                );

              return (
                <div
                  className="bill-line"
                  key={
                    item.id ||
                    index
                  }
                >

                  <span>
                    {item.name ||
                      item.title ||
                      "Item"}{" "}
                    ×{" "}
                    {quantity}
                  </span>

                  <strong>
                    ₹
                    {(
                      price *
                      quantity
                    ).toFixed(
                      2
                    )}
                  </strong>

                </div>
              );
            }
          )}

          <div className="bill-divider" />

          {/* SUBTOTAL */}

          <div className="bill-line">

            <span>
              Subtotal
            </span>

            <strong>
              ₹
              {subtotal.toFixed(
                2
              )}
            </strong>

          </div>

          {/* DELIVERY */}

          {orderType ===
            "delivery" && (
            <div className="bill-line">

              <span>
                Delivery
                {location
                  ? ` (${deliveryDistance.toFixed(
                      1
                    )} km)`
                  : ""}
              </span>

              <strong>
                ₹
                {deliveryCharge.toFixed(
                  2
                )}
              </strong>

            </div>
          )}

          {/* GST */}

          <div className="bill-line">

            <span>
              GST
            </span>

            <strong>
              ₹0
            </strong>

          </div>

          {/* SCRATCH REWARD */}

          {scratchReward && (
            <div
              style={{
                marginTop: 14,

                padding:
                  "12px 14px",

                borderRadius:
                  14,

                background:
                  "rgba(255,190,70,.08)",

                border:
                  "1px solid rgba(255,190,70,.18)",

                color:
                  "#ffd36b",

                fontSize: 14,

                fontWeight: 700,
              }}
            >
              🎁 Daily Scratch:{" "}
              {
                scratchReward.label
              }
            </div>
          )}

          <div
            className="bill-divider"
          />

          {/* TOTAL */}

          <div className="bill-line total-line">

            <span>
              Total Amount
            </span>

            <strong>
              ₹
              {total.toFixed(
                2
              )}
            </strong>

          </div>

        </div>

      </section>

      {/* ==================================================
          ERROR
      ================================================== */}

      {error && (
        <div
          style={{
            margin:
              "4px 2px 15px",

            padding:
              "14px 16px",

            borderRadius:
              15,

            background:
              "rgba(255,80,70,.12)",

            border:
              "1px solid rgba(255,100,80,.3)",

            color:
              "#ff8a78",

            fontSize: 14,

            lineHeight:
              1.45,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ==================================================
          BOTTOM CHECKOUT
      ================================================== */}

      <div className="checkout-bottom">

        <div className="checkout-total-mini">

          <span>
            Payable
          </span>

          <strong>
            ₹
            {total.toFixed(
              2
            )}
          </strong>

        </div>

        <button
          type="button"
          className="place-order-btn"
          onClick={
            handlePlaceOrder
          }
          disabled={
            placingOrder ||
            (orderType ===
              "delivery" &&
              !deliveryAvailable)
          }
        >
          {placingOrder
            ? paymentMethod ===
              "Online Payment"
              ? "Processing Payment..."
              : "Placing Order..."
            : orderType ===
              "delivery"
            ? "Place Delivery Order"
            : "Place Takeaway Order"}
        </button>

        <span className="checkout-secure-note">
          🔒 Your order and payment
          information are securely
          processed.
        </span>

      </div>

    </div>
  );
}
