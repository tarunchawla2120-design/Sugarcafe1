/* =========================================================
   SUGAR CAFE — PREMIUM CHECKOUT FINAL
   Premium UI + Leaflet + Delivery/Takeaway + Razorpay
   Firebase Orders + Daily Scratch + Sugar Rewards
========================================================= */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { addDoc, collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import { useCart } from "../context/CartContext";
import { useStoreSettings } from "../context/StoreContext";
import { db } from "../firebase";

import "./Checkout.css";


/* =========================================================
   CONSTANTS
========================================================= */

const SHOP_LOCATION = {
  lat: 22.417212,
  lng: 82.665984,
};

const DEFAULT_MAX_DISTANCE = 15;
const DEFAULT_DELIVERY_PER_KM = 20;
const DEFAULT_MIN_DELIVERY = 20;
const DEFAULT_MAX_DELIVERY = 300;

const LOYALTY_MIN_BILL = 500;
const LOYALTY_TARGET = 6;
const DAILY_SCRATCH_MIN_BILL = 499;

const DAILY_SCRATCH_REWARDS = [
  {
    type: "discount",
    discountPercent: 5,
    title: "5% OFF",
    shortTitle: "5% Discount",
  },
  {
    type: "freeItem",
    itemName: "Cheese Aloo Puff",
    title: "FREE Cheese Aloo Puff",
    shortTitle: "Free Cheese Aloo Puff",
  },
  {
    type: "freeItem",
    itemName: "Veg Aloo Tikka Burger",
    title: "FREE Veg Aloo Tikka Burger",
    shortTitle: "Free Veg Aloo Tikka Burger",
  },
  {
    type: "freeItem",
    itemName: "French Fries",
    title: "FREE French Fries",
    shortTitle: "Free French Fries",
  },
];

const LOYALTY_REWARDS = [
  "Classic Cold Coffee",
  "Cheese Aloo Tikki Burger",
  "Aloo Cheese Puff",
  "Paneer Cheese Sandwich",
  "Diet Coke",
  "Salted French Fries",
  "Hot Chocolate Brownie",
  "Hot Chocolava",
];


/* =========================================================
   HELPERS
========================================================= */

const money = (value) => `₹${Number(value || 0).toFixed(0)}`;

const getQty = (item) =>
  Number(item?.qty ?? item?.quantity ?? 1);

const getTodayKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};


/* =========================================================
   MAP CENTER TRACKER
========================================================= */

function MapCenterTracker({ onMoveEnd }) {
  useMapEvents({
    moveend: (event) => {
      const center = event.target.getCenter();
      onMoveEnd({
        lat: center.lat,
        lng: center.lng,
      });
    },
  });

  return null;
}


/* =========================================================
   MAP RECENTER CONTROL
========================================================= */

function MapRecenter({ position }) {
  const map = useMap();

  return (
    <button
      type="button"
      className="map-recenter-control"
      onClick={() => {
        map.flyTo(position, 16, {
          duration: 0.8,
        });
      }}
      aria-label="Recenter map"
    >
      ◎
    </button>
  );
}


/* =========================================================
   CHECKOUT
========================================================= */

