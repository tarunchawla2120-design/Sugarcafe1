/* =========================================================
   SUGAR CAFE — CHECKOUT FINAL FIXED
   ---------------------------------------------------------
   DELIVERY + TAKEAWAY
   RAZORPAY
   DAILY SCRATCH
   SUGAR REWARDS

   SUGAR REWARD RULE:
   • First 5 completed ₹500+ delivered orders = progress
   • 6th ₹500+ order itself gets Sugar Reward
   • COD OR ONLINE PAYMENT both eligible
   • Sugar Reward is redeemed on the 6th order itself
   • ONLY ONE Sugar Reward per qualifying cycle
   • Daily Scratch is HIDDEN on Sugar Reward order
   • Daily Scratch discount/free item cannot affect
     the Sugar Reward order
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

/* =========================================================
   SUGAR REWARDS
========================================================= */

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
   DAILY SCRATCH REWARDS
========================================================= */

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

/* =========================================================
   HELPERS
========================================================= */

const money = (v) =>
  `₹${Number(v || 0).toFixed(0)}`;

const getQty = (item) =>
  Number(item?.qty ?? item?.quantity ?? 1);

const safeNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const todayKey = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const calculateDistance = (
  lat1,
  lon1,
  lat2,
  lon2
) => {
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

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
};

/* =========================================================
   MAP COMPONENTS
========================================================= */

function MapCenterTracker({ onMoveEnd }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();

      onMoveEnd({
        lat: c.lat,
        lng: c.lng,
      });
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
        map.flyTo(
          [position.lat, position.lng],
          16,
          { duration: 0.8 }
        )
      }
      aria-label="Recenter map"
    >
      ◎
    </button>
  );
}

/* =========================================================
   CHECKOUT
========================================================= */

