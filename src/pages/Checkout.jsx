/* =========================================================
   SUGAR CAFE — CHECKOUT FINAL
   DELIVERY + TAKEAWAY
   RAZORPAY
   DAILY SCRATCH
   SUGAR REWARDS — 6TH QUALIFYING ORDER

   IMPORTANT:
   • Only DELIVERED ₹500+ orders count.
   • Current order is NOT counted until it is delivered.
   • When previous delivered qualifying count is 5, the
     current ₹500+ order is the 6th and unlocks a reward.
   • The reward is redeemed on that 6th order.
   • Daily Scratch is completely disabled on a Sugar Reward order.
   • COD and Online Payment are eligible.
========================================================= */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import {
  addDoc,
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useStoreSettings } from "../context/StoreContext";
import { db } from "../firebase";
import "./Checkout.css";

const SHOP_LOCATION = { lat: 22.417212, lng: 82.665984 };

const DEFAULT_MAX_DISTANCE = 15;
const DEFAULT_DELIVERY_PER_KM = 20;
const DEFAULT_MIN_DELIVERY = 20;
const DEFAULT_MAX_DELIVERY = 300;

const LOYALTY_MIN_BILL = 500;
const LOYALTY_TARGET = 6;
const DAILY_SCRATCH_MIN_BILL = 499;

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

const DAILY_SCRATCH_REWARDS = [
  { type: "discount", discountPercent: 5, title: "5% OFF", shortTitle: "5% Discount" },
  { type: "freeItem", itemName: "Cheese Aloo Puff", title: "FREE Cheese Aloo Puff", shortTitle: "Free Cheese Aloo Puff" },
  { type: "freeItem", itemName: "Veg Aloo Tikka Burger", title: "FREE Veg Aloo Tikka Burger", shortTitle: "Free Veg Aloo Tikka Burger" },
  { type: "freeItem", itemName: "French Fries", title: "FREE French Fries", shortTitle: "Free French Fries" },
];

const money = (value) => `₹${Number(value || 0).toFixed(0)}`;

const getQty = (item) =>
  Number(item?.qty ?? item?.quantity ?? 1);

const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

const getTimestampMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();

  const n = Number(value);
  if (Number.isFinite(n)) return n;

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

