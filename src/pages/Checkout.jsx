/* =========================================================
   SUGAR CAFE — CHECKOUT FINAL
   Delivery + Takeaway + Razorpay + Daily Scratch
   6 Delivered ₹500+ Orders => 1 Sugar Reward
   Reward is redeemed on the next order (7th order)
========================================================= */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { addDoc, collection, getDocs, query, Timestamp, where } from "firebase/firestore";
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

const money = (v) => `₹${Number(v || 0).toFixed(0)}`;
const getQty = (item) => Number(item?.qty ?? item?.quantity ?? 1);
const safeNumber = (v, fallback = 0) => {
  const n = Number(v);
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

function MapCenterTracker({ onMoveEnd }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onMoveEnd({ lat: c.lat, lng: c.lng });
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
      onClick={() => map.flyTo([position.lat, position.lng], 16, { duration: 0.8 })}
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

  const MAX_DELIVERY_DISTANCE = safeNumber(store?.maxDeliveryDistanceKm, DEFAULT_MAX_DISTANCE);
  const DELIVERY_PER_KM = safeNumber(store?.deliveryPerKm, DEFAULT_DELIVERY_PER_KM);
  const MIN_DELIVERY_CHARGE = safeNumber(store?.minDeliveryCharge, DEFAULT_MIN_DELIVERY);
  const MAX_DELIVERY_CHARGE = safeNumber(store?.maxDeliveryCharge, DEFAULT_MAX_DELIVERY);

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

      const locRaw = localStorage.getItem("userLocation");
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        const lat = safeNumber(loc.latitude, NaN);
        const lng = safeNumber(loc.longitude, NaN);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setMarker({ lat, lng });
          setMapCenter({ lat, lng });
          setAddress(loc.fullAddress || loc.address || "");
        }
      }
    } catch (e) {
      console.error("Checkout load error:", e);
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
    if (orderType !== "Delivery" || !deliveryAvailable || Number(totalPrice) <= 0) return 0;
    const km = Math.ceil(distance);
    return Math.min(MAX_DELIVERY_CHARGE, Math.max(MIN_DELIVERY_CHARGE, km * DELIVERY_PER_KM));
  }, [
    orderType,
    deliveryAvailable,
    totalPrice,
    distance,
    DELIVERY_PER_KM,
    MIN_DELIVERY_CHARGE,
    MAX_DELIVERY_CHARGE,
  ]);

  const loadLoyaltyProgress = useCallback(async () => {
    if (!customerId) {
      setQualifyingOrders(0);
      setRedeemedLoyaltyRewards(0);
      return;
    }

    setLoyaltyLoading(true);
    try {
      const q = query(collection(db, "orders"), where("customerId", "==", customerId));
      const snap = await getDocs(q);

      let qualifying = 0;
      let redeemed = 0;

      snap.docs.forEach((doc) => {
        const d = doc.data();
        const delivered = String(d.status || "").toLowerCase() === "delivered";
        const bill = Number(d.total ?? d.bill ?? 0);

        if (delivered && bill >= LOYALTY_MIN_BILL) {
          qualifying += 1;
          if (d.loyaltyRewardRedeemed === true || d.loyaltyReward) redeemed += 1;
        }
      });

      setQualifyingOrders(qualifying);
      setRedeemedLoyaltyRewards(redeemed);

      const earnedRewards = Math.floor(qualifying / LOYALTY_TARGET);
      const availableRewards = Math.max(0, earnedRewards - redeemed);
      if (availableRewards <= 0) setSelectedLoyaltyReward("");
    } catch (e) {
      console.error("Loyalty progress error:", e);
      setQualifyingOrders(0);
      setRedeemedLoyaltyRewards(0);
    } finally {
      setLoyaltyLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadLoyaltyProgress();
  }, [loadLoyaltyProgress]);

  const earnedLoyaltyRewards = Math.floor(qualifyingOrders / LOYALTY_TARGET);
  const availableLoyaltyRewards = Math.max(0, earnedLoyaltyRewards - redeemedLoyaltyRewards);
  const loyaltyProgress = qualifyingOrders % LOYALTY_TARGET;
  const progressPercent = (loyaltyProgress / LOYALTY_TARGET) * 100;
  const loyaltyUnlocked = availableLoyaltyRewards > 0;

  useEffect(() => {
    if (!loyaltyUnlocked) setSelectedLoyaltyReward("");
  }, [loyaltyUnlocked]);

  useEffect(() => {
    const eligible = Number(totalPrice) >= DAILY_SCRATCH_MIN_BILL;
    setDailyScratchEligible(eligible);

    const key = `sugarCafeDailyScratch:${customerId || "guest"}:${todayKey()}`;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const d = JSON.parse(saved);
        setDailyScratchReward(d.reward || null);
        setDailyScratchRevealed(Boolean(d.revealed));
      } else {
        setDailyScratchReward(null);
        setDailyScratchRevealed(false);
      }
    } catch (e) {
      console.error("Scratch state error:", e);
    }
  }, [customerId, totalPrice]);

  const revealDailyScratch = () => {
    if (!dailyScratchEligible || dailyScratchRevealed) return;
    const reward = DAILY_SCRATCH_REWARDS[Math.floor(Math.random() * DAILY_SCRATCH_REWARDS.length)];
    setDailyScratchReward(reward);
    setDailyScratchRevealed(true);
    try {
      sessionStorage.setItem(
        `sugarCafeDailyScratch:${customerId || "guest"}:${todayKey()}`,
        JSON.stringify({ reward, revealed: true })
      );
    } catch (e) {
      console.error("Scratch save error:", e);
    }
  };

  const scratchDiscount = useMemo(() => {
    if (!dailyScratchRevealed || dailyScratchReward?.type !== "discount") return 0;
    return Number(totalPrice) * (Number(dailyScratchReward.discountPercent || 0) / 100);
  }, [totalPrice, dailyScratchReward, dailyScratchRevealed]);

  const rewardFreeItem = useMemo(
    () =>
      dailyScratchRevealed && dailyScratchReward?.type === "freeItem"
        ? dailyScratchReward.itemName
        : null,
    [dailyScratchReward, dailyScratchRevealed]
  );

  const gst = 0;
  const grandTotal = Math.max(
    0,
    Number(totalPrice) + Number(deliveryCharge) - Number(scratchDiscount) + Number(gst)
  );

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { Accept: "application/json" } }
      );
      const d = await r.json();
      return d.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }, []);

  const updateLocation = useCallback(
    async (location, geocode = true) => {
      setMarker(location);
      setMapCenter(location);
      if (geocode) {
        const formatted = await reverseGeocode(location.lat, location.lng);
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
    async (center) => updateLocation(center, true),
    [updateLocation]
  );

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Your browser does not support location.");
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          await updateLocation({ lat: p.coords.latitude, lng: p.coords.longitude }, true);
          if (mapRef) mapRef.flyTo([p.coords.latitude, p.coords.longitude], 16, { duration: 0.8 });
        } finally {
          setLoadingLocation(false);
        }
      },
      (e) => {
        setLoadingLocation(false);
        alert(
          e.code === 1
            ? "Location permission denied. Browser settings mein location Allow karein."
            : "Unable to get your location. Please try again."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const useManualAddress = async () => {
    const value = manualAddress.trim();
    if (!value) return alert("Please enter your complete delivery address.");

    setGeocodingManual(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          `${value}, Korba, Chhattisgarh, India`
        )}&limit=1&addressdetails=1`,
        { headers: { Accept: "application/json" } }
      );
      const results = await r.json();
      if (!results?.[0]) return alert("Address nahi mila. Please complete address enter karein.");

      const lat = safeNumber(results[0].lat, NaN);
      const lng = safeNumber(results[0].lon, NaN);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return alert("Selected address coordinates nahi mile.");

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
      if (mapRef) mapRef.flyTo([lat, lng], 16, { duration: 0.8 });
    } catch (e) {
      console.error(e);
      alert("Address check nahi ho paya. Please try again.");
    } finally {
      setGeocodingManual(false);
    }
  };

  const selectSavedAddress = (saved) => {
    const lat = safeNumber(saved.latitude, NaN);
    const lng = safeNumber(saved.longitude, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const loc = { lat, lng };
    setMarker(loc);
    setMapCenter(loc);
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
    if (mapRef) mapRef.flyTo([lat, lng], 16, { duration: 0.8 });
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
        const old = Array.isArray(profile.addresses) ? profile.addresses : [];
        const exists = old.some(
          (a) =>
            Number(a.latitude) === selected.latitude &&
            Number(a.longitude) === selected.longitude
        );
        const addresses = exists ? old : [...old, selected];
        const updated = { ...profile, addresses, defaultAddress: selected };
        localStorage.setItem("sugarCafeUser", JSON.stringify(updated));
        setCustomerProfile(updated);
        setSavedAddresses(addresses);
      }
    } catch (e) {
      console.error("Address save error:", e);
    }
    return selected;
  };

  const getCustomerData = () => ({
    userId: customerProfile?.userId || customerProfile?.uid || "",
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
    localStorage.setItem("lastOrderPaymentStatus", orderData.paymentStatus);
    return ref;
  };

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const readApiResponse = async (response) => {
    const raw = await response.text();
    if (!raw) throw new Error(`Payment service returned an empty response (HTTP ${response.status}).`);
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`Payment service returned an invalid response (HTTP ${response.status}).`);
    }
  };

  const startOnlinePayment = async ({ customer, orderData, selectedAddress }) => {
    const configured = import.meta.env.VITE_PAYMENT_API_URL?.trim() || "";
    const baseUrl = configured.replace(/\/+$/, "");
    const createUrl = `${baseUrl}/api/payment/create-order`;

    let response;
    try {
      response = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          orderData,
          selectedAddress: selectedAddress
            ? { ...selectedAddress, distance: Number(orderData.distance || 0) }
            : null,
        }),
      });
    } catch (e) {
      throw new Error(`Payment server se connection nahi ho paya. ${e?.message || ""}`);
    }

    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data?.error || data?.message || `Payment server error (${response.status}).`);
    if (!data?.keyId || !data?.orderId || !data?.amount) {
      throw new Error("Payment server ne valid Razorpay order nahi diya.");
    }

    if (!(await loadRazorpay())) throw new Error("Razorpay checkout load nahi ho paya.");

    await new Promise((resolve, reject) => {
      let settled = false;
      const ok = () => { if (!settled) { settled = true; resolve(); } };
      const fail = (e) => { if (!settled) { settled = true; reject(e); } };

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
        handler: async (rp) => {
          try {
            const verify = await fetch(`${baseUrl}/api/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({
                razorpayOrderId: rp.razorpay_order_id,
                razorpayPaymentId: rp.razorpay_payment_id,
                razorpaySignature: rp.razorpay_signature,
              }),
            });

            const verifyData = await readApiResponse(verify);
            if (!verify.ok || !verifyData.verified) {
              throw new Error(verifyData?.error || "Payment verification failed.");
            }

            if (!verifyData.finalized) {
              await saveCompletedOrder({
                ...orderData,
                paymentMethod: "Online Payment",
                paymentStatus: "Paid",
                paymentNote: "Paid and verified by Razorpay.",
                razorpayOrderId: rp.razorpay_order_id,
                razorpayPaymentId: rp.razorpay_payment_id,
                razorpaySignature: rp.razorpay_signature,
              });
            }
            ok();
          } catch (e) {
            fail(e);
          }
        },
        modal: { ondismiss: () => fail(new Error("Payment cancelled.")) },
      });

      razorpay.on("payment.failed", (r) =>
        fail(new Error(r?.error?.description || "Payment failed. Please try again."))
      );

      try { razorpay.open(); } catch (e) { fail(e); }
    });
  };

  const placeOrder = async () => {
    if (!store.deliveryAvailable) {
      alert(store.announcement || `Orders are unavailable ${store.orderTimingLabel || ""}.`);
      return;
    }
    if (paymentMethod === "Online Payment" && !store.upiEnabled) {
      return alert("Online payment is currently unavailable.");
    }
    if (paymentMethod === "Cash on Delivery" && !store.codEnabled) {
      return alert("Cash on Delivery is currently unavailable.");
    }
    if (!cart.length) return alert("Your cart is empty.");

    if (!customerProfile?.name || !customerProfile?.phone) {
      alert("Please enter your name and mobile number before placing the order.");
      navigate("/login", { state: { from: "/checkout" } });
      return;
    }

    const customer = getCustomerData();
    if (!customer.customerPhone) return alert("Mobile number is required.");

    if (orderType === "Delivery") {
      if (!address.trim()) return alert("Please select your delivery address.");
      if (!deliveryAvailable) return alert(`Sorry! We currently deliver within ${MAX_DELIVERY_DISTANCE} km.`);
    }

    /* 6th qualifying delivered order unlocks ONE reward.
       The reward can be selected and redeemed on the next order. */
    if (selectedLoyaltyReward && !loyaltyUnlocked) {
      return alert("Sugar Reward is not unlocked yet.");
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
        orderItems.push({
          id: `daily-reward-${Date.now()}`,
          name: `🎁 FREE ${rewardFreeItem}`,
          price: 0,
          qty: 1,
          image:
            cart.find((i) => String(i.name).toLowerCase() === String(rewardFreeItem).toLowerCase())?.image || "",
          category: "Daily Reward",
          reward: true,
          rewardType: "dailyScratch",
        });
      }

      if (selectedLoyaltyReward) {
        orderItems.push({
          id: `loyalty-reward-${Date.now()}`,
          name: `🎁 FREE ${selectedLoyaltyReward}`,
          price: 0,
          qty: 1,
          image:
            cart.find((i) => String(i.name).toLowerCase() === String(selectedLoyaltyReward).toLowerCase())?.image || "",
          category: "Sugar Rewards",
          reward: true,
          rewardType: "loyalty",
        });
      }

      const orderNumber = `SC-${Date.now()}`;
      const selectedAddress = await saveCustomerAddress();

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
        latitude: orderType === "Delivery" ? marker.lat : null,
        longitude: orderType === "Delivery" ? marker.lng : null,
        distance: orderType === "Delivery" ? Number(distance.toFixed(2)) : 0,
        specialNote: specialNote.trim(),
        paymentMethod,
        paymentStatus: paymentMethod === "Online Payment" ? "Paid" : "Pending",
        paymentNote: paymentMethod === "Online Payment" ? "Paid and verified by Razorpay." : "",
        items: orderItems,
        subtotal: Number(totalPrice),
        deliveryCharge: Number(deliveryCharge),
        discount: Number(scratchDiscount),
        gst: Number(gst),
        total: Number(grandTotal),
        dailyScratchReward: dailyScratchReward?.title || "",
        loyaltyReward: selectedLoyaltyReward || "",
        loyaltyRewardRedeemed: Boolean(selectedLoyaltyReward),
        loyaltyRewardNumber: selectedLoyaltyReward ? availableLoyaltyRewards : 0,
        status: "New",
        preparationMinutes: Number(store.preparationMinutes ?? 15),
        preparationStartedAt: null,
        preparationEndAt: null,
        foodReadyAt: null,
        dispatchedAt: null,
        deliveredAt: null,
        createdAt: Timestamp.now(),
      };

      if (paymentMethod === "Online Payment") {
        await startOnlinePayment({ customer, orderData, selectedAddress });
      } else {
        await saveCompletedOrder(orderData);
      }

      alert(
        selectedLoyaltyReward
          ? `🎉 Order placed! Your Sugar Reward "${selectedLoyaltyReward}" has been redeemed FREE.`
          : "🎉 Order Placed Successfully!"
      );
      navigate("/success");
    } catch (e) {
      console.error("Order placement error:", e);
      alert(`Order place nahi ho paya.\n\n${e?.message || "Unknown error"}`);
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
        <strong>{store.deliveryAvailable ? "Delivery Available" : "Orders Closed"}</strong>
        <span className="status-time">
          {store.deliveryAvailable ? `Today: ${store.orderTimingLabel || "11:00 AM – 3:00 AM"}` : store.orderTimingLabel || ""}
        </span>
      </div>

      <header className="checkout-header">
        <button type="button" className="checkout-back-btn" onClick={() => navigate(-1)}>←</button>
        <div className="checkout-header-content">
          <span className="checkout-brand">SUGAR CAFE</span>
          <h1>Checkout</h1>
          <p>Almost there! Your delicious food is one step away ✨</p>
        </div>
        <div className="secure-badge"><span>✓</span><div><strong>100%</strong><small>Secure</small></div></div>
      </header>

      <section className="checkout-card">
        <div className="section-heading"><div className="section-icon">🛵</div><div><span className="section-label">CHOOSE YOUR OPTION</span><h3>Order Type</h3><p>How would you like to receive your order?</p></div></div>
        <div className="order-type-grid">
          {["Delivery", "Takeaway"].map((type) => (
            <button key={type} type="button" className={`order-type-option ${orderType === type ? "active" : ""}`} onClick={() => setOrderType(type)}>
              <div className="option-top"><span className="option-emoji">{type === "Delivery" ? "🛵" : "🛍️"}</span><span className="option-radio">{orderType === type ? "✓" : ""}</span></div>
              <strong>{type}</strong><small>{type === "Delivery" ? "We deliver to your location" : "Pick up from our cafe"}</small>
            </button>
          ))}
        </div>
      </section>

      {orderType === "Delivery" && (
        <section className="checkout-card delivery-card">
          <div className="section-heading">
            <div className="section-icon">📍</div>
            <div><span className="section-label">DELIVERY</span><h3>Delivery Location</h3><p>Your location is detected automatically</p></div>
            <span className={`location-status ${deliveryAvailable ? "confirmed" : "not-confirmed"}`}>{deliveryAvailable ? "✓ Confirmed" : "⚠ Check"}</span>
          </div>

          {customerProfile && (
            <div className="checkout-customer-box">
              <div className="customer-avatar">{customerProfile.photoURL ? <img src={customerProfile.photoURL} alt="" /> : "👤"}</div>
              <div className="customer-info"><strong>{customerProfile.name || "Customer"}</strong><span>📱 {customerProfile.phone}</span>{customerProfile.email && <span>✉️ {customerProfile.email}</span>}</div>
              <div className="customer-check">✓</div>
            </div>
          )}

          {savedAddresses.length > 0 && (
            <div className="saved-addresses">
              <div className="saved-heading"><strong>Saved Addresses</strong><span>Tap to use</span></div>
              <div className="saved-address-list">
                {savedAddresses.map((saved, i) => (
                  <button type="button" key={saved.id || i} className="saved-address-btn" onClick={() => selectSavedAddress(saved)}>
                    <span>📍</span><span className="saved-address-text"><strong>{saved.label || "Delivery Address"}</strong><small>{saved.fullAddress || saved.address}</small></span><span>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="manual-address-box">
            <label>Search / enter your delivery address</label>
            <input value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} placeholder="House/Flat No., Area, Landmark, City, PIN" />
            <button type="button" className="manual-address-btn" onClick={useManualAddress} disabled={geocodingManual}>{geocodingManual ? "Checking address..." : "✓ Use This Address"}</button>
          </div>

          <button type="button" className="current-location-btn" onClick={getCurrentLocation}>
            <span>◎</span><span>{loadingLocation ? "Getting Location..." : "Use My Current Location"}</span><span>→</span>
          </button>

          <div className="checkout-map-wrapper">
            <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={15} scrollWheelZoom={false} className="checkout-map" whenReady={(e) => setMapRef(e.target)}>
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapCenterTracker onMoveEnd={handleMapMove} />
              <MapRecenter position={marker} />
            </MapContainer>
            <div className="map-center-pin"><div className="map-pin-shadow" /><div className="map-pin"><span /></div></div>
            <div className="live-location-badge"><span />Live location</div>
          </div>

          <div className="map-instruction"><div>📍</div><div><strong>Your delivery location</strong><p>Move the map to adjust your exact location</p></div></div>

          <div className="selected-address-card">
            <div>🏠</div><div className="selected-address-content"><span>SELECTED ADDRESS</span><strong>{address || "Move the map or use your current location"}</strong><small>{distance.toFixed(1)} km from Sugar Cafe</small></div>
            <button type="button" className="address-recenter-btn" onClick={() => mapRef?.flyTo([marker.lat, marker.lng], 16, { duration: 0.8 })}>◎</button>
          </div>

          <div className="delivery-stat-grid">
            <div className="delivery-stat-card"><span>🗺️</span><div><small>Distance</small><strong>{distance.toFixed(1)} km</strong></div></div>
            <div className="delivery-stat-card"><span>🛵</span><div><small>Delivery charge</small><strong>{money(deliveryCharge)}</strong></div></div>
          </div>

          <div className={`delivery-status ${deliveryAvailable ? "available" : "unavailable"}`}>
            <span>{deliveryAvailable ? "✓" : "!"}</span><div><strong>{deliveryAvailable ? "Delivery available" : "Delivery unavailable"}</strong><span>{deliveryAvailable ? "We can deliver to this location" : `We deliver within ${MAX_DELIVERY_DISTANCE} km`}</span></div>
          </div>
        </section>
      )}

      {orderType === "Takeaway" && (
        <section className="checkout-card"><div className="section-heading"><div className="section-icon">🛍️</div><div><span className="section-label">TAKEAWAY</span><h3>Pick Up From Cafe</h3><p>Your order will be prepared for pickup at Sugar Cafe.</p></div></div><div className="takeaway-box"><span>🏪</span><div><strong>Sugar Cafe</strong><p>Please collect your order from the cafe when it is ready.</p></div></div></section>
      )}

      <section className="checkout-card">
        <div className="section-heading"><div className="section-icon">📝</div><div><span className="section-label">OPTIONAL</span><h3>Special Note</h3><p>Any special request for your order?</p></div><span className="optional-badge">OPTIONAL</span></div>
        <div className="special-note-wrapper"><textarea value={specialNote} onChange={(e) => setSpecialNote(e.target.value.slice(0, 300))} maxLength={300} placeholder="Example: Less spicy, no onion, extra cheese, birthday message..." rows={5} /></div>
        <div className="note-footer"><span>Your request will be shared with the café.</span><span>{specialNote.length}/300</span></div>
      </section>

      <section className="checkout-card scratch-card">
        <div className="scratch-heading"><div className="scratch-gift-icon">🎁</div><div><span className="section-label">DAILY SCRATCH & WIN</span><h3>Your Daily Reward</h3><p>One order. One surprise. Every day.</p></div></div>
        {!dailyScratchEligible ? (
          <div className="scratch-locked"><div>🎁</div><strong>Unlock your Daily Reward</strong><p>Add items worth {money(DAILY_SCRATCH_MIN_BILL)} or more to unlock today's scratch card.</p><div className="scratch-progress"><span style={{ width: `${Math.min(100, (Number(totalPrice) / DAILY_SCRATCH_MIN_BILL) * 100)}%` }} /></div></div>
        ) : (
          <button type="button" className={`scratch-reveal ${dailyScratchRevealed ? "revealed" : ""}`} onClick={revealDailyScratch} disabled={dailyScratchRevealed}>
            {dailyScratchRevealed ? <><div className="scratch-confetti">✨ 🎉 ✨</div><div className="scratch-reward-gift">🎁</div><span className="scratch-won">YOU WON</span><strong>{dailyScratchReward?.title}</strong><small>{dailyScratchReward?.type === "discount" ? "Discount applied to this order." : "Free reward added to this order."}</small></> : <><div className="scratch-question">🎁</div><span>TAP TO SCRATCH</span><small>Reveal today's surprise</small></>}
          </button>
        )}
      </section>

      <section className={`checkout-card loyalty-card ${loyaltyUnlocked ? "reward-unlocked" : ""}`}>
        <div className="loyalty-top">
          <div><span className="loyalty-label">🎁 SUGAR REWARDS</span><div className="loyalty-number">{loyaltyProgress}<span>/{LOYALTY_TARGET}</span></div><strong>{loyaltyUnlocked ? "Reward ready to redeem" : "qualifying orders"}</strong></div>
          <span className="loyalty-pill">{loyaltyUnlocked ? "🎉 1 Reward Available" : `${LOYALTY_TARGET - loyaltyProgress} more to go`}</span>
        </div>

        <div className="loyalty-progress"><span style={{ width: `${loyaltyUnlocked ? 100 : progressPercent}%` }} /></div>

        {loyaltyUnlocked ? (
          <div className="loyalty-redeem-box">
            <div className="loyalty-redeem-title">🎉 Your 6th ₹500+ delivered order is complete!</div>
            <p>Choose <strong>ONE FREE item</strong> to redeem with this order.</p>
            <select value={selectedLoyaltyReward} onChange={(e) => setSelectedLoyaltyReward(e.target.value)}>
              <option value="">Select your free reward</option>
              {LOYALTY_REWARDS.map((r) => <option key={r} value={r}>🎁 FREE {r}</option>)}
            </select>
            {selectedLoyaltyReward && <div className="selected-loyalty-reward">✓ FREE {selectedLoyaltyReward} will be added to this order.</div>}
          </div>
        ) : (
          <p className="loyalty-note">Every delivered order of {money(LOYALTY_MIN_BILL)}+ counts. After 6 qualifying orders, your next order can redeem 1 FREE Sugar Reward.</p>
        )}

        {loyaltyLoading && <small className="loyalty-loading">Updating rewards...</small>}
      </section>

      <section className="checkout-card payment-card">
        <div className="section-heading"><div className="section-icon">💳</div><div><span className="section-label">SECURE CHECKOUT</span><h3>Payment Method</h3><p>Choose how you want to pay</p></div></div>
        <label className={`payment-option ${paymentMethod === "Cash on Delivery" ? "active" : ""} ${!store.codEnabled ? "disabled" : ""}`}><div className="payment-icon">💵</div><div className="payment-text"><strong>Cash on Delivery</strong><small>Pay when your order arrives</small></div><input type="radio" disabled={!store.codEnabled} checked={paymentMethod === "Cash on Delivery"} onChange={() => setPaymentMethod("Cash on Delivery")} /></label>
        <label className={`payment-option ${paymentMethod === "Online Payment" ? "active" : ""} ${!store.upiEnabled ? "disabled" : ""}`}><div className="payment-icon">💳</div><div className="payment-text"><strong>Online Payment</strong><small>UPI / Card / Net Banking</small></div><input type="radio" disabled={!store.upiEnabled} checked={paymentMethod === "Online Payment"} onChange={() => setPaymentMethod("Online Payment")} /></label>
        {paymentMethod === "Online Payment" && <div className="upi-payment-box"><strong>🔒 Secure Online Payment</strong><p>UPI, cards and net banking are processed securely by Razorpay.</p></div>}
      </section>

      <section className="checkout-card summary-card">
        <div className="summary-heading"><div className="summary-receipt-icon">🧾</div><div><span className="section-label">YOUR ORDER</span><h3>Order Summary</h3></div></div>
        <div className="summary-row"><span>Subtotal</span><strong>{money(totalPrice)}</strong></div>
        <div className="summary-row"><span>Delivery {orderType === "Delivery" && `(${distance.toFixed(1)} km)`}</span><strong>{money(deliveryCharge)}</strong></div>
        <div className="summary-row"><span>GST</span><strong>{money(gst)}</strong></div>
        {scratchDiscount > 0 && <div className="summary-row discount-row"><span>🎁 Daily Scratch</span><strong>-{money(scratchDiscount)}</strong></div>}
        {rewardFreeItem && <div className="reward-summary">🎁 Daily Scratch: FREE {rewardFreeItem}</div>}
        {selectedLoyaltyReward && <div className="reward-summary loyalty-summary">🎁 Sugar Rewards: FREE {selectedLoyaltyReward}</div>}
        <div className="summary-divider" />
        <div className="grand-total"><span>Total Amount</span><strong>{money(grandTotal)}</strong></div>
        <button type="button" className="place-order-btn" onClick={placeOrder} disabled={orderDisabled}>
          <span>{placingOrder ? "Placing Order..." : orderType === "Takeaway" ? "Place Takeaway Order" : !store.deliveryAvailable ? `Orders available ${store.orderTimingLabel || ""}` : !deliveryAvailable ? "Delivery Not Available" : selectedLoyaltyReward ? "Redeem Reward & Place Order" : "Place Order"}</span>
          {!placingOrder && store.deliveryAvailable && (orderType === "Takeaway" || deliveryAvailable) && <span className="place-order-total">{money(grandTotal)}</span>}
        </button>
        <div className="checkout-secure-note">🔒 Secure checkout • Your payment information is protected</div>
      </section>
    </div>
  );
}
