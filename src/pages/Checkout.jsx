import { useState, useRef, useEffect, useCallback } from "react";
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
  Timestamp,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useStoreSettings } from "../context/StoreContext";
import "./Checkout.css";

/* =========================================================
   SUGAR CAFE - CHECKOUT
   FINAL LOCATION PICKER + EXISTING REWARDS/PAYMENT FLOW

   - Leaflet + OpenStreetMap: NO GOOGLE API KEY REQUIRED
   - Fixed center pin / moving map interaction
   - Current GPS location
   - Automatic reverse geocoding via Nominatim
   - Delivery radius/charges from StoreContext
   - COD / Razorpay online payment
   - 6+1 loyalty
   - Daily Scratch & Win
========================================================= */

const LOYALTY_MIN_BILL = 500;
const DAILY_SCRATCH_MIN_BILL = 499;

const LOYALTY_REWARDS = [
  { type: "free_menu_item", itemName: "Classic Cold Coffee", discountPercent: 0 },
  { type: "free_menu_item", itemName: "Cheese Aloo Tikki Burger", discountPercent: 0 },
  { type: "free_menu_item", itemName: "Aloo Cheese Puff", discountPercent: 0 },
  { type: "free_menu_item", itemName: "Paneer Cheese Sandwich", discountPercent: 0 },
  { type: "free_menu_item", itemName: "Diet Coke", discountPercent: 0 },
  { type: "free_menu_item", itemName: "Salted French Fries", discountPercent: 0 },
  { type: "free_menu_item", itemName: "Hot Chocolate Brownie", discountPercent: 0 },
  { type: "free_menu_item", itemName: "Hot Chocolava", discountPercent: 0 },
];

const DAILY_SCRATCH_REWARDS = [
  { type: "discount", discountPercent: 5, title: "5% OFF" },
  { type: "free_menu_item", itemName: "Cheese Aloo Puff", title: "FREE Cheese Aloo Puff" },
  { type: "free_menu_item", itemName: "Veg Aloo Tikka Burger", title: "FREE Veg Aloo Tikka Burger" },
  { type: "free_menu_item", itemName: "French Fries", title: "FREE French Fries" },
];

const TAKEAWAY_STORE = {
  name: "Sugar Crown – NTPC",
  address: "NTPC Gate, Sada Colony, Jamnipali, Korba, Chhattisgarh – 495450",
  lat: 22.417212,
  lng: 82.665984,
};

const SHOP_LOCATION = {
  lat: 22.417212,
  lng: 82.665984,
};

/* =========================================================
   HELPERS
========================================================= */

function loyaltyTime(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeMenuName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatAddressFallback(lat, lng) {
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

/* =========================================================
   LOCATION PIN
========================================================= */

const locationIcon = L.divIcon({
  className: "sugar-fixed-pin-marker",
  html: `
    <div class="sugar-pin">
      <div class="sugar-pin-dot"></div>
    </div>
  `,
  iconSize: [46, 58],
  iconAnchor: [23, 58],
});

/* =========================================================
   MAP EVENTS
   Map moves; center becomes the selected location.
========================================================= */

function LocationMapEvents({ onMoveEnd }) {
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
   DAILY SCRATCH CARD
========================================================= */

function DailyScratchCard({ disabled = false, onReveal }) {
  const canvasRef = useRef(null);
  const scratchingRef = useRef(false);
  const revealedRef = useRef(false);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = 640;
    const height = 320;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#f4f4f4");
    gradient.addColorStop(0.5, "#cfcfcf");
    gradient.addColorStop(1, "#eeeeee");

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(0,0,0,.10)";
    ctx.lineWidth = 2;

    for (let x = -height; x < width; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();
    }

    ctx.fillStyle = "#333";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 42px Arial";
    ctx.fillText("SCRATCH HERE", width / 2, height / 2 - 15);

    ctx.font = "600 23px Arial";
    ctx.fillStyle = "#666";
    ctx.fillText("✨ Reveal your reward ✨", width / 2, height / 2 + 35);
  }, []);

  useEffect(() => {
    if (!disabled) {
      revealedRef.current = false;
      prepareCanvas();
    }
    return () => {
      scratchingRef.current = false;
    };
  }, [disabled, prepareCanvas]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const revealCard = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (typeof onReveal === "function") onReveal();
  };

  const checkScratchPercentage = () => {
    if (revealedRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let transparent = 0;
      let total = 0;

      for (let y = 0; y < canvas.height; y += 10) {
        for (let x = 0; x < canvas.width; x += 10) {
          const index = (y * canvas.width + x) * 4;
          total++;
          if (imageData.data[index + 3] < 80) transparent++;
        }
      }

      if (total > 0 && (transparent / total) * 100 >= 45) {
        revealCard();
      }
    } catch (error) {
      console.error("Scratch percentage error:", error);
    }
  };

  const scratchAt = (event) => {
    if (disabled || revealedRef.current) return;

    const canvas = canvasRef.current;
    const point = getPoint(event);
    const ctx = canvas?.getContext("2d");

    if (!canvas || !point || !ctx) return;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 34, 0, Math.PI * 2);
    ctx.fill();

    checkScratchPercentage();
  };

  const handlePointerDown = (event) => {
    if (disabled) return;
    scratchingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    scratchAt(event);
  };

  const handlePointerMove = (event) => {
    if (!scratchingRef.current || disabled) return;
    scratchAt(event);
  };

  const handlePointerUp = (event) => {
    scratchingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
  };

  return (
    <div className="daily-scratch-wrap">
      <div className="daily-scratch-underlay">
        <div className="daily-scratch-gift">🎁</div>
        <strong>Your Daily Reward</strong>
        <span>Scratch the card to reveal</span>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="daily-scratch-canvas"
      />
    </div>
  );
}

/* =========================================================
   CHECKOUT
========================================================= */