function Checkout() {
  const navigate = useNavigate();
  const store = useStoreSettings();

  const { cart, totalPrice } = useCart();

  const [orderType, setOrderType] = useState("Delivery");

  const [address, setAddress] = useState("");
  const [manualAddress, setManualAddress] = useState("");

  const [mapCenter, setMapCenter] = useState(SHOP_LOCATION);
  const [marker, setMarker] = useState(SHOP_LOCATION);

  const [loadingLocation, setLoadingLocation] = useState(false);
  const [geocodingManual, setGeocodingManual] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState(
    store?.codEnabled === false && store?.upiEnabled
      ? "Online Payment"
      : "Cash on Delivery"
  );

  const [specialNote, setSpecialNote] = useState("");

  const [customerProfile, setCustomerProfile] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [qualifyingOrders, setQualifyingOrders] = useState(0);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  const [dailyScratchReward, setDailyScratchReward] = useState(null);
  const [dailyScratchRevealed, setDailyScratchRevealed] = useState(false);
  const [dailyScratchEligible, setDailyScratchEligible] = useState(false);

  const mapRef = useRef(null);


  /* =====================================================
     SETTINGS
  ===================================================== */

  const MAX_DELIVERY_DISTANCE = safeNumber(
    store?.maxDeliveryDistanceKm,
    DEFAULT_MAX_DISTANCE
  );

  const DELIVERY_PER_KM = safeNumber(
    store?.deliveryPerKm,
    DEFAULT_DELIVERY_PER_KM
  );

  const MIN_DELIVERY_CHARGE = safeNumber(
    store?.minDeliveryCharge,
    DEFAULT_MIN_DELIVERY
  );

  const MAX_DELIVERY_CHARGE = safeNumber(
    store?.maxDeliveryCharge,
    DEFAULT_MAX_DELIVERY
  );


  /* =====================================================
     LOAD CUSTOMER + LOCATION
  ===================================================== */

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("sugarCafeUser");

      if (savedUser) {
        const data = JSON.parse(savedUser);

        const profile = {
          ...data,
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || "",
          customerId: data.customerId || "",
          addresses: Array.isArray(data.addresses)
            ? data.addresses
            : [],
          guest: data.guest ?? true,
        };

        setCustomerProfile(profile);
        setSavedAddresses(profile.addresses);
      }

      const savedLocation = localStorage.getItem("userLocation");

      if (savedLocation) {
        const loc = JSON.parse(savedLocation);

        const lat = safeNumber(loc.latitude, NaN);
        const lng = safeNumber(loc.longitude, NaN);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const saved = { lat, lng };

          setMarker(saved);
          setMapCenter(saved);

          setAddress(
            loc.fullAddress ||
              loc.address ||
              ""
          );
        }
      }
    } catch (error) {
      console.error("Checkout loading error:", error);
    }
  }, []);


  /* =====================================================
     CUSTOMER ID
  ===================================================== */

  const customerId = useMemo(() => {
    return (
      customerProfile?.customerId ||
      customerProfile?.id ||
      customerProfile?.uid ||
      customerProfile?.phone ||
      customerProfile?.email ||
      ""
    );
  }, [customerProfile]);


  /* =====================================================
     DELIVERY CALCULATION
  ===================================================== */

  const distance = useMemo(
    () =>
      calculateDistance(
        SHOP_LOCATION.lat,
        SHOP_LOCATION.lng,
        marker.lat,
        marker.lng
      ),
    [marker]
  );

  const deliveryAvailable =
    distance <= MAX_DELIVERY_DISTANCE;

  const deliveryCharge = useMemo(() => {
    if (
      orderType !== "Delivery" ||
      !deliveryAvailable ||
      Number(totalPrice) <= 0
    ) {
      return 0;
    }

    const roundedDistance = Math.ceil(distance);

    return Math.min(
      MAX_DELIVERY_CHARGE,
      Math.max(
        MIN_DELIVERY_CHARGE,
        roundedDistance * DELIVERY_PER_KM
      )
    );
  }, [
    orderType,
    deliveryAvailable,
    totalPrice,
    distance,
    DELIVERY_PER_KM,
    MIN_DELIVERY_CHARGE,
    MAX_DELIVERY_CHARGE,
  ]);


  /* =====================================================
     DAILY SCRATCH
========================================================= */

  useEffect(() => {
    const eligible = Number(totalPrice) >= DAILY_SCRATCH_MIN_BILL;
    setDailyScratchEligible(eligible);

    const key = `sugarCafeDailyScratch:${customerId || "guest"}:${getTodayKey()}`;

    try {
      const saved = sessionStorage.getItem(key);

      if (saved) {
        const data = JSON.parse(saved);
        setDailyScratchReward(data.reward || null);
        setDailyScratchRevealed(Boolean(data.revealed));
      } else {
        setDailyScratchReward(null);
        setDailyScratchRevealed(false);
      }
    } catch (error) {
      console.error("Scratch state error:", error);
    }
  }, [customerId, totalPrice]);


  const revealDailyScratch = () => {
    if (!dailyScratchEligible || dailyScratchRevealed) {
      return;
    }

    const index = Math.floor(
      Math.random() * DAILY_SCRATCH_REWARDS.length
    );

    const reward = DAILY_SCRATCH_REWARDS[index];

    setDailyScratchReward(reward);
    setDailyScratchRevealed(true);

    const key = `sugarCafeDailyScratch:${customerId || "guest"}:${getTodayKey()}`;

    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          reward,
          revealed: true,
        })
      );
    } catch (error) {
      console.error("Scratch save error:", error);
    }
  };


  /* =====================================================
     DISCOUNT / REWARD TOTAL
  ===================================================== */

  const scratchDiscount = useMemo(() => {
    if (
      !dailyScratchRevealed ||
      !dailyScratchReward ||
      dailyScratchReward.type !== "discount"
    ) {
      return 0;
    }

    return Number(totalPrice) *
      (Number(dailyScratchReward.discountPercent || 0) / 100);
  }, [
    totalPrice,
    dailyScratchReward,
    dailyScratchRevealed,
  ]);

  const rewardFreeItem = useMemo(() => {
    if (
      !dailyScratchRevealed ||
      !dailyScratchReward ||
      dailyScratchReward.type !== "freeItem"
    ) {
      return null;
    }

    return dailyScratchReward.itemName;
  }, [dailyScratchReward, dailyScratchRevealed]);

  const gst = 0;

  const grandTotal = Math.max(
    0,
    Number(totalPrice) +
      Number(deliveryCharge) -
      Number(scratchDiscount) +
      Number(gst)
  );


  /* =====================================================
     LOAD SUGAR REWARDS PROGRESS
  ===================================================== */

  const loadLoyaltyProgress = useCallback(async () => {
    if (!customerId) {
      setQualifyingOrders(0);
      return;
    }

    setLoyaltyLoading(true);

    try {
      const ordersQuery = query(
        collection(db, "orders"),
        where("customerId", "==", customerId)
      );

      const snapshot = await getDocs(ordersQuery);

      const count = snapshot.docs.filter((doc) => {
        const data = doc.data();

        return (
          String(data.status || "").toLowerCase() === "delivered" &&
          Number(data.total ?? data.bill ?? 0) >= LOYALTY_MIN_BILL
        );
      }).length;

      setQualifyingOrders(
        Math.min(count, LOYALTY_TARGET)
      );
    } catch (error) {
      console.error("Loyalty progress error:", error);
      setQualifyingOrders(0);
    } finally {
      setLoyaltyLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadLoyaltyProgress();
  }, [loadLoyaltyProgress]);


  /* =====================================================
     REVERSE GEOCODING
  ===================================================== */

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      return (
        data.display_name ||
        `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      );
    } catch (error) {
      console.error("Reverse geocoding error:", error);

      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }, []);


  /* =====================================================
     UPDATE MAP LOCATION
  ===================================================== */

  const updateMapLocation = useCallback(
    async (location, shouldGeocode = true) => {
      setMarker(location);
      setMapCenter(location);

      if (shouldGeocode) {
        const formatted = await reverseGeocode(
          location.lat,
          location.lng
        );

        setAddress(formatted);

        localStorage.setItem(
          "userLocation",
          JSON.stringify({
            latitude: location.lat,
            longitude: location.lng,
            address: formatted,
            fullAddress: formatted,
          })
        );
      }
    },
    [reverseGeocode]
  );


  const handleMapMove = useCallback(
    async (center) => {
      setMarker(center);
      setMapCenter(center);

      const formatted = await reverseGeocode(
        center.lat,
        center.lng
      );

      setAddress(formatted);

      localStorage.setItem(
        "userLocation",
        JSON.stringify({
          latitude: center.lat,
          longitude: center.lng,
          address: formatted,
          fullAddress: formatted,
        })
      );
    },
    [reverseGeocode]
  );


  /* =====================================================
     CURRENT LOCATION
  ===================================================== */

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Your browser does not support location.");
      return;
    }

    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          setMapCenter(location);
          setMarker(location);

          const formatted = await reverseGeocode(
            location.lat,
            location.lng
          );

          setAddress(formatted);

          localStorage.setItem(
            "userLocation",
            JSON.stringify({
              latitude: location.lat,
              longitude: location.lng,
              address: formatted,
              fullAddress: formatted,
            })
          );

          if (mapRef.current) {
            mapRef.current.flyTo(
              [location.lat, location.lng],
              16,
              { duration: 0.8 }
            );
          }
        } catch (error) {
          console.error("Location processing error:", error);
          alert(
            "Location mil gayi, lekin address load nahi ho paya."
          );
        } finally {
          setLoadingLocation(false);
        }
      },
      (error) => {
        console.error("Location error:", error);
        setLoadingLocation(false);

        if (error.code === error.PERMISSION_DENIED) {
          alert(
            "Location permission denied. Browser settings mein location permission Allow karein."
          );
        } else if (
          error.code === error.POSITION_UNAVAILABLE
        ) {
          alert(
            "Your location is currently unavailable. Please try again."
          );
        } else if (error.code === error.TIMEOUT) {
          alert(
            "Location lene mein time lag raha hai. Please try again."
          );
        } else {
          alert("Unable to get your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };


  /* =====================================================
     MANUAL ADDRESS
  ===================================================== */

  const useManualAddress = async () => {
    const value = manualAddress.trim();

    if (!value) {
      alert("Please enter your complete delivery address.");
      return;
    }

    setGeocodingManual(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          `${value}, Korba, Chhattisgarh, India`
        )}&limit=1&addressdetails=1`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      const results = await response.json();

      if (!results?.[0]) {
        alert(
          "Address nahi mila. Please thoda aur complete address enter karein."
        );
        return;
      }

      const lat = safeNumber(results[0].lat, NaN);
      const lng = safeNumber(results[0].lon, NaN);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        alert("Selected address coordinates nahi mile.");
        return;
      }

      const location = { lat, lng };

      const formatted =
        results[0].display_name || value;

      setMarker(location);
      setMapCenter(location);
      setAddress(formatted);

      localStorage.setItem(
        "userLocation",
        JSON.stringify({
          latitude: lat,
          longitude: lng,
          address: formatted,
          fullAddress: formatted,
        })
      );

      if (mapRef.current) {
        mapRef.current.flyTo(
          [lat, lng],
          16,
          { duration: 0.8 }
        );
      }
    } catch (error) {
      console.error("Manual address error:", error);
      alert(
        "Address check nahi ho paya. Please try again."
      );
    } finally {
      setGeocodingManual(false);
    }
  };


  /* =====================================================
     MAP LOAD
  ===================================================== */

  const onMapReady = (event) => {
    mapRef.current = event.target;
  };


  /* =====================================================
     SAVED ADDRESS
  ===================================================== */

  const selectSavedAddress = (saved) => {
    const lat = safeNumber(saved.latitude, NaN);
    const lng = safeNumber(saved.longitude, NaN);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const location = { lat, lng };

    setMarker(location);
    setMapCenter(location);

    setAddress(
      saved.fullAddress ||
        saved.address ||
        ""
    );

    localStorage.setItem(
      "userLocation",
      JSON.stringify({
        ...saved,
        latitude: lat,
        longitude: lng,
        address:
          saved.fullAddress ||
          saved.address ||
          "",
      })
    );

    if (mapRef.current) {
      mapRef.current.flyTo(
        [lat, lng],
        16,
        { duration: 0.8 }
      );
    }
  };


  /* =====================================================
     CUSTOMER DATA
  ===================================================== */

  const getCustomerData = () => {
    if (!customerProfile) {
      return null;
    }

    return {
      userId:
        customerProfile.userId ||
        customerProfile.uid ||
        "",
      customerId,
      customerName:
        customerProfile.name || "Customer",
      customerPhone:
        customerProfile.phone || "",
      customerEmail:
        customerProfile.email || "",
      photoURL:
        customerProfile.photoURL || "",
    };
  };


  /* =====================================================
     SAVE ADDRESS
  ===================================================== */

  const saveCustomerAddress = async () => {
    const selectedAddress = {
      id: `${Date.now()}`,
      label: "Delivery Address",
      address: address.trim(),
      fullAddress: address.trim(),
      latitude: Number(marker.lat),
      longitude: Number(marker.lng),
      savedAt: new Date().toISOString(),
    };

    if (orderType !== "Delivery") {
      return selectedAddress;
    }

    try {
      const savedUser =
        localStorage.getItem("sugarCafeUser");

      if (savedUser) {
        const profile = JSON.parse(savedUser);

        const existingAddresses = Array.isArray(
          profile.addresses
        )
          ? profile.addresses
          : [];

        const alreadySaved = existingAddresses.some(
          (item) =>
            Number(item.latitude) ===
              Number(selectedAddress.latitude) &&
            Number(item.longitude) ===
              Number(selectedAddress.longitude)
        );

        const addresses = alreadySaved
          ? existingAddresses
          : [
              ...existingAddresses,
              selectedAddress,
            ];

        const updatedProfile = {
          ...profile,
          addresses,
          defaultAddress: selectedAddress,
        };

        localStorage.setItem(
          "sugarCafeUser",
          JSON.stringify(updatedProfile)
        );

        setCustomerProfile(updatedProfile);
        setSavedAddresses(addresses);
      }
    } catch (error) {
      console.error("Guest address save error:", error);
    }

    return selectedAddress;
  };


  /* =====================================================
     SAVE ORDER
  ===================================================== */

  const saveCompletedOrder = async (
    orderData,
    selectedAddress
  ) => {
    const orderRef = await addDoc(
      collection(db, "orders"),
      orderData
    );

    localStorage.setItem(
      "lastOrderId",
      orderRef.id
    );

    localStorage.setItem(
      "lastOrderNumber",
      orderData.orderNumber
    );

    localStorage.setItem(
      "lastOrderPaymentStatus",
      orderData.paymentStatus
    );

    return orderRef;
  };


  /* =====================================================
     RAZORPAY
  ===================================================== */

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");

      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";

      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });


  const readApiResponse = async (response) => {
    const raw = await response.text();

    if (!raw) {
      throw new Error(
        `Payment service returned an empty response (HTTP ${response.status}).`
      );
    }

    try {
      return JSON.parse(raw);
    } catch {
      const preview = raw
        .replace(/\s+/g, " ")
        .slice(0, 180);

      throw new Error(
        `Payment service returned an invalid response (HTTP ${response.status}). ${preview}`
      );
    }
  };


  /* =====================================================
     ONLINE PAYMENT
  ===================================================== */

  const startOnlinePayment = async ({
    customer,
    orderData,
    selectedAddress,
  }) => {
    const baseUrl =
      import.meta.env.VITE_PAYMENT_API_URL || "";

    const gatewayResponse = await fetch(
      `${baseUrl}/api/payment/create-order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderData,
          selectedAddress,
        }),
      }
    );

    const gatewayData =
      await readApiResponse(gatewayResponse);

    if (!gatewayResponse.ok) {
      throw new Error(
        gatewayData.error ||
          "Unable to start online payment."
      );
    }

    const loaded = await loadRazorpay();

    if (!loaded) {
      throw new Error(
        "Payment gateway load nahi ho paya. Internet connection check karein."
      );
    }

    await new Promise((resolve, reject) => {
      const razorpay = new window.Razorpay({
        key: gatewayData.keyId,
        amount: gatewayData.amount,
        currency:
          gatewayData.currency || "INR",
        name: "Sugar Cafe",
        description:
          `Sugar Cafe Order ${orderData.orderNumber}`,
        order_id: gatewayData.orderId,

        prefill: {
          name: customer.customerName || "",
          email: customer.customerEmail || "",
          contact: customer.customerPhone || "",
        },

        handler: async (response) => {
          try {
            const verifyResponse =
              await fetch(
                `${baseUrl}/api/payment/verify`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body: JSON.stringify({
                    razorpayOrderId:
                      response.razorpay_order_id,
                    razorpayPaymentId:
                      response.razorpay_payment_id,
                    razorpaySignature:
                      response.razorpay_signature,
                  }),
                }
              );

            const verifyData =
              await readApiResponse(
                verifyResponse
              );

            if (
              !verifyResponse.ok ||
              !verifyData.verified
            ) {
              reject(
                new Error(
                  "Payment verification failed."
                )
              );
              return;
            }

            if (!verifyData.finalized) {
              const paidOrder = {
                ...orderData,
                paymentMethod:
                  "Online Payment",
                paymentStatus: "Paid",
                paymentNote:
                  "Paid and verified by Razorpay.",
                razorpayOrderId:
                  response.razorpay_order_id,
                razorpayPaymentId:
                  response.razorpay_payment_id,
                razorpaySignature:
                  response.razorpay_signature,
              };

              await saveCompletedOrder(
                paidOrder,
                selectedAddress
              );
            }

            resolve();
          } catch (error) {
            reject(error);
          }
        },

        modal: {
          ondismiss: () =>
            reject(
              new Error(
                "Payment cancelled."
              )
            ),
        },
      });

      razorpay.on(
        "payment.failed",
        (response) => {
          reject(
            new Error(
              response?.error?.description ||
                "Payment failed. Please try again."
            )
          );
        }
      );

      razorpay.open();
    });
  };


  /* =====================================================
     PLACE ORDER
  ===================================================== */

  const placeOrder = async () => {
    if (!store.deliveryAvailable) {
      alert(
        store.announcement ||
          `Orders are unavailable ${
            store.orderTimingLabel || ""
          }.`
      );
      return;
    }

    if (
      paymentMethod === "Online Payment" &&
      !store.upiEnabled
    ) {
      alert(
        "Online payment is currently unavailable. Please choose another payment method."
      );
      return;
    }

    if (
      paymentMethod === "Cash on Delivery" &&
      !store.codEnabled
    ) {
      alert(
        "Cash on Delivery is currently unavailable. Please choose another payment method."
      );
      return;
    }

    if (!cart.length) {
      alert("Your cart is empty.");
      return;
    }

    if (
      !customerProfile ||
      !customerProfile.name ||
      !customerProfile.phone
    ) {
      alert(
        "Please enter your name and mobile number before placing the order."
      );

      navigate("/login", {
        state: {
          from: "/checkout",
        },
      });

      return;
    }

    const customer = getCustomerData();

    if (!customer?.customerPhone) {
      alert(
        "Mobile number is required to place an order."
      );
      return;
    }

    if (orderType === "Delivery") {
      if (!address.trim()) {
        alert(
          "Please select your delivery address."
        );
        return;
      }

      if (!deliveryAvailable) {
        alert(
          `Sorry! We currently deliver within ${MAX_DELIVERY_DISTANCE} km of our shop.`
        );
        return;
      }
    }

    try {
      setPlacingOrder(true);

      const orderItems = cart.map((item) => ({
        id: item.id || "",
        name: item.name || "",
        price: Number(item.price || 0),
        qty: getQty(item),
        image: item.image || "",
        category: item.category || "",
      }));

      if (rewardFreeItem) {
        const rewardItem = cart.find(
          (item) =>
            String(item.name || "").toLowerCase() ===
            String(rewardFreeItem).toLowerCase()
        );

        if (rewardItem) {
          orderItems.push({
            id: `reward-${Date.now()}`,
            name: `🎁 FREE ${rewardFreeItem}`,
            price: 0,
            qty: 1,
            image: rewardItem.image || "",
            category: rewardItem.category || "",
            reward: true,
          });
        } else {
          orderItems.push({
            id: `reward-${Date.now()}`,
            name: `🎁 FREE ${rewardFreeItem}`,
            price: 0,
            qty: 1,
            image: "",
            category: "Reward",
            reward: true,
          });
        }
      }

      const orderData = {
        orderNumber:
          `SC-${Date.now()}`,

        userId:
          customer.userId || "",

        customerId:
          customer.customerId || customerId || "",

        customerName:
          customer.customerName,

        phone:
          customer.customerPhone,

        email:
          customer.customerEmail,

        photoURL:
          customer.photoURL,

        orderType,

        address:
          orderType === "Delivery"
            ? address
            : "Takeaway — Pickup from Sugar Cafe",

        latitude:
          orderType === "Delivery"
            ? marker.lat
            : null,

        longitude:
          orderType === "Delivery"
            ? marker.lng
            : null,

        distance:
          orderType === "Delivery"
            ? Number(distance.toFixed(2))
            : 0,

        specialNote:
          specialNote.trim(),

        paymentMethod,

        paymentStatus:
          paymentMethod === "Online Payment"
            ? "Paid"
            : "Pending",

        paymentNote:
          paymentMethod === "Online Payment"
            ? "Paid and verified by Razorpay."
            : "",

        items: orderItems,

        subtotal: Number(totalPrice),

        deliveryCharge:
          Number(deliveryCharge),

        discount:
          Number(scratchDiscount),

        gst: Number(gst),

        total:
          Number(grandTotal),

        dailyScratchReward:
          dailyScratchReward
            ? dailyScratchReward.title
            : "",

        loyaltyReward:
          "",

        status: "New",

        preparationMinutes:
          Number(
            store.preparationMinutes ?? 15
          ),

        preparationStartedAt: null,
        preparationEndAt: null,
        foodReadyAt: null,
        dispatchedAt: null,
        deliveredAt: null,

        createdAt: Timestamp.now(),
      };

      const selectedAddress =
        await saveCustomerAddress();

      if (
        paymentMethod === "Online Payment"
      ) {
        await startOnlinePayment({
          customer,
          orderData,
          selectedAddress,
        });
      } else {
        await saveCompletedOrder(
          orderData,
          selectedAddress
        );
      }

      alert(
        "🎉 Order Placed Successfully!"
      );

      navigate("/success");
    } catch (error) {
      console.error(
        "❌ Order placement error:",
        error
      );

      alert(
        `Order place nahi ho paya.\n\n${
          error?.message || "Unknown error"
        }`
      );
    } finally {
      setPlacingOrder(false);
    }
  };


  /* =====================================================
     UI
  ===================================================== */

  const orderDisabled =
    !store.deliveryAvailable ||
    placingOrder ||
    (orderType === "Delivery" &&
      !deliveryAvailable);

  const progressPercent =
    Math.min(
      100,
      (qualifyingOrders / LOYALTY_TARGET) *
        100
    );

  return (
    <div className="checkout-page">

      {/* STORE STATUS */}
      <div className="checkout-store-status">
        <span className="status-dot" />
        <strong>
          {store.deliveryAvailable
            ? "Delivery Available"
            : "Orders Closed"}
        </strong>

        <span className="status-time">
          {store.deliveryAvailable
            ? `Today: ${
                store.orderTimingLabel ||
                "11:00 AM – 3:00 AM"
              }`
            : store.orderTimingLabel || ""}
        </span>
      </div>


      {/* HEADER */}
      <header className="checkout-header">
        <button
          type="button"
          className="checkout-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ←
        </button>

        <div className="checkout-header-content">
          <span className="checkout-brand">
            SUGAR CAFE
          </span>

          <h1>Checkout</h1>

          <p>
            Almost there! Your delicious
            food is one step away ✨
          </p>
        </div>

        <div className="secure-badge">
          <span>✓</span>
          <div>
            <strong>100%</strong>
            <small>Secure</small>
          </div>
        </div>
      </header>


      {/* ORDER TYPE */}
      <section className="checkout-card order-type-card">
        <div className="section-heading">
          <div className="section-icon">
            🛵
          </div>

          <div>
            <span className="section-label">
              CHOOSE YOUR OPTION
            </span>
            <h3>Order Type</h3>
            <p>
              How would you like to receive your order?
            </p>
          </div>
        </div>

        <div className="order-type-grid">
          <button
            type="button"
            className={`order-type-option ${
              orderType === "Delivery"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrderType("Delivery")
            }
          >
            <div className="option-top">
              <span className="option-emoji">
                🛵
              </span>
              <span className="option-radio">
                {orderType === "Delivery"
                  ? "✓"
                  : ""}
              </span>
            </div>

            <strong>Delivery</strong>
            <small>
              We deliver to your location
            </small>
          </button>

          <button
            type="button"
            className={`order-type-option ${
              orderType === "Takeaway"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrderType("Takeaway")
            }
          >
            <div className="option-top">
              <span className="option-emoji">
                🛍️
              </span>
              <span className="option-radio">
                {orderType === "Takeaway"
                  ? "✓"
                  : ""}
              </span>
            </div>

            <strong>Takeaway</strong>
            <small>
              Pick up from our cafe
            </small>
          </button>
        </div>
      </section>


      {/* CUSTOMER + DELIVERY */}
      {orderType === "Delivery" && (
        <section className="checkout-card delivery-card">

          <div className="section-heading delivery-heading">
            <div className="section-icon">
              📍
            </div>

            <div>
              <span className="section-label">
                DELIVERY
              </span>
              <h3>Delivery Location</h3>
              <p>
                Your location is detected automatically
              </p>
            </div>

            <span
              className={`location-status ${
                deliveryAvailable
                  ? "confirmed"
                  : "not-confirmed"
              }`}
            >
              {deliveryAvailable
                ? "✓ Confirmed"
                : "⚠ Check"}
            </span>
          </div>


          {customerProfile && (
            <div className="checkout-customer-box">
              <div className="customer-avatar">
                {customerProfile.photoURL ? (
                  <img
                    src={
                      customerProfile.photoURL
                    }
                    alt=""
                  />
                ) : (
                  "👤"
                )}
              </div>

              <div className="customer-info">
                <strong>
                  {customerProfile.name ||
                    "Customer"}
                </strong>

                <span>
                  📱{" "}
                  {customerProfile.phone}
                </span>

                {customerProfile.email && (
                  <span>
                    ✉️{" "}
                    {customerProfile.email}
                  </span>
                )}

                {customerId && (
                  <span>
                    🪪 ID {customerId}
                  </span>
                )}
              </div>

              <div className="customer-check">
                ✓
              </div>
            </div>
          )}


          {savedAddresses.length > 0 && (
            <div className="saved-addresses">
              <div className="saved-heading">
                <strong>
                  Saved Addresses
                </strong>
                <span>Tap to use</span>
              </div>

              <div className="saved-address-list">
                {savedAddresses.map(
                  (saved, index) => (
                    <button
                      type="button"
                      key={
                        saved.id ||
                        `${saved.latitude}-${saved.longitude}-${index}`
                      }
                      className="saved-address-btn"
                      onClick={() =>
                        selectSavedAddress(
                          saved
                        )
                      }
                    >
                      <span className="saved-pin">
                        📍
                      </span>

                      <span className="saved-address-text">
                        <strong>
                          {saved.label ||
                            "Delivery Address"}
                        </strong>

                        <small>
                          {saved.fullAddress ||
                            saved.address ||
                            "Saved location"}
                        </small>
                      </span>

                      <span>→</span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}


          {/* MANUAL ADDRESS */}
          <div className="manual-address-box">
            <label>
              Search / enter your delivery address
            </label>

            <input
              value={manualAddress}
              onChange={(e) =>
                setManualAddress(
                  e.target.value
                )
              }
              placeholder="House/Flat No., Area, Landmark, City, PIN"
            />

            <button
              type="button"
              className="manual-address-btn"
              onClick={
                useManualAddress
              }
              disabled={geocodingManual}
            >
              {geocodingManual
                ? "Checking address..."
                : "✓ Use This Address"}
            </button>
          </div>


          {/* CURRENT LOCATION */}
          <button
            type="button"
            className="current-location-btn"
            onClick={
              getCurrentLocation
            }
          >
            <span className="current-location-icon">
              ◎
            </span>

            <span>
              {loadingLocation
                ? "Getting Location..."
                : "Use My Current Location"}
            </span>

            <span>→</span>
          </button>


          {/* MAP */}
          <div className="checkout-map-wrapper">
            <MapContainer
              center={[
                mapCenter.lat,
                mapCenter.lng,
              ]}
              zoom={15}
              scrollWheelZoom={false}
              className="checkout-map"
              whenReady={onMapReady}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapCenterTracker
                onMoveEnd={
                  handleMapMove
                }
              />

              <MapRecenter
                position={marker}
              />
            </MapContainer>

            <div className="map-center-pin">
              <div className="map-pin-shadow" />
              <div className="map-pin">
                <span />
              </div>
            </div>

            <div className="live-location-badge">
              <span />
              Live location
            </div>
          </div>


          <div className="map-instruction">
            <div className="instruction-icon">
              📍
            </div>

            <div>
              <strong>
                Your delivery location
              </strong>
              <p>
                Move the map to adjust your exact location
              </p>
            </div>
          </div>


          {/* SELECTED ADDRESS */}
          <div className="selected-address-card">
            <div className="selected-address-icon">
              🏠
            </div>

            <div className="selected-address-content">
              <span>
                SELECTED ADDRESS
              </span>

              <strong>
                {address ||
                  "Move the map or use your current location"}
              </strong>

              <small>
                {distance.toFixed(1)} km from Sugar Cafe
              </small>
            </div>

            <button
              type="button"
              className="address-recenter-btn"
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.flyTo(
                    [
                      marker.lat,
                      marker.lng,
                    ],
                    16,
                    {
                      duration: 0.8,
                    }
                  );
                }
              }}
            >
              ◎
            </button>
          </div>


          {/* DISTANCE + CHARGE */}
          <div className="delivery-stat-grid">
            <div className="delivery-stat-card">
              <span className="stat-icon">
                🗺️
              </span>

              <div>
                <small>Distance</small>
                <strong>
                  {distance.toFixed(1)} km
                </strong>
              </div>
            </div>

            <div className="delivery-stat-card">
              <span className="stat-icon">
                🛵
              </span>

              <div>
                <small>Delivery charge</small>
                <strong>
                  {money(deliveryCharge)}
                </strong>
              </div>
            </div>
          </div>


          {/* AVAILABILITY */}
          <div
            className={`delivery-status ${
              deliveryAvailable
                ? "available"
                : "unavailable"
            }`}
          >
            <span className="delivery-status-icon">
              {deliveryAvailable
                ? "✓"
                : "!"}
            </span>

            <div>
              <strong>
                {deliveryAvailable
                  ? "Delivery available"
                  : "Delivery unavailable"}
              </strong>

              <span>
                {deliveryAvailable
                  ? "We can deliver to this location"
                  : `We deliver within ${MAX_DELIVERY_DISTANCE} km`}
              </span>
            </div>
          </div>
        </section>
      )}


      {/* TAKEAWAY */}
      {orderType === "Takeaway" && (
        <section className="checkout-card takeaway-info-card">
          <div className="section-heading">
            <div className="section-icon">
              🛍️
            </div>

            <div>
              <span className="section-label">
                TAKEAWAY
              </span>

              <h3>Pick Up From Cafe</h3>

              <p>
                Your order will be prepared for pickup at Sugar Cafe.
              </p>
            </div>
          </div>

          <div className="takeaway-box">
            <span>🏪</span>

            <div>
              <strong>Sugar Cafe</strong>
              <p>
                Please collect your order from the cafe when it is ready.
              </p>
            </div>
          </div>
        </section>
      )}


      {/* SPECIAL NOTE */}
      <section className="checkout-card">
        <div className="section-heading">
          <div className="section-icon">
            📝
          </div>

          <div>
            <span className="section-label">
              OPTIONAL
            </span>

            <h3>Special Note</h3>

            <p>
              Any special request for your order?
            </p>
          </div>

          <span className="optional-badge">
            OPTIONAL
          </span>
        </div>

        <div className="special-note-wrapper">
          <textarea
            value={specialNote}
            onChange={(e) =>
              setSpecialNote(
                e.target.value.slice(
                  0,
                  300
                )
              )
            }
            maxLength={300}
            placeholder="Example: Less spicy, no onion, extra cheese, birthday message..."
            rows={5}
          />

          <span className="note-pencil">
            ✎
          </span>
        </div>

        <div className="note-footer">
          <span>
            Your request will be shared with the café.
          </span>

          <span>
            {specialNote.length}/300
          </span>
        </div>
      </section>


      {/* DAILY SCRATCH */}
      <section className="checkout-card scratch-card">
        <div className="scratch-heading">
          <div className="scratch-gift-icon">
            🎁
          </div>

          <div>
            <span className="section-label">
              DAILY SCRATCH & WIN
            </span>

            <h3>Your Daily Reward</h3>

            <p>
              One order. One surprise. Every day.
            </p>
          </div>
        </div>

        {!dailyScratchEligible ? (
          <div className="scratch-locked">
            <div className="scratch-lock-icon">
              🎁
            </div>

            <strong>
              Unlock your Daily Reward
            </strong>

            <p>
              Add items worth{" "}
              {money(
                DAILY_SCRATCH_MIN_BILL
              )}{" "}
              or more to unlock today's scratch card.
            </p>

            <div className="scratch-progress">
              <span
                style={{
                  width: `${Math.min(
                    100,
                    (Number(totalPrice) /
                      DAILY_SCRATCH_MIN_BILL) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={`scratch-reveal ${
              dailyScratchRevealed
                ? "revealed"
                : ""
            }`}
            onClick={
              revealDailyScratch
            }
            disabled={
              dailyScratchRevealed
            }
          >
            {dailyScratchRevealed &&
            dailyScratchReward ? (
              <>
                <div className="scratch-confetti">
                  ✨ 🎉 ✨
                </div>

                <div className="scratch-reward-gift">
                  🎁
                </div>

                <span className="scratch-won">
                  YOU WON
                </span>

                <strong>
                  {dailyScratchReward.title}
                </strong>

                <small>
                  {dailyScratchReward.type ===
                  "discount"
                    ? "Your discount will be applied to this order."
                    : "Your free reward will be added to this order."}
                </small>
              </>
            ) : (
              <>
                <div className="scratch-question">
                  🎁
                </div>

                <span>
                  TAP TO SCRATCH
                </span>

                <small>
                  Reveal today's surprise
                </small>
              </>
            )}
          </button>
        )}
      </section>


      {/* SUGAR REWARDS */}
      <section className="checkout-card loyalty-card">
        <div className="loyalty-top">
          <div>
            <span className="loyalty-label">
              🎁 SUGAR REWARDS
            </span>

            <div className="loyalty-number">
              {qualifyingOrders}
              <span>/6</span>
            </div>

            <strong>
              qualifying orders
            </strong>
          </div>

          <span className="loyalty-pill">
            {qualifyingOrders >=
            LOYALTY_TARGET
              ? "Reward unlocked"
              : `${
                  LOYALTY_TARGET -
                  qualifyingOrders
                } more to go`}
          </span>
        </div>

        <div className="loyalty-progress">
          <span
            style={{
              width: `${progressPercent}%`,
            }}
          />
        </div>

        <p className="loyalty-note">
          ₹500+ delivered orders count towards your next Scratch Card.
        </p>

        {loyaltyLoading && (
          <small className="loyalty-loading">
            Updating rewards...
          </small>
        )}
      </section>


      {/* PAYMENT */}
      <section className="checkout-card payment-card">
        <div className="section-heading">
          <div className="section-icon">
            💳
          </div>

          <div>
            <span className="section-label">
              SECURE CHECKOUT
            </span>

            <h3>Payment Method</h3>

            <p>
              Choose how you want to pay
            </p>
          </div>
        </div>

        <label
          className={`payment-option ${
            paymentMethod ===
            "Cash on Delivery"
              ? "active"
              : ""
          } ${
            !store.codEnabled
              ? "disabled"
              : ""
          }`}
        >
          <div className="payment-icon">
            💵
          </div>

          <div className="payment-text">
            <strong>
              Cash on Delivery
            </strong>

            <small>
              Pay when your order arrives
            </small>
          </div>

          <input
            type="radio"
            name="payment"
            disabled={!store.codEnabled}
            checked={
              paymentMethod ===
              "Cash on Delivery"
            }
            onChange={() =>
              setPaymentMethod(
                "Cash on Delivery"
              )
            }
          />
        </label>

        <label
          className={`payment-option ${
            paymentMethod ===
            "Online Payment"
              ? "active"
              : ""
          } ${
            !store.upiEnabled
              ? "disabled"
              : ""
          }`}
        >
          <div className="payment-icon">
            💳
          </div>

          <div className="payment-text">
            <strong>
              Online Payment
            </strong>

            <small>
              UPI / Card / Net Banking
            </small>
          </div>

          <input
            type="radio"
            name="payment"
            disabled={!store.upiEnabled}
            checked={
              paymentMethod ===
              "Online Payment"
            }
            onChange={() =>
              setPaymentMethod(
                "Online Payment"
              )
            }
          />
        </label>

        {paymentMethod ===
          "Online Payment" && (
          <div className="upi-payment-box">
            <strong>
              🔒 Secure Online Payment
            </strong>

            <p>
              UPI, cards and net banking are processed securely by Razorpay.
            </p>

            <small>
              No UTR entry or staff payment verification is required.
            </small>
          </div>
        )}
      </section>


      {/* ORDER SUMMARY */}
      <section className="checkout-card summary-card">
        <div className="summary-heading">
          <div className="summary-receipt-icon">
            🧾
          </div>

          <div>
            <span className="section-label">
              YOUR ORDER
            </span>

            <h3>Order Summary</h3>
          </div>
        </div>

        <div className="summary-row">
          <span>Subtotal</span>
          <strong>
            {money(totalPrice)}
          </strong>
        </div>

        <div className="summary-row">
          <span>
            Delivery
            {orderType ===
              "Delivery" &&
              ` (${distance.toFixed(1)} km)`}
          </span>

          <strong>
            {money(deliveryCharge)}
          </strong>
        </div>

        <div className="summary-row">
          <span>GST</span>
          <strong>{money(gst)}</strong>
        </div>

        {scratchDiscount > 0 && (
          <div className="summary-row discount-row">
            <span>
              🎁 Daily Scratch
            </span>

            <strong>
              -{money(scratchDiscount)}
            </strong>
          </div>
        )}

        {rewardFreeItem && (
          <div className="reward-summary">
            🎁 Daily Scratch: FREE{" "}
            {rewardFreeItem}
          </div>
        )}

        <div className="summary-divider" />

        <div className="grand-total">
          <span>Total Amount</span>
          <strong>
            {money(grandTotal)}
          </strong>
        </div>

        <button
          type="button"
          className="place-order-btn"
          onClick={placeOrder}
          disabled={orderDisabled}
        >
          <span>
            {placingOrder
              ? "Placing Order..."
              : orderType === "Takeaway"
              ? "Place Takeaway Order"
              : !store.deliveryAvailable
              ? `Orders available ${
                  store.orderTimingLabel ||
                  ""
                }`
              : !deliveryAvailable
              ? "Delivery Not Available"
              : "Place Order"}
          </span>

          {!placingOrder &&
            store.deliveryAvailable &&
            (orderType === "Takeaway" ||
              deliveryAvailable) && (
              <span className="place-order-total">
                {money(grandTotal)}
              </span>
            )}
        </button>

        <div className="checkout-secure-note">
          🔒 Secure checkout • Your payment information is protected
        </div>
      </section>

    </div>
  );
}
export default Checkout;