export default function Checkout() {
  const navigate = useNavigate();

  const store = useStoreSettings();

  const {
    cart,
    totalPrice,
  } = useCart();

  /* =======================================================
     BASIC STATE
  ======================================================= */

  const [orderType, setOrderType] =
    useState("Delivery");

  const [address, setAddress] =
    useState("");

  const [manualAddress, setManualAddress] =
    useState("");

  const [mapCenter, setMapCenter] =
    useState(SHOP_LOCATION);

  const [marker, setMarker] =
    useState(SHOP_LOCATION);

  const [loadingLocation, setLoadingLocation] =
    useState(false);

  const [geocodingManual, setGeocodingManual] =
    useState(false);

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState("Cash on Delivery");

  const [specialNote, setSpecialNote] =
    useState("");

  /* =======================================================
     CUSTOMER
  ======================================================= */

  const [customerProfile, setCustomerProfile] =
    useState(null);

  const [savedAddresses, setSavedAddresses] =
    useState([]);

  /* =======================================================
     LOYALTY
  ======================================================= */

  const [qualifyingOrders, setQualifyingOrders] =
    useState(0);

  const [redeemedLoyaltyRewards, setRedeemedLoyaltyRewards] =
    useState(0);

  const [loyaltyLoading, setLoyaltyLoading] =
    useState(false);

  const [selectedLoyaltyReward, setSelectedLoyaltyReward] =
    useState("");

  /* =======================================================
     DAILY SCRATCH
  ======================================================= */

  const [dailyScratchReward, setDailyScratchReward] =
    useState(null);

  const [dailyScratchRevealed, setDailyScratchRevealed] =
    useState(false);

  const [dailyScratchEligible, setDailyScratchEligible] =
    useState(false);

  const [mapRef, setMapRef] =
    useState(null);

  /* =======================================================
     STORE SETTINGS
  ======================================================= */

  const MAX_DELIVERY_DISTANCE =
    safeNumber(
      store?.maxDeliveryDistanceKm,
      DEFAULT_MAX_DISTANCE
    );

  const DELIVERY_PER_KM =
    safeNumber(
      store?.deliveryPerKm,
      DEFAULT_DELIVERY_PER_KM
    );

  const MIN_DELIVERY_CHARGE =
    safeNumber(
      store?.minDeliveryCharge,
      DEFAULT_MIN_DELIVERY
    );

  const MAX_DELIVERY_CHARGE =
    safeNumber(
      store?.maxDeliveryCharge,
      DEFAULT_MAX_DELIVERY
    );

  /* =======================================================
     LOAD CUSTOMER
  ======================================================= */

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(
          "sugarCafeUser"
        );

      if (raw) {
        const d = JSON.parse(raw);

        const profile = {
          ...d,
          name: d.name || "",
          phone: d.phone || "",
          email: d.email || "",
          customerId: d.customerId || "",
          addresses: Array.isArray(
            d.addresses
          )
            ? d.addresses
            : [],
          guest: d.guest ?? true,
        };

        setCustomerProfile(profile);
        setSavedAddresses(
          profile.addresses
        );

        if (d.paymentMethod) {
          setPaymentMethod(
            d.paymentMethod
          );
        }
      }

      const locRaw =
        localStorage.getItem(
          "userLocation"
        );

      if (locRaw) {
        const loc = JSON.parse(locRaw);

        const lat = safeNumber(
          loc.latitude,
          NaN
        );

        const lng = safeNumber(
          loc.longitude,
          NaN
        );

        if (
          Number.isFinite(lat) &&
          Number.isFinite(lng)
        ) {
          setMarker({
            lat,
            lng,
          });

          setMapCenter({
            lat,
            lng,
          });

          setAddress(
            loc.fullAddress ||
              loc.address ||
              ""
          );
        }
      }
    } catch (e) {
      console.error(
        "Checkout load error:",
        e
      );
    }
  }, []);

  /* =======================================================
     PAYMENT DEFAULT
  ======================================================= */

  useEffect(() => {
    if (
      store?.codEnabled === false &&
      store?.upiEnabled
    ) {
      setPaymentMethod(
        "Online Payment"
      );
    } else if (
      store?.codEnabled !== false
    ) {
      setPaymentMethod(
        "Cash on Delivery"
      );
    }
  }, [
    store?.codEnabled,
    store?.upiEnabled,
  ]);

  /* =======================================================
     CUSTOMER ID
  ======================================================= */

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

  /* =======================================================
     DISTANCE
  ======================================================= */

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
    distance <=
    MAX_DELIVERY_DISTANCE;

  /* =======================================================
     DELIVERY CHARGE
  ======================================================= */

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
      Math.max(
        MIN_DELIVERY_CHARGE,
        km * DELIVERY_PER_KM
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

  /* =======================================================
     LOAD LOYALTY PROGRESS
     
     IMPORTANT:
     qualifyingOrders = ONLY already delivered
     ₹500+ orders.

     Current order is NOT included here.
     Instead, the 6th eligible order is calculated
     separately below.
  ======================================================= */

  const loadLoyaltyProgress =
    useCallback(async () => {
      if (!customerId) {
        setQualifyingOrders(0);
        setRedeemedLoyaltyRewards(0);
        return;
      }

      setLoyaltyLoading(true);

      try {
        const q = query(
          collection(db, "orders"),
          where(
            "customerId",
            "==",
            customerId
          )
        );

        const snap =
          await getDocs(q);

        let qualifying = 0;
        let redeemed = 0;

        snap.docs.forEach((docSnap) => {
          const d = docSnap.data();

          const status = String(
            d.status || ""
          ).toLowerCase();

          const delivered =
            status === "delivered";

          const bill = Number(
            d.total ??
              d.bill ??
              0
          );

          if (
            delivered &&
            bill >= LOYALTY_MIN_BILL
          ) {
            qualifying += 1;
          }

          if (
            d.loyaltyRewardRedeemed ===
              true ||
            Boolean(
              d.loyaltyReward
            )
          ) {
            redeemed += 1;
          }
        });

        setQualifyingOrders(
          qualifying
        );

        setRedeemedLoyaltyRewards(
          redeemed
        );
      } catch (e) {
        console.error(
          "Loyalty progress error:",
          e
        );

        setQualifyingOrders(0);
        setRedeemedLoyaltyRewards(0);
      } finally {
        setLoyaltyLoading(false);
      }
    }, [customerId]);

  useEffect(() => {
    loadLoyaltyProgress();
  }, [loadLoyaltyProgress]);

  /* =======================================================
     CURRENT ORDER LOYALTY LOGIC

     Example:

     Previous delivered qualifying orders = 5
     Current cart = ₹500+
     --------------------------------
     Current order = 6th
     Sugar Reward = UNLOCKED

     Previous delivered qualifying orders = 4
     Current cart = ₹500+
     --------------------------------
     Current order = 5th
     Sugar Reward = LOCKED
  ======================================================= */

  const earnedLoyaltyRewards =
    Math.floor(
      qualifyingOrders /
        LOYALTY_TARGET
    );

  const availablePreviousRewards =
    Math.max(
      0,
      earnedLoyaltyRewards -
        redeemedLoyaltyRewards
    );

  const currentOrderQualifies =
    Number(totalPrice) >=
    LOYALTY_MIN_BILL;

  const isSixthOrder =
    qualifyingOrders %
      LOYALTY_TARGET ===
      LOYALTY_TARGET - 1;

  const sixthOrderRewardUnlocked =
    currentOrderQualifies &&
    isSixthOrder &&
    availablePreviousRewards <= 0;

  /*
    If an already earned reward exists from an
    earlier completed cycle, it should also remain
    redeemable.
  */

  const loyaltyUnlocked =
    sixthOrderRewardUnlocked ||
    availablePreviousRewards > 0;

  /*
    Progress shown on checkout.
  */

  const loyaltyProgress =
    sixthOrderRewardUnlocked
      ? LOYALTY_TARGET
      : qualifyingOrders %
        LOYALTY_TARGET;

  const progressPercent =
    loyaltyUnlocked
      ? 100
      : (
          loyaltyProgress /
          LOYALTY_TARGET
        ) * 100;

  /* =======================================================
     CLEAR SELECTED REWARD WHEN NOT AVAILABLE
  ======================================================= */

  useEffect(() => {
    if (!loyaltyUnlocked) {
      setSelectedLoyaltyReward("");
    }
  }, [loyaltyUnlocked]);

  /* =======================================================
     DAILY SCRATCH

     IMPORTANT:
     If Sugar Reward is unlocked, Daily Scratch
     is completely disabled.

     It cannot give:
     • discount
     • free item
     • scratch reward
  ======================================================= */

  useEffect(() => {
    /*
      6th-order Sugar Reward takes priority.
    */

    if (loyaltyUnlocked) {
      setDailyScratchEligible(false);
      setDailyScratchReward(null);
      setDailyScratchRevealed(false);
      return;
    }

    const eligible =
      Number(totalPrice) >=
      DAILY_SCRATCH_MIN_BILL;

    setDailyScratchEligible(
      eligible
    );

    const key =
      `sugarCafeDailyScratch:` +
      `${customerId || "guest"}:` +
      `${todayKey()}`;

    try {
      const saved =
        sessionStorage.getItem(
          key
        );

      if (saved) {
        const d =
          JSON.parse(saved);

        setDailyScratchReward(
          d.reward || null
        );

        setDailyScratchRevealed(
          Boolean(d.revealed)
        );
      } else {
        setDailyScratchReward(
          null
        );

        setDailyScratchRevealed(
          false
        );
      }
    } catch (e) {
      console.error(
        "Scratch state error:",
        e
      );
    }
  }, [
    customerId,
    totalPrice,
    loyaltyUnlocked,
  ]);

  /* =======================================================
     REVEAL DAILY SCRATCH
  ======================================================= */

  const revealDailyScratch = () => {
    /*
      Never allow Daily Scratch on
      Sugar Reward order.
    */

    if (loyaltyUnlocked) {
      return;
    }

    if (
      !dailyScratchEligible ||
      dailyScratchRevealed
    ) {
      return;
    }

    const reward =
      DAILY_SCRATCH_REWARDS[
        Math.floor(
          Math.random() *
            DAILY_SCRATCH_REWARDS.length
        )
      ];

    setDailyScratchReward(
      reward
    );

    setDailyScratchRevealed(
      true
    );

    try {
      sessionStorage.setItem(
        `sugarCafeDailyScratch:${customerId || "guest"}:${todayKey()}`,
        JSON.stringify({
          reward,
          revealed: true,
        })
      );
    } catch (e) {
      console.error(
        "Scratch save error:",
        e
      );
    }
  };

  /* =======================================================
     DAILY SCRATCH DISCOUNT
     
     ZERO when Sugar Reward is unlocked.
  ======================================================= */

  const scratchDiscount =
    useMemo(() => {
      if (loyaltyUnlocked) {
        return 0;
      }

      if (
        !dailyScratchRevealed ||
        dailyScratchReward?.type !==
          "discount"
      ) {
        return 0;
      }

      return (
        Number(totalPrice) *
        (
          Number(
            dailyScratchReward.discountPercent ||
              0
          ) / 100
        )
      );
    }, [
      loyaltyUnlocked,
      totalPrice,
      dailyScratchReward,
      dailyScratchRevealed,
    ]);

  /* =======================================================
     DAILY SCRATCH FREE ITEM
     
     NULL when Sugar Reward is unlocked.
  ======================================================= */

  const rewardFreeItem =
    useMemo(() => {
      if (loyaltyUnlocked) {
        return null;
      }

      if (
        dailyScratchRevealed &&
        dailyScratchReward?.type ===
          "freeItem"
      ) {
        return (
          dailyScratchReward.itemName
        );
      }

      return null;
    }, [
      loyaltyUnlocked,
      dailyScratchReward,
      dailyScratchRevealed,
    ]);

  /* =======================================================
     TOTAL
  ======================================================= */

  const gst = 0;

  const grandTotal =
    Math.max(
      0,
      Number(totalPrice) +
        Number(deliveryCharge) -
        Number(scratchDiscount) +
        Number(gst)
    );

  /* =======================================================
     REVERSE GEOCODING
  ======================================================= */

  const reverseGeocode =
    useCallback(
      async (lat, lng) => {
        try {
          const r =
            await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
              {
                headers: {
                  Accept:
                    "application/json",
                },
              }
            );

          const d =
            await r.json();

          return (
            d.display_name ||
            `${lat.toFixed(
              6
            )}, ${lng.toFixed(6)}`
          );
        } catch {
          return `${lat.toFixed(
            6
          )}, ${lng.toFixed(6)}`;
        }
      },
      []
    );

  /* =======================================================
     UPDATE LOCATION
  ======================================================= */

  const updateLocation =
    useCallback(
      async (
        location,
        geocode = true
      ) => {
        setMarker(location);
        setMapCenter(location);

        if (geocode) {
          const formatted =
            await reverseGeocode(
              location.lat,
              location.lng
            );

          setAddress(
            formatted
          );

          localStorage.setItem(
            "userLocation",
            JSON.stringify({
              latitude:
                location.lat,
              longitude:
                location.lng,
              address:
                formatted,
              fullAddress:
                formatted,
            })
          );
        }
      },
      [reverseGeocode]
    );

  /* =======================================================
     MAP MOVE
  ======================================================= */

  const handleMapMove =
    useCallback(
      async (center) => {
        await updateLocation(
          center,
          true
        );
      },
      [updateLocation]
    );

  /* =======================================================
     CURRENT LOCATION
  ======================================================= */

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(
        "Your browser does not support location."
      );
      return;
    }

    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          await updateLocation(
            {
              lat:
                p.coords.latitude,
              lng:
                p.coords.longitude,
            },
            true
          );

          if (mapRef) {
            mapRef.flyTo(
              [
                p.coords.latitude,
                p.coords.longitude,
              ],
              16,
              {
                duration: 0.8,
              }
            );
          }
        } finally {
          setLoadingLocation(
            false
          );
        }
      },
      (e) => {
        setLoadingLocation(
          false
        );

        alert(
          e.code === 1
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

  /* =======================================================
     MANUAL ADDRESS
  ======================================================= */

  const useManualAddress =
    async () => {
      const value =
        manualAddress.trim();

      if (!value) {
        alert(
          "Please enter your complete delivery address."
        );
        return;
      }

      setGeocodingManual(
        true
      );

      try {
        const r =
          await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              `${value}, Korba, Chhattisgarh, India`
            )}&limit=1&addressdetails=1`,
            {
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const results =
          await r.json();

        if (!results?.[0]) {
          alert(
            "Address nahi mila. Please complete address enter karein."
          );
          return;
        }

        const lat = safeNumber(
          results[0].lat,
          NaN
        );

        const lng = safeNumber(
          results[0].lon,
          NaN
        );

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          alert(
            "Selected address coordinates nahi mile."
          );
          return;
        }

        const formatted =
          results[0]
            .display_name ||
          value;

        await updateLocation(
          {
            lat,
            lng,
          },
          false
        );

        setAddress(
          formatted
        );

        localStorage.setItem(
          "userLocation",
          JSON.stringify({
            latitude: lat,
            longitude: lng,
            address:
              formatted,
            fullAddress:
              formatted,
          })
        );

        if (mapRef) {
          mapRef.flyTo(
            [lat, lng],
            16,
            {
              duration: 0.8,
            }
          );
        }
      } catch (e) {
        console.error(e);

        alert(
          "Address check nahi ho paya. Please try again."
        );
      } finally {
        setGeocodingManual(
          false
        );
      }
    };

  /* =======================================================
     SAVED ADDRESS
  ======================================================= */

  const selectSavedAddress =
    (saved) => {
      const lat =
        safeNumber(
          saved.latitude,
          NaN
        );

      const lng =
        safeNumber(
          saved.longitude,
          NaN
        );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return;
      }

      const loc = {
        lat,
        lng,
      };

      setMarker(loc);
      setMapCenter(loc);

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

      if (mapRef) {
        mapRef.flyTo(
          [lat, lng],
          16,
          {
            duration: 0.8,
          }
        );
      }
    };

  /* =======================================================
     SAVE CUSTOMER ADDRESS
  ======================================================= */

  const saveCustomerAddress =
    async () => {
      if (
        orderType !==
        "Delivery"
      ) {
        return null;
      }

      const selected = {
        id: String(
          Date.now()
        ),
        label:
          "Delivery Address",
        address:
          address.trim(),
        fullAddress:
          address.trim(),
        latitude:
          Number(marker.lat),
        longitude:
          Number(marker.lng),
        savedAt:
          new Date().toISOString(),
      };

      try {
        const raw =
          localStorage.getItem(
            "sugarCafeUser"
          );

        if (raw) {
          const profile =
            JSON.parse(raw);

          const old =
            Array.isArray(
              profile.addresses
            )
              ? profile.addresses
              : [];

          const exists =
            old.some(
              (a) =>
                Number(
                  a.latitude
                ) ===
                  selected.latitude &&
                Number(
                  a.longitude
                ) ===
                  selected.longitude
            );

          const addresses =
            exists
              ? old
              : [
                  ...old,
                  selected,
                ];

          const updated = {
            ...profile,
            addresses,
            defaultAddress:
              selected,
          };

          localStorage.setItem(
            "sugarCafeUser",
            JSON.stringify(
              updated
            )
          );

          setCustomerProfile(
            updated
          );

          setSavedAddresses(
            addresses
          );
        }
      } catch (e) {
        console.error(
          "Address save error:",
          e
        );
      }

      return selected;
    };

  /* =======================================================
     CUSTOMER DATA
  ======================================================= */

  const getCustomerData =
    () => ({
      userId:
        customerProfile?.userId ||
        customerProfile?.uid ||
        "",

      customerId,

      customerName:
        customerProfile?.name ||
        "Customer",

      customerPhone:
        customerProfile?.phone ||
        "",

      customerEmail:
        customerProfile?.email ||
        "",

      photoURL:
        customerProfile?.photoURL ||
        "",
    });

  /* =======================================================
     SAVE ORDER
  ======================================================= */

  const saveCompletedOrder =
    async (orderData) => {
      const ref =
        await addDoc(
          collection(
            db,
            "orders"
          ),
          orderData
        );

      localStorage.setItem(
        "lastOrderId",
        ref.id
      );

      localStorage.setItem(
        "lastOrderNumber",
        orderData.orderNumber
      );

      localStorage.setItem(
        "lastOrderPaymentStatus",
        orderData.paymentStatus
      );

      return ref;
    };

  /* =======================================================
     RAZORPAY
  ======================================================= */

  const loadRazorpay =
    () =>
      new Promise(
        (resolve) => {
          if (
            window.Razorpay
          ) {
            return resolve(
              true
            );
          }

          const s =
            document.createElement(
              "script"
            );

          s.src =
            "https://checkout.razorpay.com/v1/checkout.js";

          s.onload = () =>
            resolve(true);

          s.onerror = () =>
            resolve(false);

          document.body.appendChild(
            s
          );
        }
      );

  const readApiResponse =
    async (response) => {
      const raw =
        await response.text();

      if (!raw) {
        throw new Error(
          `Payment service returned an empty response (HTTP ${response.status}).`
        );
      }

      try {
        return JSON.parse(
          raw
        );
      } catch {
        throw new Error(
          `Payment service returned an invalid response (HTTP ${response.status}).`
        );
      }
    };

  /* =======================================================
     ONLINE PAYMENT
  ======================================================= */

  const startOnlinePayment =
    async ({
      customer,
      orderData,
      selectedAddress,
    }) => {
      const configured =
        import.meta.env
          .VITE_PAYMENT_API_URL
          ?.trim() ||
        "";

      const baseUrl =
        configured.replace(
          /\/+$/,
          ""
        );

      const createUrl =
        `${baseUrl}/api/payment/create-order`;

      let response;

      try {
        response =
          await fetch(
            createUrl,
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              body: JSON.stringify(
                {
                  orderData,

                  selectedAddress:
                    selectedAddress
                      ? {
                          ...selectedAddress,
                          distance:
                            Number(
                              orderData.distance ||
                                0
                            ),
                        }
                      : null,
                }
              ),
            }
          );
      } catch (e) {
        throw new Error(
          `Payment server se connection nahi ho paya. ${
            e?.message || ""
          }`
        );
      }

      const data =
        await readApiResponse(
          response
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            `Payment server error (${response.status}).`
        );
      }

      if (
        !data?.keyId ||
        !data?.orderId ||
        !data?.amount
      ) {
        throw new Error(
          "Payment server ne valid Razorpay order nahi diya."
        );
      }

      if (
        !(await loadRazorpay())
      ) {
        throw new Error(
          "Razorpay checkout load nahi ho paya."
        );
      }

      await new Promise(
        (
          resolve,
          reject
        ) => {
          let settled =
            false;

          const ok = () => {
            if (!settled) {
              settled =
                true;

              resolve();
            }
          };

          const fail = (
            e
          ) => {
            if (!settled) {
              settled =
                true;

              reject(e);
            }
          };

          const razorpay =
            new window.Razorpay(
              {
                key:
                  data.keyId,

                amount:
                  Number(
                    data.amount
                  ),

                currency:
                  data.currency ||
                  "INR",

                name:
                  "Sugar Cafe",

                description:
                  `Sugar Cafe Order ${orderData.orderNumber}`,

                order_id:
                  data.orderId,

                prefill: {
                  name:
                    customer.customerName ||
                    "",

                  email:
                    customer.customerEmail ||
                    "",

                  contact:
                    customer.customerPhone ||
                    "",
                },

                handler:
                  async (
                    rp
                  ) => {
                    try {
                      const verify =
                        await fetch(
                          `${baseUrl}/api/payment/verify`,
                          {
                            method:
                              "POST",

                            headers: {
                              "Content-Type":
                                "application/json",

                              Accept:
                                "application/json",
                            },

                            body: JSON.stringify(
                              {
                                razorpayOrderId:
                                  rp.razorpay_order_id,

                                razorpayPaymentId:
                                  rp.razorpay_payment_id,

                                razorpaySignature:
                                  rp.razorpay_signature,
                              }
                            ),
                          }
                        );

                      const verifyData =
                        await readApiResponse(
                          verify
                        );

                      if (
                        !verify.ok ||
                        !verifyData.verified
                      ) {
                        throw new Error(
                          verifyData?.error ||
                            "Payment verification failed."
                        );
                      }

                      if (
                        !verifyData.finalized
                      ) {
                        await saveCompletedOrder(
                          {
                            ...orderData,

                            paymentMethod:
                              "Online Payment",

                            paymentStatus:
                              "Paid",

                            paymentNote:
                              "Paid and verified by Razorpay.",

                            razorpayOrderId:
                              rp.razorpay_order_id,

                            razorpayPaymentId:
                              rp.razorpay_payment_id,

                            razorpaySignature:
                              rp.razorpay_signature,
                          }
                        );
                      }

                      ok();
                    } catch (e) {
                      fail(e);
                    }
                  },

                modal: {
                  ondismiss:
                    () =>
                      fail(
                        new Error(
                          "Payment cancelled."
                        )
                      ),
                },
              }
            );

          razorpay.on(
            "payment.failed",
            (r) =>
              fail(
                new Error(
                  r?.error
                    ?.description ||
                    "Payment failed. Please try again."
                )
              )
          );

          try {
            razorpay.open();
          } catch (e) {
            fail(e);
          }
        }
      );
    };

  /* =======================================================
     PLACE ORDER
  ======================================================= */

  const placeOrder =
    async () => {
      if (
        !store.deliveryAvailable
      ) {
        alert(
          store.announcement ||
            `Orders are unavailable ${
              store.orderTimingLabel ||
              ""
            }.`
        );

        return;
      }

      if (
        paymentMethod ===
          "Online Payment" &&
        !store.upiEnabled
      ) {
        alert(
          "Online payment is currently unavailable."
        );

        return;
      }

      if (
        paymentMethod ===
          "Cash on Delivery" &&
        !store.codEnabled
      ) {
        alert(
          "Cash on Delivery is currently unavailable."
        );

        return;
      }

      if (!cart.length) {
        alert(
          "Your cart is empty."
        );

        return;
      }

      if (
        !customerProfile?.name ||
        !customerProfile?.phone
      ) {
        alert(
          "Please enter your name and mobile number before placing the order."
        );

        navigate(
          "/login",
          {
            state: {
              from:
                "/checkout",
            },
          }
        );

        return;
      }

      const customer =
        getCustomerData();

      if (
        !customer.customerPhone
      ) {
        alert(
          "Mobile number is required."
        );

        return;
      }

      if (
        orderType ===
        "Delivery"
      ) {
        if (
          !address.trim()
        ) {
          alert(
            "Please select your delivery address."
          );

          return;
        }

        if (
          !deliveryAvailable
        ) {
          alert(
            `Sorry! We currently deliver within ${MAX_DELIVERY_DISTANCE} km.`
          );

          return;
        }
      }

      /* =====================================================
         SUGAR REWARD VALIDATION

         Reward is allowed ONLY when:
         • existing available reward exists
           OR
         • this is the 6th ₹500+ order
      ===================================================== */

      if (
        selectedLoyaltyReward &&
        !loyaltyUnlocked
      ) {
        alert(
          "Sugar Reward is not unlocked yet."
        );

        return;
      }

      if (
        loyaltyUnlocked &&
        !selectedLoyaltyReward
      ) {
        alert(
          "Please select your FREE Sugar Reward."
        );

        return;
      }

      try {
        setPlacingOrder(
          true
        );

        /* ===================================================
           NORMAL CART ITEMS
        =================================================== */

        const orderItems =
          cart.map(
            (item) => ({
              id:
                item.id || "",

              name:
                item.name || "",

              price:
                Number(
                  item.price || 0
                ),

              qty:
                getQty(item),

              image:
                item.image || "",

              category:
                item.category ||
                "",
            })
          );

        /* ===================================================
           DAILY SCRATCH FREE ITEM

           WILL NEVER BE ADDED WHEN SUGAR REWARD IS ACTIVE.
        =================================================== */

        if (
          !loyaltyUnlocked &&
          rewardFreeItem
        ) {
          orderItems.push({
            id:
              `daily-reward-${Date.now()}`,

            name:
              `🎁 FREE ${rewardFreeItem}`,

            price: 0,

            qty: 1,

            image:
              cart.find(
                (i) =>
                  String(
                    i.name
                  ).toLowerCase() ===
                  String(
                    rewardFreeItem
                  ).toLowerCase()
              )?.image || "",

            category:
              "Daily Reward",

            reward: true,

            rewardType:
              "dailyScratch",
          });
        }

        /* ===================================================
           SUGAR REWARD

           ONLY ONE FREE ITEM.
        =================================================== */

        if (
          loyaltyUnlocked &&
          selectedLoyaltyReward
        ) {
          orderItems.push({
            id:
              `loyalty-reward-${Date.now()}`,

            name:
              `🎁 FREE ${selectedLoyaltyReward}`,

            price: 0,

            qty: 1,

            image:
              cart.find(
                (i) =>
                  String(
                    i.name
                  ).toLowerCase() ===
                  String(
                    selectedLoyaltyReward
                  ).toLowerCase()
              )?.image || "",

            category:
              "Sugar Rewards",

            reward: true,

            rewardType:
              "loyalty",
          });
        }

        /* ===================================================
           ORDER NUMBER
        =================================================== */

        const orderNumber =
          `SC-${Date.now()}`;

        const selectedAddress =
          await saveCustomerAddress();

        /* ===================================================
           FINAL ORDER DATA
        =================================================== */

        const orderData = {
          orderNumber,

          userId:
            customer.userId,

          customerId:
            customer.customerId ||
            customerId,

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
            orderType ===
            "Delivery"
              ? address
              : "Takeaway — Pickup from Sugar Cafe",

          latitude:
            orderType ===
            "Delivery"
              ? marker.lat
              : null,

          longitude:
            orderType ===
            "Delivery"
              ? marker.lng
              : null,

          distance:
            orderType ===
            "Delivery"
              ? Number(
                  distance.toFixed(
                    2
                  )
                )
              : 0,

          specialNote:
            specialNote.trim(),

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

          items:
            orderItems,

          subtotal:
            Number(
              totalPrice
            ),

          deliveryCharge:
            Number(
              deliveryCharge
            ),

          discount:
            Number(
              scratchDiscount
            ),

          gst:
            Number(gst),

          total:
            Number(
              grandTotal
            ),

          /* =================================================
             DAILY SCRATCH

             Empty when Sugar Reward is active.
          ================================================= */

          dailyScratchReward:
            loyaltyUnlocked
              ? ""
              : dailyScratchReward?.title ||
                "",

          /* =================================================
             SUGAR REWARD
          ================================================= */

          loyaltyReward:
            selectedLoyaltyReward ||
            "",

          loyaltyRewardRedeemed:
            Boolean(
              selectedLoyaltyReward
            ),

          loyaltyRewardNumber:
            selectedLoyaltyReward
              ? Math.max(
                  1,
                  availablePreviousRewards ||
                    (sixthOrderRewardUnlocked
                      ? 1
                      : 0)
                )
              : 0,

          /* =================================================
             ORDER STATUS
          ================================================= */

          status:
            "New",

          preparationMinutes:
            Number(
              store.preparationMinutes ??
                15
            ),

          preparationStartedAt:
            null,

          preparationEndAt:
            null,

          foodReadyAt:
            null,

          dispatchedAt:
            null,

          deliveredAt:
            null,

          createdAt:
            Timestamp.now(),
        };

        /* ===================================================
           ONLINE PAYMENT
        =================================================== */

        if (
          paymentMethod ===
          "Online Payment"
        ) {
          await startOnlinePayment(
            {
              customer,
              orderData,
              selectedAddress,
            }
          );
        } else {
          /* ================================================
             COD
          ================================================= */

          await saveCompletedOrder(
            orderData
          );
        }

        /* ===================================================
           SUCCESS
        =================================================== */

        if (
          selectedLoyaltyReward
        ) {
          alert(
            `🎉 Order placed!\n\nYour Sugar Reward "${selectedLoyaltyReward}" has been added FREE to this order.`
          );
        } else {
          alert(
            "🎉 Order Placed Successfully!"
          );
        }

        navigate(
          "/success"
        );
      } catch (e) {
        console.error(
          "Order placement error:",
          e
        );

        alert(
          `Order place nahi ho paya.\n\n${
            e?.message ||
            "Unknown error"
          }`
        );
      } finally {
        setPlacingOrder(
          false
        );
      }
    };

  /* =======================================================
     BUTTON DISABLED
  ======================================================= */

  const orderDisabled =
    !store.deliveryAvailable ||
    placingOrder ||
    (orderType ===
      "Delivery" &&
      !deliveryAvailable);

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="checkout-page">

      {/* ===================================================
          STORE STATUS
      =================================================== */}

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
            : store.orderTimingLabel ||
              ""}
        </span>
      </div>

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="checkout-header">

        <button
          type="button"
          className="checkout-back-btn"
          onClick={() =>
            navigate(-1)
          }
        >
          ←
        </button>

        <div className="checkout-header-content">
          <span className="checkout-brand">
            SUGAR CAFE
          </span>

          <h1>
            Checkout
          </h1>

          <p>
            Almost there! Your delicious
            food is one step away ✨
          </p>
        </div>

        <div className="secure-badge">
          <span>✓</span>

          <div>
            <strong>
              100%
            </strong>

            <small>
              Secure
            </small>
          </div>
        </div>
      </header>

      {/* ===================================================
          ORDER TYPE
      =================================================== */}

      <section className="checkout-card">

        <div className="section-heading">

          <div className="section-icon">
            🛵
          </div>

          <div>
            <span className="section-label">
              CHOOSE YOUR OPTION
            </span>

            <h3>
              Order Type
            </h3>

            <p>
              How would you like to receive
              your order?
            </p>
          </div>

        </div>

        <div className="order-type-grid">

          {[
            "Delivery",
            "Takeaway",
          ].map(
            (type) => (
              <button
                key={type}
                type="button"
                className={`order-type-option ${
                  orderType === type
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setOrderType(
                    type
                  )
                }
              >
                <div className="option-top">

                  <span className="option-emoji">
                    {type ===
                    "Delivery"
                      ? "🛵"
                      : "🛍️"}
                  </span>

                  <span className="option-radio">
                    {orderType ===
                    type
                      ? "✓"
                      : ""}
                  </span>

                </div>

                <strong>
                  {type}
                </strong>

                <small>
                  {type ===
                  "Delivery"
                    ? "We deliver to your location"
                    : "Pick up from our cafe"}
                </small>

              </button>
            )
          )}

        </div>
      </section>

      {/* ===================================================
          DELIVERY
      =================================================== */}

      {orderType ===
        "Delivery" && (
        <section className="checkout-card delivery-card">

          <div className="section-heading">

            <div className="section-icon">
              📍
            </div>

            <div>
              <span className="section-label">
                DELIVERY
              </span>

              <h3>
                Delivery Location
              </h3>

              <p>
                Your location is detected
                automatically
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

          {/* CUSTOMER */}

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
                  {
                    customerProfile.phone
                  }
                </span>

                {customerProfile.email && (
                  <span>
                    ✉️{" "}
                    {
                      customerProfile.email
                    }
                  </span>
                )}

              </div>

              <div className="customer-check">
                ✓
              </div>

            </div>
          )}

          {/* SAVED ADDRESSES */}

          {savedAddresses.length >
            0 && (
            <div className="saved-addresses">

              <div className="saved-heading">
                <strong>
                  Saved Addresses
                </strong>

                <span>
                  Tap to use
                </span>
              </div>

              <div className="saved-address-list">

                {savedAddresses.map(
                  (
                    saved,
                    i
                  ) => (
                    <button
                      type="button"
                      key={
                        saved.id ||
                        i
                      }
                      className="saved-address-btn"
                      onClick={() =>
                        selectSavedAddress(
                          saved
                        )
                      }
                    >
                      <span>
                        📍
                      </span>

                      <span className="saved-address-text">

                        <strong>
                          {saved.label ||
                            "Delivery Address"}
                        </strong>

                        <small>
                          {saved.fullAddress ||
                            saved.address}
                        </small>

                      </span>

                      <span>
                        →
                      </span>

                    </button>
                  )
                )}

              </div>
            </div>
          )}

          {/* MANUAL ADDRESS */}

          <div className="manual-address-box">

            <label>
              Search / enter your delivery
              address
            </label>

            <input
              value={
                manualAddress
              }
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
              disabled={
                geocodingManual
              }
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
            <span>
              ◎
            </span>

            <span>
              {loadingLocation
                ? "Getting Location..."
                : "Use My Current Location"}
            </span>

            <span>
              →
            </span>
          </button>

          {/* MAP */}

          <div className="checkout-map-wrapper">

            <MapContainer
              center={[
                mapCenter.lat,
                mapCenter.lng,
              ]}
              zoom={15}
              scrollWheelZoom={
                false
              }
              className="checkout-map"
              whenReady={(e) =>
                setMapRef(
                  e.target
                )
              }
            >

              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapCenterTracker
                onMoveEnd={
                  handleMapMove
                }
              />

              <MapRecenter
                position={
                  marker
                }
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

            <div>
              📍
            </div>

            <div>
              <strong>
                Your delivery location
              </strong>

              <p>
                Move the map