function Checkout() {
  const navigate = useNavigate();
  const rawStore = useStoreSettings();
  const store = rawStore || {};

  const {
    cart,
    totalPrice,
    clearCart,
  } = useCart();

  const maxDeliveryDistanceKm = Number(
    store.maxDeliveryDistanceKm ?? 10
  );
  const deliveryPerKm = Number(store.deliveryPerKm ?? 20);
  const minDeliveryCharge = Number(store.minDeliveryCharge ?? 20);
  const maxDeliveryCharge = Number(store.maxDeliveryCharge ?? 300);
  const deliveryAvailableSetting = store.deliveryAvailable ?? true;
  const upiEnabled = store.upiEnabled ?? false;
  const codEnabled = store.codEnabled ?? true;
  const cafeName = store.cafeName || "Sugar Cafe";
  const preparationMinutes = Number(store.preparationMinutes ?? 15);
  const orderTimingLabel = store.orderTimingLabel || "during store hours";
  const announcement = store.announcement || "";

  const [orderType, setOrderType] = useState(
    () => localStorage.getItem("sugarCafeOrderType") || "Delivery"
  );
  const isTakeaway = orderType === "Takeaway";

  const [address, setAddress] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [specialNote, setSpecialNote] = useState("");
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [paymentMethod, setPaymentMethod] = useState(() => {
    if (rawStore?.codEnabled !== false) return "Cash on Delivery";
    if (rawStore?.upiEnabled === true) return "Online Payment";
    return "Cash on Delivery";
  });

  const [loyaltyData, setLoyaltyData] = useState({
    loading: true,
    qualifyingOrders: 0,
    pendingReward: null,
    currentReward: null,
  });

  const [dailyScratch, setDailyScratch] = useState({
    loading: true,
    eligible: false,
    unlocked: false,
    revealed: false,
    reward: null,
    rewardIndex: null,
    previousCount: 0,
  });

  const [dailyScratchRevealing, setDailyScratchRevealing] = useState(false);

  const [mapCenter, setMapCenter] = useState(SHOP_LOCATION);
  const [marker, setMarker] = useState(SHOP_LOCATION);
  const mapRef = useRef(null);
  const mapMoveAddressRequestRef = useRef(0);

  /* =======================================================
     CUSTOMER + SAVED LOCATION
  ======================================================= */

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("sugarCafeUser");

      if (savedUser) {
        const data = JSON.parse(savedUser);
        const profile = {
          ...data,
          customerId:
            data.customerId ||
            localStorage.getItem("sugarCafeCustomerId") ||
            "",
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || "",
          photoURL: data.photoURL || "",
          addresses: Array.isArray(data.addresses) ? data.addresses : [],
          guest: false,
          loggedIn: true,
        };

        setCustomerProfile(profile);
        setSavedAddresses(profile.addresses || []);
      }

      const savedLocation = localStorage.getItem("userLocation");
      if (savedLocation) {
        const loc = JSON.parse(savedLocation);
        const lat = Number(loc.latitude);
        const lng = Number(loc.longitude);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const saved = { lat, lng };
          setMarker(saved);
          setMapCenter(saved);

          if (loc.fullAddress || loc.address) {
            setAddress(loc.fullAddress || loc.address);
            setLocationConfirmed(true);
          }
        }
      }
    } catch (error) {
      console.error("Customer checkout loading error:", error);
    }
  }, []);

  /* =======================================================
     REVERSE GEOCODING
  ======================================================= */

  const reverseGeocode = useCallback(
    async (latitude, longitude) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=en`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Address lookup failed");
        }

        const data = await response.json();

        return (
          data.display_name ||
          formatAddressFallback(latitude, longitude)
        );
      } catch (error) {
        console.error(
          "Reverse geocoding error:",
          error
        );

        return formatAddressFallback(
          latitude,
          longitude
        );
      }
    },
    []
  );

/* =======================================================
   AUTO DETECT CURRENT LOCATION ON CHECKOUT LOAD
======================================================= */

useEffect(() => {
  // Takeaway mein location ki zarurat nahi
  if (isTakeaway) return;

  // Browser/device GPS available nahi hai
  if (!navigator.geolocation) return;

  // Agar already saved location hai, usko use karein
  // aur unnecessarily GPS popup dobara na dikhayein.
  try {
    const savedLocation =
      localStorage.getItem("userLocation");

    if (savedLocation) {
      const loc = JSON.parse(savedLocation);

      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        return;
      }
    }
  } catch (error) {
    console.warn(
      "Saved location check failed:",
      error
    );
  }

  let cancelled = false;

  const detectLocation = () => {
    if (cancelled) return;

    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;

        try {
          const latitude =
            position.coords.latitude;

          const longitude =
            position.coords.longitude;

          const newLocation = {
            lat: latitude,
            lng: longitude,
          };

          setMarker(newLocation);
          setMapCenter(newLocation);

          // Map ko current location par move karo
          if (mapRef.current) {
            mapRef.current.setView(
              [latitude, longitude],
              17,
              {
                animate: true,
              }
            );
          }

          let detectedAddress = "";

          try {
            detectedAddress =
              await reverseGeocode(
                latitude,
                longitude
              );
          } catch (addressError) {
            console.warn(
              "Auto reverse geocoding failed:",
              addressError
            );

            detectedAddress =
              formatAddressFallback(
                latitude,
                longitude
              );
          }

          if (cancelled) return;

          setAddress(
            detectedAddress
          );

          setLocationConfirmed(false);

          try {
            localStorage.setItem(
              "userLocation",
              JSON.stringify({
                latitude,
                longitude,
                address:
                  detectedAddress,
                fullAddress:
                  detectedAddress,
                savedAt:
                  new Date().toISOString(),
              })
            );
          } catch (storageError) {
            console.warn(
              "Location save failed:",
              storageError
            );
          }
        } catch (error) {
          console.error(
            "Auto location processing error:",
            error
          );
        } finally {
          if (!cancelled) {
            setLoadingLocation(false);
          }
        }
      },

      (error) => {
        if (cancelled) return;

        console.warn(
          "Automatic location permission/status:",
          error
        );

        setLoadingLocation(false);

        /*
          IMPORTANT:
          Auto detection fail hone par alert nahi dikhayenge.
          User manually "Use My Current Location" press kar
          sakta hai.

          Isse checkout page unnecessarily block nahi hoga.
        */
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  };

  /*
    Thoda delay rakha hai taaki checkout page pehle render ho
    aur browser location permission popup properly dikha sake.
  */
  const timer = setTimeout(
    detectLocation,
    500
  );

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, [
  isTakeaway,
  reverseGeocode,
]);
  /* =======================================================
     LOYALTY
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadLoyaltyStatus = async () => {
      const customerId =
        customerProfile?.customerId ||
        localStorage.getItem("sugarCafeCustomerId");

      if (!customerId) {
        if (!cancelled) {
          setLoyaltyData({
            loading: false,
            qualifyingOrders: 0,
            pendingReward: null,
            currentReward: null,
          });
        }
        return;
      }

      try {
        const ordersQuery = query(
          collection(db, "orders"),
          where("customerId", "==", customerId)
        );
        const snapshot = await getDocs(ordersQuery);
        if (cancelled) return;

        const customerOrders = snapshot.docs
          .map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() }))
          .sort(
            (a, b) =>
              loyaltyTime(a.createdAt) - loyaltyTime(b.createdAt)
          );

        const qualifyingOrders = customerOrders.filter((order) => {
          const status = String(order.status || "").toLowerCase();
          const bill = Number(order.subtotal ?? order.total ?? 0);
          return status === "delivered" && bill >= LOYALTY_MIN_BILL;
        });

        const rewardOrders = customerOrders.filter((order) => {
          const cycle = Number(order.loyaltyReward?.cycle);
          return Number.isFinite(cycle) && cycle > 0;
        });

        const maxCompletedCycle =
          rewardOrders.length > 0
            ? Math.max(
                ...rewardOrders.map((order) =>
                  Number(order.loyaltyReward.cycle)
                )
              )
            : 0;

        const alreadyAppliedSourceIds = new Set(
          customerOrders
            .map((order) => order.loyaltyReward?.sourceOrderId)
            .filter(Boolean)
        );

        const activeRewardOrders = customerOrders
          .filter((order) => {
            const reward = order.loyaltyReward;
            if (!reward) return false;
            if (
              reward.status !== "scratch_pending" &&
              reward.status !== "available"
            ) {
              return false;
            }
            return !alreadyAppliedSourceIds.has(order.id);
          })
          .sort(
            (a, b) =>
              loyaltyTime(
                b.loyaltyReward?.createdAt || b.createdAt
              ) -
              loyaltyTime(
                a.loyaltyReward?.createdAt || a.createdAt
              )
          );

        const pendingRewardOrder = activeRewardOrders[0] || null;
        const nextCycle = maxCompletedCycle + 1;
        const requiredOrders = maxCompletedCycle * 6 + 6;

        let currentReward = null;

        if (
          qualifyingOrders.length >= requiredOrders &&
          !pendingRewardOrder
        ) {
          const rewardIndex =
            (nextCycle - 1) % LOYALTY_REWARDS.length;
          const reward = LOYALTY_REWARDS[rewardIndex];

          currentReward = {
            cycle: nextCycle,
            rewardIndex,
            type: reward.type,
            itemName: reward.itemName || null,
            discountPercent: Number(reward.discountPercent || 0),
            scratchCardReady: true,
          };
        }

        const progress = Math.max(
          0,
          Math.min(
            qualifyingOrders.length - maxCompletedCycle * 6,
            6
          )
        );

        if (!cancelled) {
          setLoyaltyData({
            loading: false,
            qualifyingOrders: progress,
            pendingReward: pendingRewardOrder,
            currentReward,
          });
        }
      } catch (error) {
        console.error("Loyalty status error:", error);
        if (!cancelled) {
          setLoyaltyData({
            loading: false,
            qualifyingOrders: 0,
            pendingReward: null,
            currentReward: null,
          });
        }
      }
    };

    loadLoyaltyStatus();
    return () => {
      cancelled = true;
    };
  }, [customerProfile?.customerId]);

  /* =======================================================
     DAILY SCRATCH
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadDailyScratchStatus = async () => {
      const customerId =
        customerProfile?.customerId ||
        localStorage.getItem("sugarCafeCustomerId");

      if (!customerId) {
        if (!cancelled) {
          setDailyScratch({
            loading: false,
            eligible: Number(totalPrice) >= DAILY_SCRATCH_MIN_BILL,
            unlocked: false,
            revealed: false,
            reward: null,
            rewardIndex: null,
            previousCount: 0,
          });
        }
        return;
      }

      try {
        const ordersQuery = query(
          collection(db, "orders"),
          where("customerId", "==", customerId)
        );
        const snapshot = await getDocs(ordersQuery);
        if (cancelled) return;

        const scratchOrders = snapshot.docs
          .map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() }))
                  .filter(
            (order) =>
              order.dailyScratchReward?.enabled === true
          )
          .sort(
            (a, b) =>
              loyaltyTime(
                a.dailyScratchReward?.createdAt || a.createdAt
              ) -
              loyaltyTime(
                b.dailyScratchReward?.createdAt || b.createdAt
              )
          );

        const previousCount = scratchOrders.length;
        const rewardIndex =
          previousCount % DAILY_SCRATCH_REWARDS.length;
        const reward = DAILY_SCRATCH_REWARDS[rewardIndex];

        let restored = null;

        try {
          const stored = sessionStorage.getItem(
            `sugarCafeDailyScratch_${customerId}`
          );
          if (stored) {
            const parsed = JSON.parse(stored);
            if (
              parsed &&
              Number(parsed.rewardIndex) === rewardIndex
            ) {
              restored = parsed;
            }
          }
        } catch (storageError) {
          console.warn("Daily scratch restore error:", storageError);
        }

        if (!cancelled) {
          setDailyScratch({
            loading: false,
            eligible: Number(totalPrice) >= DAILY_SCRATCH_MIN_BILL,
            unlocked: restored?.unlocked || false,
            revealed: restored?.revealed || false,
            reward: restored?.reward || reward,
            rewardIndex,
            previousCount,
          });
        }
      } catch (error) {
        console.error("Daily Scratch status error:", error);
        if (!cancelled) {
          setDailyScratch({
            loading: false,
            eligible: Number(totalPrice) >= DAILY_SCRATCH_MIN_BILL,
            unlocked: false,
            revealed: false,
            reward: null,
            rewardIndex: null,
            previousCount: 0,
          });
        }
      }
    };

    loadDailyScratchStatus();
    return () => {
      cancelled = true;
    };
  }, [customerProfile?.customerId, totalPrice]);

  useEffect(() => {
    const eligible =
      Number(totalPrice) >= DAILY_SCRATCH_MIN_BILL;

    setDailyScratch((prev) => {
      if (prev.eligible === eligible) return prev;
      if (!eligible) {
        return {
          ...prev,
          eligible: false,
          unlocked: false,
          revealed: false,
        };
      }
      return { ...prev, eligible: true };
    });
  }, [totalPrice]);

  const unlockDailyScratch = () => {
    if (Number(totalPrice) < DAILY_SCRATCH_MIN_BILL) return;

    const reward =
      dailyScratch.reward ||
      DAILY_SCRATCH_REWARDS[
        Number.isFinite(dailyScratch.rewardIndex)
          ? dailyScratch.rewardIndex
          : 0
      ];

    const rewardIndex = Number.isFinite(dailyScratch.rewardIndex)
      ? dailyScratch.rewardIndex
      : 0;

    const state = {
      unlocked: true,
      revealed: false,
      reward,
      rewardIndex,
    };

    try {
      const customerId =
        customerProfile?.customerId ||
        localStorage.getItem("sugarCafeCustomerId") ||
        "guest";

      sessionStorage.setItem(
        `sugarCafeDailyScratch_${customerId}`,
        JSON.stringify(state)
      );
    } catch {}

    setDailyScratch((prev) => ({
      ...prev,
      eligible: true,
      unlocked: true,
      revealed: false,
      reward,
      rewardIndex,
    }));
  };

  const revealDailyScratch = async () => {
    if (
      !dailyScratch.unlocked ||
      dailyScratch.revealed ||
      dailyScratchRevealing ||
      !dailyScratch.reward
    ) {
      return;
    }

    setDailyScratchRevealing(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const state = {
      unlocked: true,
      revealed: true,
      reward: dailyScratch.reward,
      rewardIndex: dailyScratch.rewardIndex,
    };

    try {
      const customerId =
        customerProfile?.customerId ||
        localStorage.getItem("sugarCafeCustomerId") ||
        "guest";

      sessionStorage.setItem(
        `sugarCafeDailyScratch_${customerId}`,
        JSON.stringify(state)
      );
    } catch {}

    setDailyScratch((prev) => ({
      ...prev,
      revealed: true,
    }));

    setDailyScratchRevealing(false);
  };

  /* =======================================================
     DISTANCE / DELIVERY
  ======================================================= */

  const distance = calculateDistance(
    SHOP_LOCATION.lat,
    SHOP_LOCATION.lng,
    marker.lat,
    marker.lng
  );

  const deliveryAvailable =
    distance <= maxDeliveryDistanceKm;

  let deliveryCharge = 0;

  if (
    !isTakeaway &&
    Number(totalPrice) > 0 &&
    deliveryAvailable
  ) {
    deliveryCharge =
      Math.ceil(distance) * deliveryPerKm;

    if (deliveryCharge < minDeliveryCharge) {
      deliveryCharge = minDeliveryCharge;
    }

    if (deliveryCharge > maxDeliveryCharge) {
      deliveryCharge = maxDeliveryCharge;
    }
  }

  /* =======================================================
     REWARDS
  ======================================================= */

  const currentReward = loyaltyData.currentReward || null;
  const pendingReward = loyaltyData.pendingReward?.loyaltyReward || null;
  const pendingRewardStatus = pendingReward?.status || "";

  const rewardAvailable =
    Boolean(
      pendingReward &&
      pendingRewardStatus === "available"
    );

  let discount = 0;

  if (
    rewardAvailable &&
    pendingReward.type === "discount" &&
    Number(pendingReward.discountPercent) === 5
  ) {
    discount += Number(totalPrice) * 0.05;
  }

  if (
    dailyScratch.revealed &&
    dailyScratch.reward?.type === "discount" &&
    Number(dailyScratch.reward.discountPercent) === 5
  ) {
    discount += Number(totalPrice) * 0.05;
  }

  discount = Math.round(discount * 100) / 100;
  const gst = 0;

  const grandTotal =
  Number(totalPrice) +
  Number(deliveryCharge) -
  Number(discount) +
  Number(gst);

/* =======================================================
   MAP MOVE -> ADDRESS
======================================================= */

  const handleMapMoveEnd = useCallback(
    async (location) => {
      setMarker(location);
      setMapCenter(location);
      setLocationConfirmed(false);

      const requestId = ++mapMoveAddressRequestRef.current;

      try {
        const detectedAddress = await reverseGeocode(
          location.lat,
          location.lng
        );

        if (
          requestId !== mapMoveAddressRequestRef.current
        ) {
          return;
        }

        setAddress(detectedAddress);

        try {
          localStorage.setItem(
            "userLocation",
            JSON.stringify({
              latitude: location.lat,
              longitude: location.lng,
              address: detectedAddress,
              fullAddress: detectedAddress,
              savedAt: new Date().toISOString(),
            })
          );
        } catch {}
      } catch (error) {
        console.error("Map reverse geocoding error:", error);

        if (
          requestId === mapMoveAddressRequestRef.current
        ) {
          setAddress(
            formatAddressFallback(
              location.lat,
              location.lng
            )
          );
        }
      }
    },
    [reverseGeocode]
  );

  /* =======================================================
     CURRENT LOCATION
  ======================================================= */

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Your browser does not support location.");
      return;
    }

    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const newLocation = {
            lat: latitude,
            lng: longitude,
          };

          setMarker(newLocation);
          setMapCenter(newLocation);
          setLocationConfirmed(false);

          if (mapRef.current) {
            mapRef.current.setView(
              [latitude, longitude],
              17,
              { animate: true }
            );
          }

          const detectedAddress = await reverseGeocode(
            latitude,
            longitude
          );

          setAddress(detectedAddress);

          try {
            localStorage.setItem(
              "userLocation",
              JSON.stringify({
                latitude,
                longitude,
                address: detectedAddress,
                fullAddress: detectedAddress,
                savedAt: new Date().toISOString(),
              })
            );
          } catch {}
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
        console.error("Location Error:", error);
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
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  /* =======================================================
     MAP CREATED
  ======================================================= */

  const onMapCreated = (map) => {
    mapRef.current = map;
  };

  /* =======================================================
     CONFIRM LOCATION
  ======================================================= */

  const confirmDeliveryLocation = () => {
    if (!address.trim()) {
      alert("Please wait until your delivery address is detected.");
      return;
    }

    if (!deliveryAvailable) {
      alert(
        `Sorry! We currently deliver within ${maxDeliveryDistanceKm} km of our shop.`
      );
      return;
    }

    setLocationConfirmed(true);

    try {
      localStorage.setItem(
        "userLocation",
        JSON.stringify({
          latitude: marker.lat,
          longitude: marker.lng,
          address: address.trim(),
          fullAddress: address.trim(),
          savedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error("Location save error:", error);
    }
  };

  /* =======================================================
     SELECT SAVED ADDRESS
  ======================================================= */

  const selectSavedAddress = (saved) => {
    const lat = Number(saved.latitude);
    const lng = Number(saved.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const savedAddressText =
      saved.fullAddress ||
      saved.address ||
      "";

    const selected = { lat, lng };

    setMarker(selected);
    setMapCenter(selected);
    setAddress(savedAddressText);
    setLocationConfirmed(true);

    if (mapRef.current) {
      mapRef.current.setView(
        [lat, lng],
        17,
        { animate: true }
      );
    }

    try {
      localStorage.setItem(
        "userLocation",
        JSON.stringify(saved)
      );
    } catch {}
  };

  /* =======================================================
     CUSTOMER DATA
  ======================================================= */

  const getCustomerData = () => {
    if (!customerProfile) return null;

    return {
      userId: customerProfile.uid || "",
      customerId:
        customerProfile.customerId ||
        localStorage.getItem("sugarCafeCustomerId") ||
        "",
      customerName: customerProfile.name || "Customer",
      customerPhone: customerProfile.phone || "",
      customerEmail: customerProfile.email || "",
      photoURL: customerProfile.photoURL || "",
    };
  };

  /* =======================================================
     MENU LOOKUP
  ======================================================= */

  const findLoyaltyMenuItem = async (rewardName) => {
    if (!rewardName) return null;

    try {
      const menuSnapshot = await getDocs(collection(db, "menu"));

      const menuItems = menuSnapshot.docs.map((menuDoc) => ({
        id: menuDoc.id,
        ...menuDoc.data(),
      }));

      const wanted = normalizeMenuName(rewardName);

      return (
        menuItems.find((item) => {
          const menuName =
            item.name ||
            item.title ||
            "";

          return normalizeMenuName(menuName) === wanted;
        }) || null
      );
    } catch (error) {
      console.error("Menu lookup error:", error);
      return null;
    }
  };

  /* =======================================================
     RAZORPAY
  ======================================================= */

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

  /* =======================================================
     SAVE CUSTOMER ADDRESS
  ======================================================= */

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

    try {
      const savedUser = localStorage.getItem("sugarCafeUser");

      if (savedUser) {
        const profile = JSON.parse(savedUser);

        const customerId =
          profile.customerId ||
          localStorage.getItem("sugarCafeCustomerId") ||
          "";

        const existingAddresses = Array.isArray(profile.addresses)
          ? profile.addresses
          : [];
                const alreadyExists = existingAddresses.some(
          (item) =>
            String(item.address || "").trim() ===
              selectedAddress.address &&
            Number(item.latitude) === selectedAddress.latitude &&
            Number(item.longitude) === selectedAddress.longitude
        );

        const updatedAddresses = alreadyExists
          ? existingAddresses
          : [...existingAddresses, selectedAddress];

        const updatedProfile = {
          ...profile,
          customerId,
          addresses: updatedAddresses,
          defaultAddress: selectedAddress,
          guest: false,
          loggedIn: true,
        };

        localStorage.setItem(
          "sugarCafeUser",
          JSON.stringify(updatedProfile)
        );
        localStorage.setItem(
          "sugarCafeCustomerId",
          customerId
        );

        setCustomerProfile(updatedProfile);
        setSavedAddresses(updatedAddresses);

        if (customerId) {
          try {
            const customerQuery = query(
              collection(db, "customers"),
              where("customerId", "==", customerId)
            );

            const customerSnapshot =
              await getDocs(customerQuery);

            if (!customerSnapshot.empty) {
              await updateDoc(
                doc(
                  db,
                  "customers",
                  customerSnapshot.docs[0].id
                ),
                {
                  addresses: updatedAddresses,
                  defaultAddress: selectedAddress,
                  updatedAt: Timestamp.now(),
                }
              );
            }
          } catch (firebaseError) {
            console.error(
              "Firebase address update error:",
              firebaseError
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "Customer address save error:",
        error
      );
    }

    return selectedAddress;
  };

  /* =======================================================
     SAVE ORDER
  ======================================================= */

  const saveCompletedOrder = async (
    orderData,
    selectedAddress
  ) => {
    const orderRef = await addDoc(
      collection(db, "orders"),
      orderData
    );

    if (orderData.loyaltyReward?.sourceOrderId) {
      try {
        await updateDoc(
          doc(
            db,
            "orders",
            orderData.loyaltyReward.sourceOrderId
          ),
          {
            "loyaltyReward.status": "applied",
            "loyaltyReward.appliedOrderId": orderRef.id,
            "loyaltyReward.appliedAt": Timestamp.now(),
          }
        );
      } catch (error) {
        console.error(
          "Source loyalty reward update error:",
          error
        );
      }
    }

    try {
      const customerId =
        orderData.customerId ||
        localStorage.getItem("sugarCafeCustomerId") ||
        "guest";

      sessionStorage.removeItem(
        `sugarCafeDailyScratch_${customerId}`
      );
    } catch {}

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

    const savedUser =
      localStorage.getItem("sugarCafeUser");

    if (savedUser) {
      try {
        const profile = JSON.parse(savedUser);

        const customerId =
          profile.customerId ||
          orderData.customerId ||
          localStorage.getItem("sugarCafeCustomerId") ||
          "";

        const existingAddresses =
          Array.isArray(profile.addresses)
            ? profile.addresses
            : [];

        const alreadyExists =
          existingAddresses.some(
            (item) =>
              String(item.address || "").trim() ===
                String(selectedAddress.address || "").trim() &&
              Number(item.latitude) ===
                Number(selectedAddress.latitude) &&
              Number(item.longitude) ===
                Number(selectedAddress.longitude)
          );

        const updatedAddresses = alreadyExists
          ? existingAddresses
          : [...existingAddresses, selectedAddress];

        const updatedProfile = {
          ...profile,
          customerId,
          addresses: updatedAddresses,
          defaultAddress: selectedAddress,
          guest: false,
          loggedIn: true,
        };

        localStorage.setItem(
          "sugarCafeUser",
          JSON.stringify(updatedProfile)
        );
        localStorage.setItem(
          "sugarCafeCustomerId",
          customerId
        );

        setCustomerProfile(updatedProfile);
        setSavedAddresses(updatedAddresses);
      } catch (error) {
        console.error(
          "Customer profile update error:",
          error
        );
      }
    }

    clearCart();
    return orderRef;
  };

  /* =======================================================
     API RESPONSE
  ======================================================= */

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

  /* =======================================================
     ONLINE PAYMENT
  ======================================================= */

  const startOnlinePayment = async ({
    customer,
    orderData,
    selectedAddress,
  }) => {
    const paymentBaseUrl = (
      import.meta.env.VITE_PAYMENT_API_URL || ""
    ).replace(/\/$/, "");

    const gatewayResponse = await fetch(
      `${paymentBaseUrl}/api/payment/create-order`,
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
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const success = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const razorpay = new window.Razorpay({
        key: gatewayData.keyId,
        amount: gatewayData.amount,
        currency: gatewayData.currency,
        name: cafeName,
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
            const verifyResponse = await fetch(
              `${paymentBaseUrl}/api/payment/verify`,
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
              fail(
                new Error(
                  "Payment verification failed."
                )
              );
              return;
            }

            if (!verifyData.finalized) {
              const paidOrder = {
                ...orderData,
                paymentMethod: "Online Payment",
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

            success();
          } catch (error) {
            fail(error);
          }
        },

        modal: {
          ondismiss: () => {
            fail(
              new Error(
                "Payment cancelled."
              )
            );
          },
        },
      });

      razorpay.on(
        "payment.failed",
        (response) => {
          fail(
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

  /* =======================================================
     PLACE ORDER
  ======================================================= */

  const placeOrder = async () => {
    if (loyaltyData.loading) {
      alert(
        "Please wait a moment while we check your Sugar Rewards."
      );
      return;
    }

    if (
      !isTakeaway &&
      !deliveryAvailableSetting
    ) {
      alert(
        announcement ||
        `Delivery orders are available only ${orderTimingLabel}.`
      );
      return;
    }

    if (
      paymentMethod === "Online Payment" &&
      !upiEnabled
    ) {
      alert(
        "Online payment is currently unavailable. Please choose another payment method."
      );
      return;
    }

    if (
      paymentMethod === "Cash on Delivery" &&
      !codEnabled
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
        "Please login with your customer account before placing the order."
      );
      navigate("/login", {
        state: { from: "/checkout" },
      });
      return;
    }

    const customer = getCustomerData();

    if (!customer?.customerPhone) {
      alert(
        "Mobile number is required to place the order."
      );
      return;
    }

    if (!customer?.customerId) {
      alert(
        "Customer account is not ready. Please login again."
      );
      navigate("/login", {
        state: { from: "/checkout" },
      });
      return;
    }

    if (!isTakeaway) {
      if (!locationConfirmed) {
        alert(
          "Please confirm your delivery location first."
        );
        return;
      }

      if (!address.trim()) {
        alert(
          "Please select your delivery address."
        );
        return;
      }

      if (!deliveryAvailable) {
        alert(
          `Sorry! We currently deliver within ${maxDeliveryDistanceKm} km of our shop.`
        );
        return;
      }
    }

    if (
      Number(totalPrice) >=
      DAILY_SCRATCH_MIN_BILL
    ) {
      if (!dailyScratch.unlocked) {
        alert(
          "🎁 Your bill is eligible for Daily Scratch & Win. Please select a payment method and scratch your card before placing the order."
        );
        return;
      }

      if (!dailyScratch.revealed) {
        alert(
          "🎁 Please scratch your Daily Scratch Card to reveal your reward before placing the order."
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
        qty: Number(
          item.qty ||
          item.quantity ||
          1
        ),
        image: item.image || "",
        category: item.category || "",
      }));

      let finalOrderItems = [...orderItems];
      let orderLoyaltyReward = null;
      let orderDailyScratchReward = null;

      /* Existing loyalty reward */
      if (
        pendingReward &&
        pendingReward.status === "available"
      ) {
        const reward = pendingReward;
        const sourceOrderId =
          loyaltyData.pendingReward?.id ||
          null;

        if (!sourceOrderId) {
          throw new Error(
            "Loyalty reward source order could not be identified."
          );
        }

        orderLoyaltyReward = {
          ...reward,
          sourceOrderId,
          status: "applied",
          appliedAt: Timestamp.now(),
        };

        if (
          reward.type === "discount" &&
          Number(reward.discountPercent) === 5
        ) {
          orderLoyaltyReward.appliedDiscount =
            Number(totalPrice) * 0.05;
        }

        if (reward.type === "free_menu_item") {
          let menuItem = null;

          if (
            reward.itemId &&
            reward.itemName
          ) {
            menuItem = {
              id: reward.itemId,
              name: reward.itemName,
              price: Number(
                reward.itemPrice || 0
              ),
              image: reward.itemImage || "",
              category:
                reward.itemCategory ||
                "Loyalty Reward",
            };
          }

          if (!menuItem?.id) {
            menuItem =
              await findLoyaltyMenuItem(
                reward.itemName
              );
          }

          if (!menuItem) {
            throw new Error(
              `Loyalty reward item "${reward.itemName}" is currently unavailable in the menu.`
            );
          }

          const rewardItemName =
            menuItem.name ||
            menuItem.title ||
            reward.itemName;

          const rewardItemImage =
            menuItem.image ||
            menuItem.imageUrl ||
            menuItem.photoURL ||
            reward.itemImage ||
            "";

          const rewardItemPrice =
            Number(
              menuItem.price ||
              reward.itemPrice ||
              0
            );

          finalOrderItems.push({
            id: menuItem.id,
            name: rewardItemName,
            price: 0,
            qty: 1,
            image: rewardItemImage,
            category:
              menuItem.category ||
              reward.itemCategory ||
              "Loyalty Reward",
            isFreeReward: true,
            loyaltyReward: true,
            originalPrice: rewardItemPrice,
          });

          orderLoyaltyReward.itemId =
            menuItem.id;
          orderLoyaltyReward.itemName =
            rewardItemName;
          orderLoyaltyReward.itemImage =
            rewardItemImage;
          orderLoyaltyReward.itemPrice =
            rewardItemPrice;
          orderLoyaltyReward.itemCategory =
            menuItem.category ||
            reward.itemCategory ||
            "Loyalty Reward";
        }
      }

      /* New 6+1 scratch reward */
      if (
        !orderLoyaltyReward &&
        currentReward?.scratchCardReady
      ) {
        const reward = currentReward;

        orderLoyaltyReward = {
          cycle: Number(reward.cycle),
          rewardIndex: Number(reward.rewardIndex),
          type: reward.type,
          itemName: reward.itemName || null,
          discountPercent:
            Number(reward.discountPercent || 0),
          status: "scratch_pending",
          scratchPending: true,
          scratchRevealed: false,
          source: "6+1-loyalty",
          createdAt: Timestamp.now(),
        };

        if (
          reward.type === "free_menu_item"
        ) {
          const menuItem =
            await findLoyaltyMenuItem(
              reward.itemName
            );

          if (!menuItem) {
            throw new Error(
              `Loyalty reward item "${reward.itemName}" was not found in the current menu.`
            );
          }

          orderLoyaltyReward.itemId =
            menuItem.id;
          orderLoyaltyReward.itemName =
            menuItem.name ||
            menuItem.title ||
            reward.itemName;
          orderLoyaltyReward.itemImage =
            menuItem.image ||
            menuItem.imageUrl ||
            menuItem.photoURL ||
            "";
          orderLoyaltyReward.itemPrice =
            Number(menuItem.price || 0);
          orderLoyaltyReward.itemCategory =
            menuItem.category ||
            "Loyalty Reward";
        }
      }

      /* Daily scratch */
      if (
        dailyScratch.eligible &&
        dailyScratch.unlocked &&
        dailyScratch.revealed &&
        dailyScratch.reward
      ) {
        const reward = dailyScratch.reward;
        const rewardIndex =
          Number(dailyScratch.rewardIndex);

        orderDailyScratchReward = {
          enabled: true,
          rewardIndex:
            Number.isFinite(rewardIndex)
              ? rewardIndex
              : 0,
          type: reward.type,
          title: reward.title || "",
          status: "applied",
          scratchRevealed: true,
          discountPercent:
            Number(
              reward.discountPercent || 0
            ),
          createdAt: Timestamp.now(),
        };

        if (
          reward.type === "discount" &&
          Number(reward.discountPercent) === 5
        ) {
          orderDailyScratchReward.appliedDiscount =
            Math.round(
              Number(totalPrice) *
                0.05 *
                100
            ) / 100;
        }

        if (
          reward.type === "free_menu_item"
        ) {
          const menuItem =
            await findLoyaltyMenuItem(
              reward.itemName
            );

          if (!menuItem) {
            throw new Error(
              `Daily Scratch reward "${reward.itemName}" is currently unavailable in the menu.`
            );
          }

          const rewardItemName =
            menuItem.name ||
            menuItem.title ||
            reward.itemName;

          const rewardItemImage =
            menuItem.image ||
            menuItem.imageUrl ||
            menuItem.photoURL ||
            "";

          const rewardItemPrice =
            Number(menuItem.price || 0);

          finalOrderItems.push({
            id: menuItem.id,
            name: rewardItemName,
            price: 0,
            qty: 1,
            image: rewardItemImage,
            category:
              menuItem.category ||
              "Daily Scratch Reward",
            isFreeReward: true,
            dailyScratchReward: true,
            originalPrice:
              rewardItemPrice,
          });

          orderDailyScratchReward.itemId =
            menuItem.id;
          orderDailyScratchReward.itemName =
            rewardItemName;
          orderDailyScratchReward.itemImage =
            rewardItemImage;
          orderDailyScratchReward.itemPrice =
            rewardItemPrice;
          orderDailyScratchReward.itemCategory =
            menuItem.category ||
            "Daily Scratch Reward";
        }
      }
            const orderData = {
        orderNumber: `SC-${Date.now()}`,
        userId: customer.userId || "",
        customerId: customer.customerId,
        customerName: customer.customerName,
        phone: customer.customerPhone,
        email: customer.customerEmail,
        photoURL: customer.photoURL,

        address: isTakeaway
          ? TAKEAWAY_STORE.address
          : address,

        storeName: isTakeaway
          ? TAKEAWAY_STORE.name
          : cafeName,

        storeAddress: isTakeaway
          ? TAKEAWAY_STORE.address
          : "",

        specialNote:
          specialNote.trim(),

        latitude: isTakeaway
          ? TAKEAWAY_STORE.lat
          : marker.lat,

        longitude: isTakeaway
          ? TAKEAWAY_STORE.lng
          : marker.lng,

        distance: isTakeaway
          ? 0
          : Number(distance.toFixed(2)),

        orderType: isTakeaway
          ? "Takeaway"
          : "Delivery",

        paymentMethod,

        paymentStatus:
          paymentMethod ===
          "Online Payment"
            ? "Paid"
            : "Pending",

        paymentNote:
          paymentMethod ===
          "Online Payment"
            ? "Paid and verified by Razorpay."
            : "",

        items: finalOrderItems,

        subtotal: Number(totalPrice),
        deliveryCharge:
          Number(deliveryCharge),
        discount: Number(discount),
        gst: Number(gst),
        total: Number(grandTotal),

        loyaltyReward:
          orderLoyaltyReward,

        dailyScratchReward:
          orderDailyScratchReward,

        status: "New",

        preparationMinutes:
          preparationMinutes,

        preparationStartedAt:
          null,

        preparationEndAt:
          null,

        foodReadyAt: null,
        dispatchedAt: null,
        deliveredAt: null,

        createdAt:
          Timestamp.now(),
      };

      const selectedAddress =
        isTakeaway
          ? {
              id: `takeaway-${Date.now()}`,
              label: "Pickup Store",
              address: TAKEAWAY_STORE.address,
              fullAddress: TAKEAWAY_STORE.address,
              latitude: TAKEAWAY_STORE.lat,
              longitude: TAKEAWAY_STORE.lng,
              savedAt: new Date().toISOString(),
            }
          : await saveCustomerAddress();

      if (
        paymentMethod ===
        "Online Payment"
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
        isTakeaway
          ? "🛍️ Takeaway order received! Sugar Café is preparing your order."
          : "🕐 Order received! Sugar Café is reviewing your order."
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

  /* =======================================================
     PAGE - PREMIUM SUGAR CAFE UI
  ======================================================= */

  return (
    <div className="checkout-page">

      {/* =================================================
          PREMIUM HEADER
      ================================================= */}
      <header className="checkout-header">

        <button
          type="button"
          className="checkout-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ←
        </button>

        <div className="checkout-header-content">
          <span className="checkout-eyebrow">
            SUGAR CAFE
          </span>

          <h1>Checkout</h1>

          <p>
            Almost there! Your delicious food is one step away ✨
          </p>
        </div>

        <div className="secure-badge">
          <span className="secure-icon">✓</span>
          <div>
            <strong>100%</strong>
            <small>Secure</small>
          </div>
        </div>

      </header>

      {/* =================================================
          ORDER TYPE
      ================================================= */}

      <section className="checkout-card order-type-card">

        <div className="section-heading">
          <div className="section-icon orange-icon">
            🛵
          </div>

          <div>
            <span className="section-kicker">
              CHOOSE YOUR OPTION
            </span>

            <h2>Order Type</h2>

            <p>
              How would you like to receive your order?
            </p>
          </div>
        </div>

        <div className="order-type-grid">

          <button
            type="button"
            onClick={() => {
              setOrderType("Delivery");

              localStorage.setItem(
                "sugarCafeOrderType",
                "Delivery"
              );
            }}
            className={
              orderType === "Delivery"
                ? "order-type-btn delivery active"
                : "order-type-btn delivery"
            }
          >

            <span className="order-type-visual">
              🛵
            </span>

            <span className="order-type-text">
              <strong>Delivery</strong>

              <small>
                We deliver to your location
              </small>
            </span>

            <span className="radio-modern">
              {orderType === "Delivery" && "✓"}
            </span>

          </button>

          <button
            type="button"
            onClick={() => {
              setOrderType("Takeaway");

              localStorage.setItem(
                "sugarCafeOrderType",
                "Takeaway"
              );
            }}
            className={
              orderType === "Takeaway"
                ? "order-type-btn takeaway active"
                : "order-type-btn takeaway"
            }
          >

            <span className="order-type-visual">
              🛍️
            </span>

            <span className="order-type-text">
              <strong>Takeaway</strong>

              <small>
                Pick up from our cafe
              </small>
            </span>

            <span className="radio-modern">
              {orderType === "Takeaway" && "✓"}
            </span>

          </button>

        </div>

        {isTakeaway && (
          <div className="takeaway-info premium-info">

            <div className="info-icon">
              🏪
            </div>

            <div>
              <strong>
                {TAKEAWAY_STORE.name}
              </strong>

              <p>
                {TAKEAWAY_STORE.address}
              </p>

              <small>
                Your order will be prepared for pickup.
              </small>
            </div>

          </div>
        )}

      </section>

      {/* =================================================
          DELIVERY LOCATION
      ================================================= */}

      {!isTakeaway && (
        <section className="checkout-card location-card premium-location-card">

          <div className="location-card-heading">

            <div className="section-heading compact">

              <div className="section-icon location-icon">
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
                  Your location is detected automatically
                </p>
              </div>

            </div>

            {locationConfirmed ? (
              <span className="location-confirmed-badge">
                <span>✓</sp