function MapCenterTracker({ onMoveEnd }) {
  useMapEvents({
    moveend: (event) => {
      const center = event.target.getCenter();
      onMoveEnd({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}

function MapRecenter({ position }) {
  const map = useMap();

  return (
    <button
      type="button"
      className="map-recenter-control"
      onClick={() =>
        map.flyTo([position.lat, position.lng], 16, { duration: 0.8 })
      }
      aria-label="Recenter map"
    >
      ◎
    </button>
  );
}

export default function Checkout() {
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
  const [paymentMethod, setPaymentMethod] = useState("Cash on Delivery");
  const [specialNote, setSpecialNote] = useState("");

  const [customerProfile, setCustomerProfile] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [qualifyingOrders, setQualifyingOrders] = useState(0);
  const [redeemedLoyaltyRewards, setRedeemedLoyaltyRewards] = useState(0);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [selectedLoyaltyReward, setSelectedLoyaltyReward] = useState("");

  const [dailyScratchReward, setDailyScratchReward] = useState(null);
  const [dailyScratchRevealed, setDailyScratchRevealed] = useState(false);
  const [dailyScratchEligible, setDailyScratchEligible] = useState(false);
  const [mapRef, setMapRef] = useState(null);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sugarCafeUser");

      if (raw) {
        const d = JSON.parse(raw);
        const profile = {
          ...d,
          name: d.name || "",
          phone: d.phone || "",
          email: d.email || "",
          customerId: d.customerId || "",
          addresses: Array.isArray(d.addresses) ? d.addresses : [],
          guest: d.guest ?? true,
        };

        setCustomerProfile(profile);
        setSavedAddresses(profile.addresses);

        if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
      }

      const locationRaw = localStorage.getItem("userLocation");

      if (locationRaw) {
        const loc = JSON.parse(locationRaw);
        const lat = safeNumber(loc.latitude, NaN);
        const lng = safeNumber(loc.longitude, NaN);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const location = { lat, lng };
          setMarker(location);
          setMapCenter(location);
          setAddress(loc.fullAddress || loc.address || "");
        }
      }
    } catch (error) {
      console.error("Checkout load error:", error);
    }
  }, []);

  useEffect(() => {
    if (store?.codEnabled === false && store?.upiEnabled) {
      setPaymentMethod("Online Payment");
    } else if (store?.codEnabled !== false) {
      setPaymentMethod("Cash on Delivery");
    }
  }, [store?.codEnabled, store?.upiEnabled]);

  const customerId = useMemo(
    () =>
      customerProfile?.customerId ||
      customerProfile?.id ||
      customerProfile?.uid ||
      customerProfile?.phone ||
      customerProfile?.email ||
      "",
    [customerProfile]
  );

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

  const deliveryAvailable = distance <= MAX_DELIVERY_DISTANCE;

  const deliveryCharge = useMemo(() => {
    if (
      orderType !== "Delivery" ||
      !deliveryAvailable ||
      Number(totalPrice) <= 0
    ) {
      return 0;
    }

    const km = Math.ceil(distance);

    return Math.min(
      MAX_DELIVERY_CHARGE,
      Math.max(MIN_DELIVERY_CHARGE, km * DELIVERY_PER_KM)
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

  /*
   * IMPORTANT LOYALTY FIX:
   *
   * We count ALL historical delivered ₹500+ orders.
   * The current checkout is intentionally NOT counted.
   *
   * Reward eligibility is determined from the current cycle:
   *   0..4 previous qualifying orders -> no reward
   *   5 previous qualifying orders + current ₹500+ -> 6th order reward
   *
   * Existing unused rewards are retained only if they were
   * actually created by completed 6-order cycles.
   */
  const loadLoyaltyProgress = useCallback(async () => {
    if (!customerId) {
      setQualifyingOrders(0);
      setRedeemedLoyaltyRewards(0);
      return;
    }

    setLoyaltyLoading(true);

    try {
      const q = query(
        collection(db, "orders"),
        where("customerId", "==", customerId)
      );

      const snap = await getDocs(q);

      const qualifying = [];
      let redeemed = 0;

      snap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const status = String(d.status || "").toLowerCase();
        const bill = Number(d.total ?? d.bill ?? 0);

        if (status === "delivered" && bill >= LOYALTY_MIN_BILL) {
          qualifying.push({
            id: docSnap.id,
            createdAt: d.createdAt || null,
          });
        }

        /*
         * A loyalty reward is a completed reward redemption.
         * We only count it when the order itself is delivered,
         * preventing an abandoned/failed order from consuming
         * a reward cycle.
         */
        if (
          status === "delivered" &&
          d.loyaltyRewardRedeemed === true &&
          String(d.loyaltyReward || "").trim()
        ) {
          redeemed += 1;
        }
      });

      qualifying.sort(
        (a, b) =>
          getTimestampMillis(a.createdAt) -
          getTimestampMillis(b.createdAt)
      );

      const count = qualifying.length;
      const completedCycles = Math.floor(count / LOYALTY_TARGET);
      const validRedeemed = Math.min(redeemed, completedCycles);

      setQualifyingOrders(count);
      setRedeemedLoyaltyRewards(validRedeemed);
    } catch (error) {
      console.error("Loyalty progress error:", error);
      setQualifyingOrders(0);
      setRedeemedLoyaltyRewards(0);
    } finally {
      setLoyaltyLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadLoyaltyProgress();
  }, [loadLoyaltyProgress]);

  const currentOrderQualifies =
    Number(totalPrice) >= LOYALTY_MIN_BILL;

  const completedCycles = Math.floor(
    qualifyingOrders / LOYALTY_TARGET
  );

  const availablePreviousRewards = Math.max(
    0,
    completedCycles - redeemedLoyaltyRewards
  );

  /*
   * Current order becomes the 6th ONLY when the previous
   * delivered qualifying count has remainder 5.
   */
  const isSixthOrder =
    qualifyingOrders % LOYALTY_TARGET === LOYALTY_TARGET - 1;

  const sixthOrderRewardUnlocked =
    currentOrderQualifies &&
    isSixthOrder &&
    availablePreviousRewards === 0;

  const loyaltyUnlocked =
    sixthOrderRewardUnlocked || availablePreviousRewards > 0;

  const loyaltyProgress = sixthOrderRewardUnlocked
    ? LOYALTY_TARGET
    : qualifyingOrders % LOYALTY_TARGET;

  const progressPercent = loyaltyUnlocked
    ? 100
    : Math.min(
        100,
        (loyaltyProgress / LOYALTY_TARGET) * 100
      );

  useEffect(() => {
    if (!loyaltyUnlocked) setSelectedLoyaltyReward("");
  }, [loyaltyUnlocked]);

  useEffect(() => {
    /*
     * Sugar Reward always wins over Daily Scratch.
     */
    if (loyaltyUnlocked) {
      setDailyScratchEligible(false);
      setDailyScratchReward(null);
      setDailyScratchRevealed(false);
      return;
    }

    const eligible =
      Number(totalPrice) >= DAILY_SCRATCH_MIN_BILL;

    setDailyScratchEligible(eligible);

    if (!eligible) {
      setDailyScratchReward(null);
      setDailyScratchRevealed(false);
      return;
    }

    const key = `sugarCafeDailyScratch:${customerId || "guest"}:${todayKey()}`;

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
      setDailyScratchReward(null);
      setDailyScratchRevealed(false);
    }
  }, [customerId, totalPrice, loyaltyUnlocked]);

  const revealDailyScratch = () => {
    if (loyaltyUnlocked || !dailyScratchEligible || dailyScratchRevealed) {
      return;
    }

    const reward =
      DAILY_SCRATCH_REWARDS[
        Math.floor(Math.random() * DAILY_SCRATCH_REWARDS.length)
      ];

    setDailyScratchReward(reward);
    setDailyScratchRevealed(true);

    try {
      sessionStorage.setItem(
        `sugarCafeDailyScratch:${customerId || "guest"}:${todayKey()}`,
        JSON.stringify({ reward, revealed: true })
      );
    } catch (error) {
      console.error("Scratch save error:", error);
    }
  };

  const scratchDiscount = useMemo(() => {
    if (
      loyaltyUnlocked ||
      !dailyScratchRevealed ||
      dailyScratchReward?.type !== "discount"
    ) {
      return 0;
    }

    return (
      Number(totalPrice) *
      (Number(dailyScratchReward.discountPercent || 0) / 100)
    );
  }, [
    loyaltyUnlocked,
    totalPrice,
    dailyScratchReward,
    dailyScratchRevealed,
  ]);

  const rewardFreeItem = useMemo(() => {
    if (
      loyaltyUnlocked ||
      !dailyScratchRevealed ||
      dailyScratchReward?.type !== "freeItem"
    ) {
      return null;
    }

    return dailyScratchReward.itemName || null;
  }, [loyaltyUnlocked, dailyScratchReward, dailyScratchRevealed]);

  const gst = 0;

  const grandTotal = Math.max(
    0,
    Number(totalPrice) +
      Number(deliveryCharge) -
      Number(scratchDiscount) +
      Number(gst)
  );

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) throw new Error("Reverse geocoding failed");

      const data = await response.json();

      return (
        data.display_name ||
        `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      );
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }, []);

  const updateLocation = useCallback(
    async (location, geocode = true) => {
      setMarker(location);
      setMapCenter(location);

      if (geocode) {
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
      await updateLocation(center, true);
    },
    [updateLocation]
  );

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Your browser does not support location.");
      return;
    }

    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await updateLocation(
            {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            true
          );

          if (mapRef) {
            mapRef.flyTo(
              [position.coords.latitude, position.coords.longitude],
              16,
              { duration: 0.8 }
            );
          }
        } finally {
          setLoadingLocation(false);
        }
      },
      (error) => {
        setLoadingLocation(false);

        alert(
          error.code === 1
            ? "Location permission denied. Browser settings mein location Allow karein."
            : "Unable to get your location. Please try again."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

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
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) {
        throw new Error("Address search failed");
      }

      const results = await response.json();

      if (!results?.[0]) {
        alert("Address nahi mila. Please complete address enter karein.");
        return;
      }

      const lat = safeNumber(results[0].lat, NaN);
      const lng = safeNumber(results[0].lon, NaN);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        alert("Selected address coordinates nahi mile.");
        return;
      }

      const formatted = results[0].display_name || value;

      await updateLocation({ lat, lng }, false);
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

      if (mapRef) {
        mapRef.flyTo([lat, lng], 16, { duration: 0.8 });
      }
    } catch (error) {
      console.error("Manual address error:", error);
      alert("Address check nahi ho paya. Please try again.");
    } finally {
      setGeocodingManual(false);
    }
  };

  const selectSavedAddress = (saved) => {
    const lat = safeNumber(saved.latitude, NaN);
    const lng = safeNumber(saved.longitude, NaN);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const location = { lat, lng };

    setMarker(location);
    setMapCenter(location);

    setAddress(saved.fullAddress || saved.address || "");

    localStorage.setItem(
      "userLocation",
      JSON.stringify({
        ...saved,
        latitude: lat,
        longitude: lng,
        address: saved.fullAddress || saved.address || "",
      })
    );

    if (mapRef) {
      mapRef.flyTo([lat, lng], 16, { duration: 0.8 });
    }
  };

  const saveCustomerAddress = async () => {
    if (orderType !== "Delivery") return null;

    const selected = {
      id: String(Date.now()),
      label: "Delivery Address",
      address: address.trim(),
      fullAddress: address.trim(),
      latitude: Number(marker.lat),
      longitude: Number(marker.lng),
      savedAt: new Date().toISOString(),
    };

    try {
      const raw = localStorage.getItem("sugarCafeUser");

      if (raw) {
        const profile = JSON.parse(raw);
        const old = Array.isArray(profile.addresses)
          ? profile.addresses
          : [];

        const exists = old.some(
          (item) =>
            Number(item.latitude) === selected.latitude &&
            Number(item.longitude) === selected.longitude
        );

        const addresses = exists ? old : [...old, selected];

        const updated = {
          ...profile,
          addresses,
          defaultAddress: selected,
        };

        localStorage.setItem(
          "sugarCafeUser",
          JSON.stringify(updated)
        );

        setCustomerProfile(updated);
        setSavedAddresses(addresses);
      }
    } catch (error) {
      console.error("Address save error:", error);
    }

    return selected;
  };

  const getCustomerData = () => ({
    userId:
      customerProfile?.userId ||
      customerProfile?.uid ||
      "",
    customerId,
    customerName: customerProfile?.name || "Customer",
    customerPhone: customerProfile?.phone || "",
    customerEmail: customerProfile?.email || "",
    photoURL: customerProfile?.photoURL || "",
  });

  const saveCompletedOrder = async (orderData) => {
    const ref = await addDoc(collection(db, "orders"), orderData);

    localStorage.setItem("lastOrderId", ref.id);
    localStorage.setItem("lastOrderNumber", orderData.orderNumber);
    localStorage.setItem(
      "lastOrderPaymentStatus",
      orderData.paymentStatus
    );

    return ref;
  };

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const existing = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
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
      throw new Error(
        `Payment service returned an invalid response (HTTP ${response.status}).`
      );
    }
  };

  const startOnlinePayment = async ({
    customer,
    orderData,
    selectedAddress,
  }) => {
    const configured =
      import.meta.env.VITE_PAYMENT_API_URL?.trim() || "";

    if (!configured) {
      throw new Error(
        "VITE_PAYMENT_API_URL is missing. Please configure the live payment API URL in Vercel."
      );
    }

    const baseUrl = configured.replace(/\/+$/, "");
    const createUrl = `${baseUrl}/api/payment/create-order`;

    let response;

    try {
      response = await fetch(createUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          orderData,
          selectedAddress: selectedAddress
            ? {
                ...selectedAddress,
                distance: Number(orderData.distance || 0),
              }
            : null,
        }),
      });
    } catch (error) {
      throw new Error(
        `Payment server se connection nahi ho paya. ${
          error?.message || ""
        }`
      );
    }

    const data = await readApiResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `Payment server error (${response.status}).`
      );
    }

    if (!data?.keyId || !data?.orderId || !data?.amount) {
      throw new Error(
        "Payment server ne valid Razorpay order nahi diya."
      );
    }

    if (!(await loadRazorpay())) {
      throw new Error("Razorpay checkout load nahi ho paya.");
    }

    await new Promise((resolve, reject) => {
      let settled = false;

      const succeed = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const fail = (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      const razorpay = new window.Razorpay({
        key: data.keyId,
        amount: Number(data.amount),
        currency: data.currency || "INR",
        name: "Sugar Cafe",
        description: `Sugar Cafe Order ${orderData.orderNumber}`,
        order_id: data.orderId,

        prefill: {
          name: customer.customerName || "",
          email: customer.customerEmail || "",
          contact: customer.customerPhone || "",
        },

        handler: async (payment) => {
          try {
            const verifyResponse = await fetch(
              `${baseUrl}/api/payment/verify`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({
                  razorpayOrderId:
                    payment.razorpay_order_id,
                  razorpayPaymentId:
                    payment.razorpay_payment_id,
                  razorpaySignature:
                    payment.razorpay_signature,
                }),
              }
            );

            const verifyData =
              await readApiResponse(verifyResponse);

            if (!verifyResponse.ok || !verifyData.verified) {
              throw new Error(
                verifyData?.error ||
                  "Payment verification failed."
              );
            }

            /*
             * Firestore order is created ONLY after
             * successful server-side verification.
             *
             * If backend already finalized the order,
             * do not create a duplicate.
             */
            if (!verifyData.finalized) {
              await saveCompletedOrder({
                ...orderData,
                paymentMethod: "Online Payment",
                paymentStatus: "Paid",
                paymentNote: "Paid and verified by Razorpay.",
                razorpayOrderId:
                  payment.razorpay_order_id,
                razorpayPaymentId:
                  payment.razorpay_payment_id,
                razorpaySignature:
                  payment.razorpay_signature,
              });
            }

            succeed();
          } catch (error) {
            fail(error);
          }
        },

        modal: {
          ondismiss: () =>
            fail(new Error("Payment cancelled.")),
        },
      });

      razorpay.on("payment.failed", (result) => {
        fail(
          new Error(
            result?.error?.description ||
              "Payment failed. Please try again."
          )
        );
      });

      try {
        razorpay.open();
      } catch (error) {
        fail(error);
      }
    });
  };

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
      alert("Online payment is currently unavailable.");
      return;
    }

    if (
      paymentMethod === "Cash on Delivery" &&
      !store.codEnabled
    ) {
      alert("Cash on Delivery is currently unavailable.");
      return;
    }

    if (!cart.length) {
      alert("Your cart is empty.");
      return;
    }

    if (!customerProfile?.name || !customerProfile?.phone) {
      alert(
        "Please enter your name and mobile number before placing the order."
      );

      navigate("/login", { state: { from: "/checkout" } });
      return;
    }

    const customer = getCustomerData();

    if (!customer.customerPhone) {
      alert("Mobile number is required.");
      return;
    }

    if (orderType === "Delivery") {
      if (!address.trim()) {
        alert("Please select your delivery address.");
        return;
      }

      if (!deliveryAvailable) {
        alert(
          `Sorry! We currently deliver within ${MAX_DELIVERY_DISTANCE} km.`
        );
        return;
      }
    }

    if (loyaltyUnlocked && !selectedLoyaltyReward) {
      alert("Please select your FREE Sugar Reward.");
      return;
    }

    if (
      selectedLoyaltyReward &&
      !LOYALTY_REWARDS.includes(selectedLoyaltyReward)
    ) {
      alert("Invalid Sugar Reward selected.");
      return;
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

      /*
       * Daily Scratch free item:
       * never added if Sugar Reward is active.
       */
      if (!loyaltyUnlocked && rewardFreeItem) {
        orderItems.push({
          id: `daily-reward-${Date.now()}`,
          name: `🎁 FREE ${rewardFreeItem}`,
          price: 0,
          qty: 1,
          image:
            cart.find(
              (item) =>
                String(item.name).toLowerCase() ===
                String(rewardFreeItem).toLowerCase()
            )?.image || "",
          category: "Daily Reward",
          reward: true,
          rewardType: "dailyScratch",
        });
      }

      /*
       * Exactly one Sugar Reward item.
       */
      if (loyaltyUnlocked && selectedLoyaltyReward) {
        orderItems.push({
          id: `loyalty-reward-${Date.now()}`,
          name: `🎁 FREE ${selectedLoyaltyReward}`,
          price: 0,
          qty: 1,
          image:
            cart.find(
              (item) =>
                String(item.name).toLowerCase() ===
                String(selectedLoyaltyReward).toLowerCase()
            )?.image || "",
          category: "Sugar Rewards",
          reward: true,
          rewardType: "loyalty",
        });
      }

      const orderNumber = `SC-${Date.now()}`;
      const selectedAddress = await saveCustomerAddress();

      /*
       * Snapshot the reward state BEFORE this order.
       * This makes Dashboard/admin calculations predictable.
       */
      const rewardWasSixthOrder =
        sixthOrderRewardUnlocked;

      const rewardWasPreviousUnused =
        availablePreviousRewards > 0 &&
        !rewardWasSixthOrder;

      const orderData = {
        orderNumber,

        userId: customer.userId,
        customerId: customer.customerId || customerId,
        customerName: customer.customerName,
        phone: customer.customerPhone,
        email: customer.customerEmail,
        photoURL: customer.photoURL,

        orderType,

        address:
          orderType === "Delivery"
            ? address
            : "Takeaway — Pickup from Sugar Cafe",

        latitude:
          orderType === "Delivery" ? marker.lat : null,

        longitude:
          orderType === "Delivery" ? marker.lng : null,

        distance:
          orderType === "Delivery"
            ? Number(distance.toFixed(2))
            : 0,

        specialNote: specialNote.trim(),

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
        deliveryCharge: Number(deliveryCharge),
        discount: Number(scratchDiscount),
        gst: Number(gst),
        total: Number(grandTotal),

        /*
         * Daily Scratch snapshot.
         * It is blank on Sugar Reward orders.
         */
        dailyScratchReward:
          loyaltyUnlocked
            ? ""
            : dailyScratchReward?.title || "",

        /*
         * Sugar Reward snapshot.
         */
        loyaltyReward: selectedLoyaltyReward || "",
        loyaltyRewardRedeemed: Boolean(
          selectedLoyaltyReward
        ),

        /*
         * This number is informational only.
         */
        loyaltyRewardNumber:
          selectedLoyaltyReward
            ? rewardWasSixthOrder
              ? 1
              : Math.max(1, availablePreviousRewards)
            : 0,

        /*
         * Admin/dashboard snapshot:
         * qualifying orders BEFORE this order.
         */
        loyaltyQualifyingOrdersBefore:
          qualifyingOrders,

        loyaltyIsSixthOrder:
          rewardWasSixthOrder,

        loyaltyUsedPreviousReward:
          rewardWasPreviousUnused,

        loyaltyRewardCycle:
          Math.floor(
            qualifyingOrders / LOYALTY_TARGET
          ) + 1,

        /*
         * Current order itself becomes qualifying ONLY
         * after it reaches Delivered status.
         */
        loyaltyCurrentOrderQualifies:
          currentOrderQualifies,

        status: "New",

        preparationMinutes: Number(
          store.preparationMinutes ?? 15
        ),

        preparationStartedAt: null,
        preparationEndAt: null,
        foodReadyAt: null,
        dispatchedAt: null,
        deliveredAt: null,

        createdAt: Timestamp.now(),
      };

      if (paymentMethod === "Online Payment") {
        await startOnlinePayment({
          customer,
          orderData,
          selectedAddress,
        });
      } else {
        await saveCompletedOrder(orderData);
      }

      if (selectedLoyaltyReward) {
        alert(
          `🎉 Order placed!\n\nYour Sugar Reward "${selectedLoyaltyReward}" has been added FREE to this order.`
        );
      } else {
        alert("🎉 Order Placed Successfully!");
      }

      navigate("/success");
    } catch (error) {
      console.error("Order placement error:", error);

      alert(
        `Order place nahi ho paya.\n\n${
          error?.message || "Unknown error"
        }`
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  const orderDisabled =
    !store.deliveryAvailable ||
    placingOrder ||
    (orderType === "Delivery" && !deliveryAvailable);

  return (
    <div className="checkout-page">
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

      <header className="checkout-header">
        <button
          type="button"
          className="checkout-back-btn"
          onClick={() => navigate(-1)}
        >
          ←
        </button>

        <div className="checkout-header-content">
          <span className="checkout-brand">SUGAR CAFE</span>
          <h1>Checkout</h1>
          <p>
            Almost there! Your delicious food is one step away ✨
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

      <section className="checkout-card">
        <div className="section-heading">
          <div className="section-icon">🛵</div>
          <div>
            <span className="section-label">CHOOSE YOUR OPTION</span>
            <h3>Order Type</h3>
            <p>How would you like to receive your order?</p>
          </div>
        </div>

        <div className="order-type-grid">
          {["Delivery", "Takeaway"].map((type) => (
            <button
              key={type}
              type="button"
              className={`order-type-option ${
                orderType === type ? "active" : ""
              }`}
              onClick={() => setOrderType(type)}
            >
              <div className="option-top">
                <span className="option-emoji">
                  {type === "Delivery" ? "🛵" : "🛍️"}
                </span>
                <span className="option-radio">
                  {orderType === type ? "✓" : ""}
                </span>
              </div>
              <strong>{type}</strong>
              <small>
                {type === "Delivery"
                  ? "We deliver to your location"
                  : "Pick up from our cafe"}
              </small>
            </button>
          ))}
        </div>
      </section>

      {orderType === "Delivery" && (
        <section className="checkout-card delivery-card">
          <div className="section-heading">
            <div className="section-icon">📍</div>
            <div>
              <span className="section-label">DELIVERY</span>
              <h3>Delivery Location</h3>
              <p>Your location is detected automatically</p>
            </div>
            <span
              className={`location-status ${
                deliveryAvailable ? "confirmed" : "not-confirmed"
              }`}
            >
              {deliveryAvailable ? "✓ Confirmed" : "⚠ Check"}
            </span>
          </div>

          {customerProfile && (
            <div className="checkout-customer-box">
              <div className="customer-avatar">
                {customerProfile.photoURL ? (
                  <img src={customerProfile.photoURL} alt="" />
                ) : (
                  "👤"
                )}
              </div>

              <div className="customer-info">
                <strong>{customerProfile.name || "Customer"}</strong>
                <span>📱 {customerProfile.phone}</span>
                {customerProfile.email && (
                  <span>✉️ {customerProfile.email}</span>
                )}
              </div>

              <div className="customer-check">✓</div>
            </div>
          )}

          {savedAddresses.length > 0 && (
            <div className="saved-addresses">
              <div className="saved-heading">
                <strong>Saved Addresses</strong>
                <span>Tap to use</span>
              </div>

              <div className="saved-address-list">
                {savedAddresses.map((saved, index) => (
                  <button
                    type="button"
                    key={saved.id || index}
                    className="saved-address-btn"
                    onClick={() => selectSavedAddress(saved)}
                  >
                    <span>📍</span>
                    <span className="saved-address-text">
                      <strong>
                        {saved.label || "Delivery Address"}
                      </strong>
                      <small>
                        {saved.fullAddress || saved.address}
                      </small>
                    </span>
                    <span>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="manual-address-box">
            <label>Search / enter your delivery address</label>

            <input
              value={manualAddress}
              onChange={(event) =>
                setManualAddress(event.target.value)
              }
              placeholder="House/Flat No., Area, Landmark, City, PIN"
            />

            <button
              type="button"
              className="manual-address-btn"
              onClick={useManualAddress}
              disabled={geocodingManual}
            >
              {geocodingManual
                ? "Checking address..."
                : "✓ Use This Address"}
            </button>
          </div>

          <button
            type="button"
            className="current-location-btn"
            onClick={getCurrentLocation}
          >
            <span>◎</span>
            <span>
              {loadingLocation
                ? "Getting Location..."
                : "Use My Current Location"}
            </span>
            <span>→</span>
          </button>

          <div className="checkout-map-wrapper">
            <MapContainer
              center={[mapCenter.lat, mapCenter.lng]}
              zoom={15}
              scrollWheelZoom={false}
              className="checkout-map"
              whenReady={(event) => setMapRef(event.target)}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapCenterTracker onMoveEnd={handleMapMove} />
              <MapRecenter position={marker} />
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
            <div>📍</div>
            <div>
              <strong>Your delivery location</strong>
              <p>
                Move the map to adjust your delivery location.
                We will deliver to the selected pin.
              </p>
            </div>
          </div>

          <div className="selected-address-box">
            <div className="selected-address-icon">📍</div>

            <div className="selected-address-content">
              <span>SELECTED ADDRESS</span>
              <strong>
                {address ||
                  "Please select your delivery location"}
              </strong>
              <small>
                {distance.toFixed(2)} km from Sugar Cafe
              </small>
            </div>

            <div
              className={`distance-status ${
                deliveryAvailable ? "available" : "unavailable"
              }`}
            >
              {deliveryAvailable
                ? "✓ Deliverable"
                : "✕ Outside Range"}
            </div>
          </div>

          {!deliveryAvailable && (
            <div className="delivery-warning">
              <span>⚠️</span>
              <div>
                <strong>Delivery not available</strong>
                <p>
                  We currently deliver within{" "}
                  {MAX_DELIVERY_DISTANCE} km of Sugar Cafe.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {orderType === "Takeaway" && (
        <section className="checkout-card">
          <div className="section-heading">
            <div className="section-icon">🛍️</div>
            <div>
              <span className="section-label">PICKUP</span>
              <h3>Cafe Pickup</h3>
              <p>
                Your order will be prepared at Sugar Cafe.
              </p>
            </div>
          </div>

          {customerProfile && (
            <div className="checkout-customer-box">
              <div className="customer-avatar">
                {customerProfile.photoURL ? (
                  <img src={customerProfile.photoURL} alt="" />
                ) : (
                  "👤"
                )}
              </div>

              <div className="customer-info">
                <strong>{customerProfile.name || "Customer"}</strong>
                <span>📱 {customerProfile.phone}</span>
                {customerProfile.email && (
                  <span>✉️ {customerProfile.email}</span>
                )}
              </div>

              <div className="customer-check">✓</div>
            </div>
          )}

          <div className="takeaway-location-box">
            <div>📍</div>
            <div>
              <strong>Sugar Cafe</strong>
              <p>Pickup from Sugar Cafe</p>
              <small>
                Your order will be ready for pickup after preparation.
              </small>
            </div>
          </div>
        </section>
      )}

      <section className="checkout-card">
        <div className="section-heading">
          <div className="section-icon">🛒</div>
          <div>
            <span className="section-label">YOUR ORDER</span>
            <h3>Order Summary</h3>
            <p>
              {cart.length} item{cart.length !== 1 ? "s" : ""} in your cart
            </p>
          </div>
        </div>

        <div className="checkout-items">
          {cart.map((item, index) => {
            const qty = getQty(item);
            const itemTotal = Number(item.price || 0) * qty;

            return (
              <div
                className="checkout-item"
                key={item.id || `${item.name}-${index}`}
              >
                <div className="checkout-item-image">
                  {item.image ? (
                    <img src={item.image} alt={item.name} />
                  ) : (
                    <span>🍽️</span>
                  )}
                </div>

                <div className="checkout-item-info">
                  <strong>{item.name}</strong>
                  <span>Qty: {qty}</span>
                </div>

                <strong className="checkout-item-price">
                  {money(itemTotal)}
                </strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className="checkout-card loyalty-card">
        <div className="section-heading">
          <div className="section-icon">🎁</div>
          <div>
            <span className="section-label">SUGAR REWARDS</span>
            <h3>6 + 1 Loyalty Program</h3>
            <p>
              Complete 6 qualifying orders and get a FREE reward.
            </p>
          </div>
        </div>

        <div className="loyalty-progress-box">
          <div className="loyalty-progress-top">
            <strong>
              {sixthOrderRewardUnlocked
                ? "🎉 6th Order Reward Unlocked!"
                : loyaltyUnlocked
                ? "🎁 Sugar Reward Available"
                : `${loyaltyProgress} / ${LOYALTY_TARGET} completed`}
            </strong>

            <span>{Math.round(progressPercent)}%</span>
          </div>

          <div className="loyalty-progress-track">
            <div
              className="loyalty-progress-fill"
              style={{
                width: `${Math.min(100, progressPercent)}%`,
              }}
            />
          </div>

          <p className="loyalty-progress-note">
            {sixthOrderRewardUnlocked
              ? "This ₹500+ order is your 6th qualifying order. Choose one FREE Sugar Reward below."
              : loyaltyUnlocked
              ? "You have an unused Sugar Reward. Redeem it on this order."
              : `${Math.max(
                  0,
                  LOYALTY_TARGET - loyaltyProgress
                )} more qualifying delivered order${
                  Math.max(0, LOYALTY_TARGET - loyaltyProgress) === 1
                    ? ""
                    : "s"
                } needed.`}
          </p>
        </div>

        {currentOrderQualifies && !loyaltyUnlocked && (
          <div className="loyalty-current-info">
            🧾 This order qualifies for the ₹500+ Sugar Rewards program.
          </div>
        )}

        {loyaltyUnlocked && (
          <div className="loyalty-reward-selection">
            <div className="reward-selection-heading">
              <strong>🎉 Choose Your FREE Reward</strong>
              <span>Select one</span>
            </div>

            <div className="loyalty-reward-grid">
              {LOYALTY_REWARDS.map((reward) => (
                <button
                  key={reward}
                  type="button"
                  className={`loyalty-reward-option ${
                    selectedLoyaltyReward === reward
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedLoyaltyReward(reward)
                  }
                >
                  <span className="reward-check">
                    {selectedLoyaltyReward === reward ? "✓" : ""}
                  </span>

                  <span className="reward-gift">🎁</span>

                  <span className="reward-name">{reward}</span>

                  <small>FREE</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {loyaltyLoading && (
          <div className="loyalty-loading">
            Checking your Sugar Rewards...
          </div>
        )}
      </section>

      {!loyaltyUnlocked && dailyScratchEligible && (
        <section className="checkout-card scratch-card-section">
          <div className="section-heading">
            <div className="section-icon">🎟️</div>
            <div>
              <span className="section-label">DAILY REWARD</span>
              <h3>Scratch & Win</h3>
              <p>
                Your ₹{DAILY_SCRATCH_MIN_BILL}+ order qualifies.
              </p>
            </div>
          </div>

          <div
            className={`daily-scratch-card ${
              dailyScratchRevealed ? "revealed" : ""
            }`}
            onClick={revealDailyScratch}
          >
            {!dailyScratchRevealed ? (
              <div className="scratch-overlay">
                <span className="scratch-emoji">🎁</span>
                <strong>SCRATCH TO REVEAL</strong>
                <small>
                  Tap here to reveal today's reward
                </small>
              </div>
            ) : (
              <div className="scratch-result">
                <span>🎉</span>
                <strong>
                  {dailyScratchReward?.title ||
                    "Congratulations!"}
                </strong>
                <small>
                  Your reward will be applied to this order.
                </small>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="checkout-card">
        <div className="section-heading">
          <div className="section-icon">📝</div>
          <div>
            <span className="section-label">OPTIONAL</span>
            <h3>Special Instructions</h3>
            <p>
              Anything we should know about your order?
            </p>
          </div>
        </div>

        <textarea
          className="checkout-note-input"
          value={specialNote}
          onChange={(event) =>
            setSpecialNote(event.target.value)
          }
          placeholder="Example: Less spicy, extra sauce, no onions..."
          rows={3}
          maxLength={250}
        />

        <div className="note-counter">
          {specialNote.length}/250
        </div>
      </section>

      <section className="checkout-card payment-card">
        <div className="section-heading payment-heading">
          <div className="section-icon payment-main-icon">💳</div>
          <div>
            <span className="section-label">PAYMENT</span>
            <h3>Choose Payment Method</h3>
            <p>
              Select how you want to pay for your order.
            </p>
          </div>
        </div>

        <div className="payment-method-grid">
          {store.codEnabled !== false && (
            <button
              type="button"
              className={`payment-method-option ${
                paymentMethod === "Cash on Delivery"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setPaymentMethod("Cash on Delivery")
              }
            >
              <div className="payment-option-icon cod-icon">💵</div>

              <div className="payment-option-content">
                <div className="payment-option-title-row">
                  <strong>Cash on Delivery</strong>
                  {paymentMethod === "Cash on Delivery" && (
                    <span className="payment-selected-check">✓</span>
                  )}
                </div>

                <small>Pay when your order arrives</small>

                <div className="payment-mini-info">
                  <span>🛡️ Secure</span>
                  <span>🚚 Pay on delivery</span>
                </div>
              </div>

              <span
                className={`payment-radio ${
                  paymentMethod === "Cash on Delivery"
                    ? "selected"
                    : ""
                }`}
              >
                {paymentMethod === "Cash on Delivery" && (
                  <span className="radio-inner" />
                )}
              </span>
            </button>
          )}

          {store.upiEnabled && (
            <button
              type="button"
              className={`payment-method-option ${
                paymentMethod === "Online Payment"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setPaymentMethod("Online Payment")
              }
            >
              <div className="payment-option-icon online-icon">💳</div>

              <div className="payment-option-content">
                <div className="payment-option-title-row">
                  <strong>Online Payment</strong>
                  {paymentMethod === "Online Payment" && (
                    <span className="payment-selected-check">✓</span>
                  )}
                </div>

                <small>UPI / Card / Net Banking</small>

                <div className="payment-mini-info payment-methods">
                  <span>UPI</span>
                  <span>Cards</span>
                  <span>Net Banking</span>
                </div>
              </div>

              <span
                className={`payment-radio ${
                  paymentMethod === "Online Payment"
                    ? "selected"
                    : ""
                }`}
              >
                {paymentMethod === "Online Payment" && (
                  <span className="radio-inner" />
                )}
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="checkout-card bill-summary-card">
        <div className="section-heading">
          <div className="section-icon">🧾</div>
          <div>
            <span className="section-label">BILL DETAILS</span>
            <h3>Order Total</h3>
          </div>
        </div>

        <div className="bill-lines">
          <div className="bill-line">
            <span>Item Total</span>
            <strong>{money(totalPrice)}</strong>
          </div>

          {orderType === "Delivery" && (
            <div className="bill-line">
              <span>Delivery Charge</span>
              <strong>
                {deliveryCharge > 0
                  ? money(deliveryCharge)
                  : "FREE"}
              </strong>
            </div>
          )}

          {!loyaltyUnlocked && scratchDiscount > 0 && (
            <div className="bill-line discount">
              <span>🎟️ Daily Scratch Discount</span>
              <strong>-{money(scratchDiscount)}</strong>
            </div>
          )}

          {loyaltyUnlocked && selectedLoyaltyReward && (
            <div className="bill-line reward">
              <span>🎁 Sugar Reward</span>
              <strong>FREE</strong>
            </div>
          )}

          {rewardFreeItem && !loyaltyUnlocked && (
            <div className="bill-line reward">
              <span>🎁 Daily Free Item</span>
              <strong>FREE</strong>
            </div>
          )}

          <div className="bill-divider" />

          <div className="bill-total">
            <span>Grand Total</span>
            <strong>{money(grandTotal)}</strong>
          </div>
        </div>
      </section>

      <div className="checkout-bottom">
        {loyaltyUnlocked && !selectedLoyaltyReward && (
          <div className="checkout-action-warning">
            🎁 Please select your FREE Sugar Reward before placing the order.
          </div>
        )}

        {orderType === "Delivery" && !deliveryAvailable && (
          <div className="checkout-action-warning">
            📍 Your selected location is outside our delivery area.
          </div>
        )}

        <button
          type="button"
          className="place-order-btn"
          onClick={placeOrder}
          disabled={
            orderDisabled ||
            (loyaltyUnlocked && !selectedLoyaltyReward)
          }
        >
          {placingOrder ? (
            <>
              <span className="order-spinner" />
              Processing...
            </>
          ) : (
            <>
              <span>
                {paymentMethod === "Online Payment" ? "💳" : "🛵"}
              </span>

              <span>
                {paymentMethod === "Online Payment"
                  ? `Pay ${money(grandTotal)}`
                  : `Place Order • ${money(grandTotal)}`}
              </span>

              <span>→</span>
            </>
          )}
        </button>

        <div className="checkout-security-note">
          🔒 Your order details are securely processed.
        </div>
      </div>
    </div>
  );
}
