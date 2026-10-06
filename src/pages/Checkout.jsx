/* =========================================================
   SUGAR CAFE — CHECKOUT FINAL
   DELIVERY + TAKEAWAY
   LEAFLET + OPENSTREETMAP
   GPS LOCATION REQUIRED FOR DELIVERY RADIUS
   MANUAL COMPLETE ADDRESS REQUIRED FOR BILL/KOT
   RAZORPAY
   DAILY SCRATCH
   SUGAR REWARDS — 6TH QUALIFYING ORDER

   FINAL DELIVERY RULES
   ---------------------------------------------------------
   DELIVERY:
   - Minimum delivery order: ₹169
   - Takeaway has NO ₹169 minimum
   - 0–2 KM: ₹50 delivery charge
   - Above 2 KM: ₹20/KM
   - Maximum delivery charge: ₹149
   - Maximum delivery radius: 8 KM

   IMPORTANT
   ---------------------------------------------------------
   DELIVERY FLOW:

   1. Customer MUST use "Use My Current Location".
   2. GPS coordinates are used ONLY for delivery radius.
   3. Customer MUST type complete delivery address manually.
   4. Manual address is saved exactly for bill/KOT.
   5. GPS reverse geocoding provides Area / City / PIN
      as additional location information.
   6. Moving the map does NOT change the verified GPS.
   7. Order cannot be placed without:
      - GPS verification
      - Complete manual address
      - Delivery within allowed radius
      - Minimum ₹169 item total

   GPS:
   - latitude
   - longitude
   - accuracy

   ADDRESS:
   - deliveryAddress
   - deliveryArea
   - deliveryCity
   - deliveryPostcode
   - deliveryFullAddress
========================================================= */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MapContainer,
  TileLayer,
  useMap,
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
   SHOP LOCATION
========================================================= */

const SHOP_LOCATION = {
  lat: 22.417212,
  lng: 82.665984,
};

/* =========================================================
   FINAL DELIVERY RULES
========================================================= */

const MIN_ORDER_AMOUNT = 169;

const MAX_DELIVERY_DISTANCE = 8;

const DELIVERY_PER_KM = 20;

const MIN_DELIVERY_CHARGE = 50;

const MAX_DELIVERY_CHARGE = 149;

/* =========================================================
   LOYALTY
========================================================= */

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

const money = (value) =>
  `₹${Number(value || 0).toFixed(0)}`;

const getQty = (item) =>
  Number(item?.qty ?? item?.quantity ?? 1);

const todayKey = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

/* =========================================================
   DISTANCE
========================================================= */

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
   FIRESTORE TIMESTAMP
========================================================= */

const getTimestampMillis = (value) => {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const n = Number(value);

  if (Number.isFinite(n)) {
    return n;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

/* =========================================================
   MAP RECENTER BUTTON
========================================================= */

function MapRecenter({ position }) {
  const map = useMap();

  return (
    <button
      type="button"
      className="map-recenter-control"
      onClick={() =>
        map.flyTo(
          [position.lat, position.lng],
          17,
          {
            duration: 0.8,
          }
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

  const { cart, totalPrice } = useCart();

  /* =======================================================
     ORDER
  ======================================================= */

  const [orderType, setOrderType] =
    useState("Delivery");

  /*
   * IMPORTANT:
   * `address` is the customer's MANUAL address.
   * It is never replaced by Nominatim.
   */
  const [address, setAddress] =
    useState("");

  const [manualAddress, setManualAddress] =
    useState("");

  /* =======================================================
     LOCATION
  ======================================================= */

  const [mapCenter, setMapCenter] =
    useState(SHOP_LOCATION);

  const [marker, setMarker] =
    useState(SHOP_LOCATION);

  const [loadingLocation, setLoadingLocation] =
    useState(false);

  const [geocodingManual, setGeocodingManual] =
    useState(false);

  /*
   * GPS verification is intentionally NOT restored
   * from localStorage.
   *
   * Customer must press:
   * "Use My Current Location"
   */
  const [gpsVerified, setGpsVerified] =
    useState(false);

  const [gpsAccuracy, setGpsAccuracy] =
    useState(null);

  const [locationArea, setLocationArea] =
    useState("");

  const [locationCity, setLocationCity] =
    useState("");

  const [locationPostcode, setLocationPostcode] =
    useState("");

  const [locationState, setLocationState] =
    useState("");

  const [locationFullAddress, setLocationFullAddress] =
    useState("");

  /* =======================================================
     PAYMENT / ORDER
  ======================================================= */

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

  const [
    redeemedLoyaltyRewards,
    setRedeemedLoyaltyRewards,
  ] = useState(0);

  const [loyaltyLoading, setLoyaltyLoading] =
    useState(false);

  const [
    selectedLoyaltyReward,
    setSelectedLoyaltyReward,
  ] = useState("");

  /* =======================================================
     DAILY SCRATCH
  ======================================================= */

  const [dailyScratchReward, setDailyScratchReward] =
    useState(null);

  const [dailyScratchRevealed, setDailyScratchRevealed] =
    useState(false);

  const [dailyScratchEligible, setDailyScratchEligible] =
    useState(false);

  /* =======================================================
     MAP REFERENCE
  ======================================================= */

  const [mapRef, setMapRef] =
    useState(null);

  /* =======================================================
     GEOCODING REFS
  ======================================================= */

  const reverseGeocodeTimer =
    useRef(null);

  const reverseGeocodeController =
    useRef(null);

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

          customerId:
            d.customerId ||
            d.id ||
            d.uid ||
            "",

          addresses:
            Array.isArray(d.addresses)
              ? d.addresses
              : [],

          guest:
            d.guest ?? true,
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
    } catch (error) {
      console.error(
        "Checkout customer load error:",
        error
      );
    }
  }, []);

  /* =======================================================
     DO NOT TRUST OLD GPS LOCATION
  ======================================================= */

  useEffect(() => {
    /*
     * We intentionally do NOT mark old localStorage
     * coordinates as verified GPS.
     *
     * Customer must press:
     * "Use My Current Location"
     */
    setGpsVerified(false);
    setGpsAccuracy(null);
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

  /*
   * IMPORTANT:
   * Delivery radius is valid ONLY after current GPS
   * has been explicitly verified.
   */
  const deliveryAvailable =
    gpsVerified &&
    distance <=
      MAX_DELIVERY_DISTANCE;

  /* =======================================================
     DELIVERY CHARGE — FINAL RULE
     
     0–2 KM       = ₹50
     Above 2 KM   = ₹20/KM
     Maximum      = ₹149
  ======================================================= */

  const deliveryCharge = useMemo(() => {
    if (
      orderType !== "Delivery" ||
      !gpsVerified ||
      !deliveryAvailable ||
      Number(totalPrice) <= 0
    ) {
      return 0;
    }

    const km = Number(distance);

    if (
      !Number.isFinite(km) ||
      km < 0
    ) {
      return 0;
    }

    /*
     * 0–2 KM = ₹50
     */
    if (km <= 2) {
      return MIN_DELIVERY_CHARGE;
    }

    /*
     * Above 2 KM = ₹20/KM
     *
     * Math.ceil means:
     * 2.1 KM -> 3 KM -> ₹60
     * 3.1 KM -> 4 KM -> ₹80
     */
    const calculatedCharge =
      Math.ceil(km) *
      DELIVERY_PER_KM;

    /*
     * Minimum ₹50
     * Maximum ₹149
     */
    return Math.min(
      MAX_DELIVERY_CHARGE,
      Math.max(
        MIN_DELIVERY_CHARGE,
        calculatedCharge
      )
    );
  }, [
    orderType,
    gpsVerified,
    deliveryAvailable,
    totalPrice,
    distance,
  ]);

  /* =======================================================
     LOYALTY PROGRESS
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

        const snap =
          await getDocs(q);

        const qualifying = [];

        let redeemed = 0;

        snap.docs.forEach(
          (docSnap) => {
            const d =
              docSnap.data();

            const status =
              String(
                d.status || ""
              ).toLowerCase();

            const bill =
              Number(
                d.total ??
                  d.bill ??
                  0
              );

            if (
              status ===
                "delivered" &&
              bill >=
                LOYALTY_MIN_BILL
            ) {
              qualifying.push({
                id: docSnap.id,

                createdAt:
                  d.createdAt ||
                  null,
              });
            }

            if (
              status ===
                "delivered" &&
              d.loyaltyRewardRedeemed ===
                true &&
              String(
                d.loyaltyReward ||
                  ""
              ).trim()
            ) {
              redeemed += 1;
            }
          }
        );

        qualifying.sort(
          (a, b) =>
            getTimestampMillis(
              a.createdAt
            ) -
            getTimestampMillis(
              b.createdAt
            )
        );

        const count =
          qualifying.length;

        const completedCycles =
          Math.floor(
            count /
              LOYALTY_TARGET
          );

        const validRedeemed =
          Math.min(
            redeemed,
            completedCycles
          );

        setQualifyingOrders(
          count
        );

        setRedeemedLoyaltyRewards(
          validRedeemed
        );
      } catch (error) {
        console.error(
          "Loyalty progress error:",
          error
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
     LOYALTY CALCULATION
  ======================================================= */

  const currentOrderQualifies =
    Number(totalPrice) >=
    LOYALTY_MIN_BILL;

  const completedCycles =
    Math.floor(
      qualifyingOrders /
        LOYALTY_TARGET
    );

  const availablePreviousRewards =
    Math.max(
      0,
      completedCycles -
        redeemedLoyaltyRewards
    );

  const isSixthOrder =
    qualifyingOrders %
      LOYALTY_TARGET ===
    LOYALTY_TARGET - 1;

  const sixthOrderRewardUnlocked =
    currentOrderQualifies &&
    isSixthOrder &&
    availablePreviousRewards ===
      0;

  const loyaltyUnlocked =
    sixthOrderRewardUnlocked ||
    availablePreviousRewards > 0;

  const loyaltyProgress =
    sixthOrderRewardUnlocked
      ? LOYALTY_TARGET
      : qualifyingOrders %
        LOYALTY_TARGET;

  const progressPercent =
    loyaltyUnlocked
      ? 100
      : Math.min(
          100,
          (loyaltyProgress /
            LOYALTY_TARGET) *
            100
        );

  useEffect(() => {
    if (!loyaltyUnlocked) {
      setSelectedLoyaltyReward(
        ""
      );
    }
  }, [loyaltyUnlocked]);

  /* =======================================================
     DAILY SCRATCH
  ======================================================= */

  useEffect(() => {
    if (loyaltyUnlocked) {
      setDailyScratchEligible(
        false
      );

      setDailyScratchReward(
        null
      );

      setDailyScratchRevealed(
        false
      );

      return;
    }

    const eligible =
      Number(totalPrice) >=
      DAILY_SCRATCH_MIN_BILL;

    setDailyScratchEligible(
      eligible
    );

    if (!eligible) {
      setDailyScratchReward(
        null
      );

      setDailyScratchRevealed(
        false
      );

      return;
    }

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
        const data =
          JSON.parse(saved);

        setDailyScratchReward(
          data.reward || null
        );

        setDailyScratchRevealed(
          Boolean(
            data.revealed
          )
        );
      } else {
        setDailyScratchReward(
          null
        );

        setDailyScratchRevealed(
          false
        );
      }
    } catch (error) {
      console.error(
        "Scratch state error:",
        error
      );

      setDailyScratchReward(
        null
      );

      setDailyScratchRevealed(
        false
      );
    }
  }, [
    customerId,
    totalPrice,
    loyaltyUnlocked,
  ]);

  /* =======================================================
     REVEAL SCRATCH
  ======================================================= */

  const revealDailyScratch = () => {
    if (
      loyaltyUnlocked ||
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
        `sugarCafeDailyScratch:${
          customerId || "guest"
        }:${todayKey()}`,
        JSON.stringify({
          reward,
          revealed: true,
        })
      );
    } catch (error) {
      console.error(
        "Scratch save error:",
        error
      );
    }
  };

  /* =======================================================
     SCRATCH DISCOUNT
  ======================================================= */

  const scratchDiscount = useMemo(() => {
    if (
      loyaltyUnlocked ||
      !dailyScratchRevealed ||
      dailyScratchReward?.type !==
        "discount"
    ) {
      return 0;
    }

    return (
      Number(totalPrice) *
      (Number(
        dailyScratchReward.discountPercent ||
          0
      ) /
        100)
    );
  }, [
    loyaltyUnlocked,
    totalPrice,
    dailyScratchReward,
    dailyScratchRevealed,
  ]);

  /* =======================================================
     FREE DAILY ITEM
  ======================================================= */

  const rewardFreeItem = useMemo(() => {
    if (
      loyaltyUnlocked ||
      !dailyScratchRevealed ||
      dailyScratchReward?.type !==
        "freeItem"
    ) {
      return null;
    }

    return (
      dailyScratchReward.itemName ||
      null
    );
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

  const reverseGeocode = useCallback(
    async (
      lat,
      lng,
      signal
    ) => {
      try {
        const response =
          await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
              lat
            )}&lon=${encodeURIComponent(
              lng
            )}&zoom=18&addressdetails=1&accept-language=en`,
            {
              headers: {
                Accept:
                  "application/json",
              },

              signal,
            }
          );

        if (!response.ok) {
          throw new Error(
            "Reverse geocoding failed"
          );
        }

        const data =
          await response.json();

        const a =
          data?.address ||
          {};

        const area =
          a.suburb ||
          a.neighbourhood ||
          a.quarter ||
          a.village ||
          a.city_district ||
          a.residential ||
          a.town ||
          data?.name ||
          "";

        const city =
          a.city ||
          a.town ||
          a.municipality ||
          a.county ||
          "";

        const state =
          a.state ||
          "";

        const postcode =
          a.postcode ||
          "";

        const fullAddress =
          data?.display_name ||
          [
            area,
            city,
            state,
            postcode,
          ]
            .filter(Boolean)
            .join(", ");

        return {
          area,
          city,
          state,
          postcode,
          fullAddress:
            fullAddress || "",
        };
      } catch (error) {
        if (
          error?.name ===
          "AbortError"
        ) {
          return null;
        }

        console.error(
          "Reverse geocode error:",
          error
        );

        return {
          area:
            "Current Location",
          city: "",
          state: "",
          postcode: "",
          fullAddress:
            "",
        };
      }
    },
    []
  );

  /* =======================================================
     SAVE GPS LOCATION
  ======================================================= */

  const saveGpsLocation =
    useCallback(
      async ({
        lat,
        lng,
        accuracy,
        geocode = true,
      }) => {
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          return;
        }

        const location = {
          lat,
          lng,
        };

        setGpsVerified(true);

        setGpsAccuracy(
          Number.isFinite(
            Number(accuracy)
          )
            ? Number(
                accuracy
              )
            : null
        );

        setMarker(location);
        setMapCenter(location);

        try {
          const oldRaw =
            localStorage.getItem(
              "userLocation"
            );

          const old =
            oldRaw
              ? JSON.parse(
                  oldRaw
                )
              : {};

          localStorage.setItem(
            "userLocation",
            JSON.stringify({
              ...old,

              latitude:
                lat,

              longitude:
                lng,

              gpsVerified:
                true,

              gpsAccuracy:
                Number.isFinite(
                  Number(
                    accuracy
                  )
                )
                  ? Number(
                      accuracy
                    )
                  : null,

              gpsVerifiedAt:
                new Date().toISOString(),
            })
          );
        } catch (error) {
          console.error(
            "GPS storage error:",
            error
          );
        }

        if (
          reverseGeocodeTimer.current
        ) {
          clearTimeout(
            reverseGeocodeTimer.current
          );
        }

        if (
          reverseGeocodeController.current
        ) {
          reverseGeocodeController.current.abort();
        }

        if (!geocode) {
          return;
        }

        const controller =
          new AbortController();

        reverseGeocodeController.current =
          controller;

        const result =
          await reverseGeocode(
            lat,
            lng,
            controller.signal
          );

        if (!result) {
          return;
        }

        setLocationArea(
          result.area || ""
        );

        setLocationCity(
          result.city || ""
        );

        setLocationState(
          result.state || ""
        );

        setLocationPostcode(
          result.postcode || ""
        );

        setLocationFullAddress(
          result.fullAddress || ""
        );

        try {
          const oldRaw =
            localStorage.getItem(
              "userLocation"
            );

          const old =
            oldRaw
              ? JSON.parse(
                  oldRaw
                )
              : {};

          localStorage.setItem(
            "userLocation",
            JSON.stringify({
              ...old,

              latitude:
                lat,

              longitude:
                lng,

              gpsVerified:
                true,

              gpsAccuracy:
                Number.isFinite(
                  Number(
                    accuracy
                  )
                )
                  ? Number(
                      accuracy
                    )
                  : null,

              gpsVerifiedAt:
                new Date().toISOString(),

              gpsArea:
                result.area ||
                "",

              gpsCity:
                result.city ||
                "",

              gpsState:
                result.state ||
                "",

              gpsPostcode:
                result.postcode ||
                "",

              gpsFullAddress:
                result.fullAddress ||
                "",
            })
          );
        } catch (error) {
          console.error(
            "GPS address storage error:",
            error
          );
        }
      },
      [reverseGeocode]
    );

  /* =======================================================
     CURRENT GPS LOCATION
  ======================================================= */

  const getCurrentLocation = () => {
    if (
      !navigator.geolocation
    ) {
      alert(
        "Your browser does not support location."
      );

      return;
    }

    setLoadingLocation(
      true
    );

    if (
      reverseGeocodeController.current
    ) {
      reverseGeocodeController.current.abort();
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat =
            Number(
              position.coords
                .latitude
            );

          const lng =
            Number(
              position.coords
                .longitude
            );

          const accuracy =
            Number(
              position.coords
                .accuracy
            );

          if (
            !Number.isFinite(
              lat
            ) ||
            !Number.isFinite(
              lng
            )
          ) {
            throw new Error(
              "Invalid GPS coordinates"
            );
          }

          await saveGpsLocation({
            lat,
            lng,
            accuracy,
            geocode: true,
          });

          if (mapRef) {
            mapRef.flyTo(
              [lat, lng],
              17,
              {
                duration: 0.8,
              }
            );
          }
        } catch (error) {
          console.error(
            "Current location error:",
            error
          );

          setGpsVerified(
            false
          );

          alert(
            "Unable to set your current location. Please try again."
          );
        } finally {
          setLoadingLocation(
            false
          );
        }
      },
      (error) => {
        setLoadingLocation(
          false
        );

        setGpsVerified(
          false
        );

        if (
          error.code === 1
        ) {
          alert(
            "📍 Location permission denied.\n\nPlease allow Location permission in your browser settings and try again."
          );
        } else if (
          error.code === 2
        ) {
          alert(
            "📍 Your exact location could not be detected.\n\nPlease turn ON Location Services and try again."
          );
        } else if (
          error.code === 3
        ) {
          alert(
            "📍 Location request timed out.\n\nPlease try again in an open area."
          );
        } else {
          alert(
            "📍 Unable to get your current location. Please try again."
          );
        }
      },
      {
        enableHighAccuracy:
          true,

        timeout:
          25000,

        maximumAge:
          0,
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
          "🏠 Please enter your complete delivery address."
        );

        return;
      }

      if (
        value.length < 10
      ) {
        alert(
          "🏠 Please enter a more complete address.\n\nInclude House/Flat No., Street/Area and Landmark."
        );

        return;
      }

      setGeocodingManual(
        true
      );

      try {
        setAddress(
          value
        );

        const oldRaw =
          localStorage.getItem(
            "userLocation"
          );

        const old =
          oldRaw
            ? JSON.parse(
                oldRaw
              )
            : {};

        localStorage.setItem(
          "userLocation",
          JSON.stringify({
            ...old,

            address:
              value,

            deliveryAddress:
              value,

            latitude:
              marker.lat,

            longitude:
              marker.lng,

            gpsVerified:
              gpsVerified,
          })
        );

        if (!gpsVerified) {
          alert(
            "Address saved, but GPS location is still required.\n\nPlease tap 'Use My Current Location' to check delivery availability."
          );

          return;
        }

        alert(
          "✓ Delivery address added successfully."
        );
      } catch (error) {
        console.error(
          "Manual address error:",
          error
        );

        alert(
          "Address save nahi ho paya. Please try again."
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
    async (saved) => {
      const savedText =
        String(
          saved.fullAddress ||
            saved.address ||
            ""
        ).trim();

      if (!savedText) {
        alert(
          "This saved address is empty. Please enter your address again."
        );

        return;
      }

      setManualAddress(
        savedText
      );

      setAddress(
        savedText
      );

      setLocationArea(
        saved.area || ""
      );

      setLocationCity(
        saved.city || ""
      );

      setLocationPostcode(
        saved.postcode || ""
      );

      setLocationFullAddress(
        saved.fullAddress ||
          saved.address ||
          ""
      );

      setGpsVerified(
        false
      );

      setGpsAccuracy(
        null
      );

      alert(
        "Address selected.\n\nPlease tap 'Use My Current Location' to verify your current delivery location."
      );
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

      const manual =
        manualAddress.trim();

      const selected = {
        id: String(
          Date.now()
        ),

        label:
          "Delivery Address",

        address:
          manual,

        fullAddress:
          manual,

        area:
          locationArea || "",

        city:
          locationCity || "",

        postcode:
          locationPostcode || "",

        state:
          locationState || "",

        latitude:
          Number(
            marker.lat
          ),

        longitude:
          Number(
            marker.lng
          ),

        gpsAccuracy:
          gpsAccuracy,

        gpsVerified:
          gpsVerified,

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
              (item) =>
                String(
                  item.address ||
                    item.fullAddress ||
                    ""
                ).trim()
                  .toLowerCase() ===
                manual.toLowerCase()
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
      } catch (error) {
        console.error(
          "Address save error:",
          error
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
     SAVE FIRESTORE ORDER
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
     RAZORPAY SCRIPT
  ======================================================= */

  const loadRazorpay =
    () =>
      new Promise(
        (resolve) => {
          if (
            window.Razorpay
          ) {
            resolve(true);
            return;
          }

          const existing =
            document.querySelector(
              'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
            );

          if (existing) {
            existing.addEventListener(
              "load",
              () =>
                resolve(
                  true
                ),
              {
                once: true,
              }
            );

            existing.addEventListener(
              "error",
              () =>
                resolve(
                  false
                ),
              {
                once: true,
              }
            );

            return;
          }

          const script =
            document.createElement(
              "script"
            );

          script.src =
            "https://checkout.razorpay.com/v1/checkout.js";

          script.onload =
            () =>
              resolve(
                true
              );

          script.onerror =
            () =>
              resolve(
                false
              );

          document.body.appendChild(
            script
          );
        }
      );

  /* =======================================================
     PAYMENT API RESPONSE
  ======================================================= */

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
          ?.trim() || "";

      if (!configured) {
        throw new Error(
          "VITE_PAYMENT_API_URL is missing. Please configure the live payment API URL in Vercel."
        );
      }

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
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json",
              },

              body: JSON.stringify({
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
              }),
            }
          );
      } catch (error) {
        throw new Error(
          `Payment server se connection nahi ho paya. ${
            error?.message || ""
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

          const succeed =
            () => {
              if (
                !settled
              ) {
                settled =
                  true;

                resolve();
              }
            };

          const fail =
            (error) => {
              if (
                !settled
              ) {
                settled =
                  true;

                reject(
                  error
                );
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
                    payment
                  ) => {
                    try {
                      const verifyResponse =
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
                                  payment.razorpay_order_id,

                                razorpayPaymentId:
                                  payment.razorpay_payment_id,

                                razorpaySignature:
                                  payment.razorpay_signature,
                              }
                            ),
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
                              payment.razorpay_order_id,

                            razorpayPaymentId:
                              payment.razorpay_payment_id,

                            razorpaySignature:
                              payment.razorpay_signature,
                          }
                        );
                      }

                      succeed();
                    } catch (error) {
                      fail(
                        error
                      );
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
            (result) => {
              fail(
                new Error(
                  result?.error
                    ?.description ||
                    "Payment failed. Please try again."
                )
              );
            }
          );

          try {
            razorpay.open();
          } catch (error) {
            fail(error);
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

      /* ===================================================
         DELIVERY VALIDATION
      =================================================== */

      if (
        orderType ===
        "Delivery"
      ) {
        /*
         * 1. MINIMUM DELIVERY ORDER
         *
         * Takeaway does NOT enter this block,
         * so Takeaway has NO ₹169 minimum.
         */
        if (
          Number(totalPrice) <
          MIN_ORDER_AMOUNT
        ) {
          const remainingAmount =
            MIN_ORDER_AMOUNT -
            Number(totalPrice);

          alert(
            `🛵 Minimum delivery order is ₹${MIN_ORDER_AMOUNT}.\n\n` +
            `Your current item total is ₹${Number(
              totalPrice
            ).toFixed(0)}.\n\n` +
            `Please add ₹${remainingAmount.toFixed(
              0
            )} more to place a delivery order.`
          );

          return;
        }

        /*
         * 2. GPS REQUIRED
         */
        if (!gpsVerified) {
          alert(
            "📍 Please use 'Use My Current Location' first.\n\nYour current GPS location is required to check whether delivery is available at your location."
          );

          return;
        }

        /*
         * 3. MANUAL ADDRESS REQUIRED
         */
        const typedAddress =
          manualAddress.trim();

        if (!typedAddress) {
          alert(
            "🏠 Please enter your complete delivery address.\n\nExample:\nHouse/Flat No., Street, Area, Landmark, City, PIN"
          );

          return;
        }

        /*
         * 4. ADDRESS SHOULD BE REASONABLY COMPLETE
         */
        if (
          typedAddress.length <
          10
        ) {
          alert(
            "🏠 Please enter a complete delivery address.\n\nInclude House/Flat No., Street/Area, Landmark and PIN."
          );

          return;
        }

        /*
         * 5. GPS COORDINATES MUST EXIST
         */
        if (
          !Number.isFinite(
            Number(marker.lat)
          ) ||
          !Number.isFinite(
            Number(marker.lng)
          )
        ) {
          alert(
            "📍 Please use your current location again."
          );

          return;
        }

        /*
         * 6. DELIVERY RADIUS
         *
         * FINAL LIMIT = 8 KM
         */
        if (
          !deliveryAvailable
        ) {
          alert(
            `Sorry! We currently deliver within ${MAX_DELIVERY_DISTANCE} km of Sugar Cafe.\n\nYour current location is ${distance.toFixed(
              2
            )} km away.`
          );

          return;
        }

        /*
         * Keep the manual address as the final
         * customer delivery address.
         */
        setAddress(
          typedAddress
        );
      }

      /* ===================================================
         REWARD VALIDATION
      =================================================== */

      if (
        loyaltyUnlocked &&
        !selectedLoyaltyReward
      ) {
        alert(
          "Please select your FREE Sugar Reward."
        );

        return;
      }

      if (
        selectedLoyaltyReward &&
        !LOYALTY_REWARDS.includes(
          selectedLoyaltyReward
        )
      ) {
        alert(
          "Invalid Sugar Reward selected."
        );

        return;
      }

      try {
        setPlacingOrder(
          true
        );

        /* ================================================
           CART ITEMS
        ================================================= */

        const orderItems =
          cart.map(
            (item) => ({
              id:
                item.id ||
                "",

              name:
                item.name ||
                "",

              price:
                Number(
                  item.price ||
                    0
                ),

              qty:
                getQty(item),

              image:
                item.image ||
                "",

              category:
                item.category ||
                "",
            })
          );

        /* ================================================
           DAILY SCRATCH FREE ITEM
        ================================================= */

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
                (item) =>
                  String(
                    item.name
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

        /* ================================================
           SUGAR REWARD
        ================================================= */

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
                (item) =>
                  String(
                    item.name
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

        /* ================================================
           ORDER NUMBER
        ================================================= */

        const orderNumber =
          `SC-${Date.now()}`;

        /* ================================================
           ADDRESS
        ================================================= */

        const selectedAddress =
          await saveCustomerAddress();

        /* ================================================
           REWARD SNAPSHOT
        ================================================= */

        const rewardWasSixthOrder =
          sixthOrderRewardUnlocked;

        const rewardWasPreviousUnused =
          availablePreviousRewards >
            0 &&
          !rewardWasSixthOrder;

        /* ================================================
           FINAL MANUAL ADDRESS
        ================================================= */

        const finalDeliveryAddress =
          orderType ===
          "Delivery"
            ? manualAddress.trim()
            : "Takeaway — Pickup from Sugar Cafe";

        const combinedDeliveryAddress =
          orderType ===
          "Delivery"
            ? [
                manualAddress.trim(),

                locationArea,

                locationCity,

                locationPostcode,
              ]
                .filter(Boolean)
                .join(", ")
            : "";

        /* ================================================
           ORDER DATA
        ================================================= */

        const orderData = {
          orderNumber,

          /* CUSTOMER */
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

          /* ORDER */
          orderType,

          /*
           * EXACT CUSTOMER-TYPED ADDRESS
           */
          address:
            finalDeliveryAddress,

          deliveryAddress:
            orderType ===
            "Delivery"
              ? manualAddress.trim()
              : "",

          deliveryFullAddress:
            combinedDeliveryAddress,

          /* GPS */
          latitude:
            orderType ===
            "Delivery"
              ? Number(
                  marker.lat
                )
              : null,

          longitude:
            orderType ===
            "Delivery"
              ? Number(
                  marker.lng
                )
              : null,

          gpsVerified:
            orderType ===
            "Delivery"
              ? Boolean(
                  gpsVerified
                )
              : false,

          gpsAccuracy:
            orderType ===
            "Delivery"
              ? gpsAccuracy
              : null,

          /* GPS AREA */
          deliveryArea:
            orderType ===
            "Delivery"
              ? locationArea ||
                ""
              : "",

          deliveryCity:
            orderType ===
            "Delivery"
              ? locationCity ||
                ""
              : "",

          deliveryState:
            orderType ===
            "Delivery"
              ? locationState ||
                ""
              : "",

          deliveryPostcode:
            orderType ===
            "Delivery"
              ? locationPostcode ||
                ""
              : "",

          /* DISTANCE */
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

          /* PAYMENT */
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

          /* ITEMS */
          items:
            orderItems,

          /* BILL */
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

          /* DAILY SCRATCH */
          dailyScratchReward:
            loyaltyUnlocked
              ? ""
              : dailyScratchReward
                  ?.title || "",

          /* SUGAR REWARD */
          loyaltyReward:
            selectedLoyaltyReward ||
            "",

          loyaltyRewardRedeemed:
            Boolean(
              selectedLoyaltyReward
            ),

          loyaltyRewardNumber:
            selectedLoyaltyReward
              ? rewardWasSixthOrder
                ? 1
                : Math.max(
                    1,
                    availablePreviousRewards
                  )
              : 0,

          loyaltyQualifyingOrdersBefore:
            qualifyingOrders,

          loyaltyIsSixthOrder:
            rewardWasSixthOrder,

          loyaltyUsedPreviousReward:
            rewardWasPreviousUnused,

          loyaltyRewardCycle:
            Math.floor(
              qualifyingOrders /
                LOYALTY_TARGET
            ) + 1,

          loyaltyCurrentOrderQualifies:
            currentOrderQualifies,

          /* STATUS */
          status: "New",

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

        /* ================================================
           PAYMENT
        ================================================= */

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
          await saveCompletedOrder(
            orderData
          );
        }

        /* ================================================
           SUCCESS
        ================================================= */

        if (
          selectedLoyaltyReward
        ) {
          alert(
            `🎉 Order placed!\n\nYour Sugar Reward "${selectedLoyaltyReward}" has been added FREE to this order.`
          );
        } else if (
          rewardFreeItem
        ) {
          alert(
            `🎉 Order placed!\n\nYour FREE ${rewardFreeItem} has been added to this order.`
          );
        } else {
          alert(
            "🎉 Order Placed Successfully!"
          );
        }

        navigate(
          "/success"
        );
      } catch (error) {
        console.error(
          "Order placement error:",
          error
        );

        alert(
          `Order place nahi ho paya.\n\n${
            error?.message ||
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
     BUTTON DISABLED — FINAL
     
     TAKEAWAY:
     No ₹169 minimum.

     DELIVERY:
     ₹169 minimum
     + GPS
     + manual address
     + within 8 KM
  ======================================================= */

  const orderDisabled =
    !store.deliveryAvailable ||
    placingOrder ||
    (
      orderType === "Delivery" &&
      (
        Number(totalPrice) <
          MIN_ORDER_AMOUNT ||
        !gpsVerified ||
        !manualAddress.trim() ||
        !deliveryAvailable
      )
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="checkout-page">

      {/* =================================================
          STORE STATUS
      ================================================= */}

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

      {/* =================================================
          HEADER
      ================================================= */}

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
            Almost there! Your delicious food is one step away ✨
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

      {/* =================================================
          ORDER TYPE
      ================================================= */}

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
              How would you like to receive your order?
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
                  orderType ===
                  type
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

      {/* =================================================
          DELIVERY LOCATION
      ================================================= */}

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
                Current GPS + complete delivery address required
              </p>
            </div>

            <span
              className={`location-status ${
                gpsVerified &&
                deliveryAvailable
                  ? "confirmed"
                  : "not-confirmed"
              }`}
            >
              {gpsVerified &&
              deliveryAvailable
                ? "✓ Confirmed"
                : "⚠ Required"}
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
                    index
                  ) => (
                    <button
                      type="button"
                      key={
                        saved.id ||
                        index
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
                          {saved.address ||
                            saved.fullAddress}
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

          {/* =================================================
              MANUAL ADDRESS
          ================================================= */}

          <div className="manual-address-box">

            <label>
              Complete Delivery Address *
            </label>

            <input
              value={
                manualAddress
              }
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value;

                setManualAddress(
                  value
                );

                setAddress(
                  value
                );
              }}
              placeholder="House/Flat No., Street, Area, Landmark, City, PIN"
              autoComplete="street-address"
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
                ? "Saving address..."
                : "✓ Add This Address"}
            </button>

            <small
              style={{
                display:
                  "block",
                marginTop:
                  "8px",
                lineHeight:
                  "1.45",
              }}
            >
              🏠 This address will be printed on your bill/KOT.
              Please enter the exact house/flat number, street,
              area, landmark, city and PIN.
            </small>
          </div>

          {/* =================================================
              CURRENT LOCATION
          ================================================= */}

          <button
            type="button"
            className={`current-location-btn ${
              gpsVerified
                ? "gps-verified"
                : ""
            }`}
            onClick={
              getCurrentLocation
            }
            disabled={
              loadingLocation
            }
          >
            <span>
              {gpsVerified
                ? "✓"
                : "◎"}
            </span>

            <span>
              {loadingLocation
                ? "Getting Exact GPS Location..."
                : gpsVerified
                ? "Current Location Verified — Tap to Refresh"
                : "Use My Current Location"}
            </span>

            <span>
              →
            </span>
          </button>

          {/* GPS STATUS */}

          <div
            className={`gps-verification-box ${
              gpsVerified
                ? "verified"
                : "not-verified"
            }`}
          >
            <div>
              <strong>
                {gpsVerified
                  ? "✓ GPS Location Verified"
                  : "📍 GPS Location Required"}
              </strong>

              <small>
                {gpsVerified
                  ? gpsAccuracy
                    ? `Accuracy: approximately ${gpsAccuracy} metres`
                    : "Your current GPS location is being used for delivery radius."
                  : "Tap 'Use My Current Location' so we can calculate the delivery distance correctly."}
              </small>
            </div>

            {gpsVerified && (
              <span>
                {distance.toFixed(
                  2
                )}{" "}
                km
              </span>
            )}
          </div>

          {/* =================================================
              MAP
          ================================================= */}

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
              dragging={true}
              className="checkout-map"
              whenReady={(
                event
              ) =>
                setMapRef(
                  event.target
                )
              }
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
              {gpsVerified
                ? "GPS location"
                : "Use current location"}
            </div>
          </div>

          {/* MAP INSTRUCTION */}

          <div className="map-instruction">
            <div>
              📍
            </div>

            <div>
              <strong>
                GPS location is used for delivery radius
              </strong>

              <p>
                Your current GPS location determines whether we can deliver to you. The address above is used for the delivery/bill.
              </p>
            </div>
          </div>

          {/* =================================================
              SELECTED ADDRESS
          ================================================= */}

          <div className="selected-address-box">
            <div className="selected-address-icon">
              🏠
            </div>

            <div className="selected-address-content">
              <span>
                DELIVERY ADDRESS
              </span>

              <strong>
                {manualAddress ||
                  "Please enter your complete delivery address"}
              </strong>

              {gpsVerified && (
                <small>
                  GPS Area:{" "}
                  {[
                    locationArea,
                    locationCity,
                    locationPostcode,
                  ]
                    .filter(
                      Boolean
                    )
                    .join(
                      ", "
                    ) ||
                    "Location detected"}
                </small>
              )}

              <small>
                {gpsVerified
                  ? `${distance.toFixed(
                      2
                    )} km from Sugar Cafe`
                  : "GPS verification required"}
              </small>
            </div>

            <div
              className={`distance-status ${
                gpsVerified &&
                deliveryAvailable
                  ? "available"
                  : "unavailable"
              }`}
            >
              {!gpsVerified
                ? "GPS Required"
                : deliveryAvailable
                ? "✓ Deliverable"
                : "✕ Outside Range"}
            </div>
          </div>

          {/* GPS AREA DETAILS */}

          {gpsVerified &&
            (locationArea ||
              locationCity ||
              locationPostcode) && (
              <div className="location-area-details">
                <span>
                  📍
                </span>

                <div>
                  <strong>
                    GPS Detected Area
                  </strong>

                  <small>
                    {[
                      locationArea,
                      locationCity,
                      locationState,
                      locationPostcode,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        ", "
                      )}
                  </small>
                </div>
              </div>
            )}

          {/* GPS NOT VERIFIED */}

          {!gpsVerified && (
            <div className="delivery-warning">
              <span>
                📍
              </span>

              <div>
                <strong>
                  Current location required
                </strong>

                <p>
                  Please tap "Use My Current Location" before placing a delivery order. Your GPS location is required to calculate the delivery radius.
                </p>
              </div>
            </div>
          )}

          {/* ADDRESS MISSING */}

          {gpsVerified &&
            !manualAddress.trim() && (
              <div className="delivery-warning">
                <span>
                  🏠
                </span>

                <div>
                  <strong>
                    Complete address required
                  </strong>

                  <p>
                    Please enter House/Flat No., Street/Area, Landmark, City and PIN. This address will be printed on the bill/KOT.
                  </p>
                </div>
              </div>
            )}

          {/* OUTSIDE RANGE */}

          {gpsVerified &&
            !deliveryAvailable && (
              <div className="delivery-warning">
                <span>
                  ⚠️
                </span>

                <div>
                  <strong>
                    Delivery not available
                  </strong>

                  <p>
                    We currently deliver within{" "}
                    {
                      MAX_DELIVERY_DISTANCE
                    }{" "}
                    km of Sugar Cafe. Your current GPS location is{" "}
                    {distance.toFixed(
                      2
                    )}{" "}
                    km away.
                  </p>
                </div>
              </div>
            )}
        </section>
      )}

      {/* =================================================
          TAKEAWAY
      ================================================= */}

      {orderType ===
        "Takeaway" && (
        <section className="checkout-card">
          <div className="section-heading">
            <div className="section-icon">
              🛍️
            </div>

            <div>
              <span className="section-label">
                PICKUP
              </span>

              <h3>
                Cafe Pickup
              </h3>

              <p>
                Your order will be prepared at Sugar Cafe.
              </p>
            </div>
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

          <div className="takeaway-location-box">
            <div>
              📍
            </div>

            <div>
              <strong>
                Sugar Cafe
              </strong>

              <p>
                Pickup from Sugar Cafe
              </p>

              <small>
                Your order will be ready for pickup after preparation.
              </small>
            </div>
          </div>
        </section>
      )}

      {/* =================================================
          ORDER SUMMARY
      ================================================= */}

      <section className="checkout-card">
        <div className="section-heading">
          <div className="section-icon">
            🛒
          </div>

          <div>
            <span className="section-label">
              YOUR ORDER
            </span>

            <h3>
              Order Summary
            </h3>

            <p>
              {cart.length} item
              {cart.length !== 1
                ? "s"
                : ""}{" "}
              in your cart
            </p>
          </div>
        </div>

        <div className="checkout-items">
          {cart.map(
            (
              item,
              index
            ) => {
              const qty =
                getQty(item);

              const itemTotal =
                Number(
                  item.price ||
                    0
                ) * qty;

              return (
                <div
                  className="checkout-item"
                  key={
                    item.id ||
                    `${item.name}-${index}`
                  }
                >
                  <div className="checkout-item-image">
                    {item.image ? (
                      <img
                        src={
                          item.image
                        }
                        alt={
                          item.name
                        }
                      />
                    ) : (
                      <span>
                        🍽️
                      </span>
                    )}
                  </div>

                  <div className="checkout-item-info">
                    <strong>
                      {item.name}
                    </strong>

                    <span>
                      Qty:{" "}
                      {qty}
                    </span>
                  </div>

                  <strong className="checkout-item-price">
                    {money(
                      itemTotal
                    )}
                  </strong>
                </div>
              );
            }
          )}
        </div>
      </section>

      {/* =================================================
          SUGAR REWARDS
      ================================================= */}

      <section className="checkout-card loyalty-card">
        <div className="section-heading">
          <div className="section-icon">
            🎁
          </div>

          <div>
            <span className="section-label">
              SUGAR REWARDS
            </span>

            <h3>
              6 + 1 Loyalty Program
            </h3>

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

            <span>
              {Math.round(
                progressPercent
              )}
              %
            </span>
          </div>

          <div className="loyalty-progress-track">
            <div
              className="loyalty-progress-fill"
              style={{
                width: `${Math.min(
                  100,
                  progressPercent
                )}%`,
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
                  LOYALTY_TARGET -
                    loyaltyProgress
                )} more qualifying delivered order${
                  Math.max(
                    0,
                    LOYALTY_TARGET -
                      loyaltyProgress
                  ) ===
                  1
                    ? ""
                    : "s"
                } needed.`}
          </p>
        </div>

        {currentOrderQualifies &&
          !loyaltyUnlocked && (
            <div className="loyalty-current-info">
              🧾 This order qualifies for the ₹500+ Sugar Rewards program.
            </div>
          )}

        {loyaltyUnlocked && (
          <div className="loyalty-reward-selection">
            <div className="reward-selection-heading">
              <strong>
                🎉 Choose Your FREE Reward
              </strong>

              <span>
                Select one
              </span>
            </div>

            <div className="loyalty-reward-grid">
              {LOYALTY_REWARDS.map(
                (
                  reward
                ) => (
                  <button
                    key={
                      reward
                    }
                    type="button"
                    className={`loyalty-reward-option ${
                      selectedLoyaltyReward ===
                      reward
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedLoyaltyReward(
                        reward
                      )
                    }
                  >
                    <span className="reward-check">
                      {selectedLoyaltyReward ===
                      reward
                        ? "✓"
                        : ""}
                    </span>

                    <span className="reward-gift">
                      🎁
                    </span>

                    <span className="reward-name">
                      {reward}
                    </span>

                    <small>
                      FREE
                    </small>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {loyaltyLoading && (
          <div className="loyalty-loading">
            Checking your Sugar Rewards...
          </div>
        )}
      </section>

      {/* =================================================
          DAILY SCRATCH
      ================================================= */}

      {!loyaltyUnlocked &&
        dailyScratchEligible && (
          <section className="checkout-card scratch-card-section">
            <div className="section-heading">
              <div className="section-icon">
                🎟️
              </div>

              <div>
                <span className="section-label">
                  DAILY REWARD
                </span>

                <h3>
                  Scratch & Win
                </h3>

                <p>
                  Your ₹
                  {
                    DAILY_SCRATCH_MIN_BILL
                  }
                  + order qualifies.
                </p>
              </div>
            </div>

            <div
              className={`daily-scratch-card ${
                dailyScratchRevealed
                  ? "revealed"
                  : ""
              }`}
              onClick={
                revealDailyScratch
              }
            >
              {!dailyScratchRevealed ? (
                <div className="scratch-overlay">
                  <span className="scratch-emoji">
                    🎁
                  </span>

                  <strong>
                    SCRATCH TO REVEAL
                  </strong>

                  <small>
                    Tap here to reveal today's reward
                  </small>
                </div>
              ) : (
                <div className="scratch-result">
                  <span>
                    🎉
                  </span>

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

      {/* =================================================
          SPECIAL NOTE
      ================================================= */}

      <section className="checkout-card">
        <div className="section-heading">
          <div className="section-icon">
            📝
          </div>

          <div>
            <span className="section-label">
              OPTIONAL
            </span>

            <h3>
              Special Instructions
            </h3>

            <p>
              Anything we should know about your order?
            </p>
          </div>
        </div>

        <textarea
          className="checkout-note-input"
          value={
            specialNote
          }
          onChange={(
            event
          ) =>
            setSpecialNote(
              event.target
                .value
            )
          }
          placeholder="Example: Less spicy, extra sauce, no onions..."
          rows={3}
          maxLength={250}
        />

        <div className="note-counter">
          {
            specialNote.length
          }
          /250
        </div>
      </section>

      {/* =================================================
          PAYMENT
      ================================================= */}

      <section className="checkout-card payment-card">
        <div className="section-heading payment-heading">
          <div className="section-icon payment-main-icon">
            💳
          </div>

          <div>
            <span className="section-label">
              PAYMENT
            </span>

            <h3>
              Choose Payment Method
            </h3>

            <p>
              Select how you want to pay for your order.
            </p>
          </div>
        </div>

        <div className="payment-method-grid">

          {/* COD */}

          {store.codEnabled !==
            false && (
            <button
              type="button"
              className={`payment-method-option ${
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
              <div className="payment-option-icon cod-icon">
                💵
              </div>

              <div className="payment-option-content">
                <div className="payment-option-title-row">
                  <strong>
                    Cash on Delivery
                  </strong>

                  {paymentMethod ===
                    "Cash on Delivery" && (
                    <span className="payment-selected-check">
                      ✓
                    </span>
                  )}
                </div>

                <small>
                  Pay when your order arrives
                </small>

                <div className="payment-mini-info">
                  <span>
                    🛡️ Secure
                  </span>

                  <span>
                    🚚 Pay on delivery
                  </span>
                </div>
              </div>

              <span
                className={`payment-radio ${
                  paymentMethod ===
                  "Cash on Delivery"
                    ? "selected"
                    : ""
                }`}
              >
                {paymentMethod ===
                  "Cash on Delivery" && (
                  <span className="radio-inner" />
                )}
              </span>
            </button>
          )}

          {/* ONLINE */}

          {store.upiEnabled && (
            <button
              type="button"
              className={`payment-method-option ${
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
              <div className="payment-option-icon online-icon">
                💳
              </div>

              <div className="payment-option-content">
                <div className="payment-option-title-row">
                  <strong>
                    Online Payment
                  </strong>

                  {paymentMethod ===
                    "Online Payment" && (
                    <span className="payment-selected-check">
                      ✓
                    </span>
                  )}
                </div>

                <small>
                  UPI / Card / Net Banking
                </small>

                <div className="payment-mini-info payment-methods">
                  <span>
                    UPI
                  </span>

                  <span>
                    Cards
                  </span>

                  <span>
                    Net Banking
                  </span>
                </div>
              </div>

              <span
                className={`payment-radio ${
                  paymentMethod ===
                  "Online Payment"
                    ? "selected"
                    : ""
                }`}
              >
                {paymentMethod ===
                  "Online Payment" && (
                  <span className="radio-inner" />
                )}
              </span>
            </button>
          )}
        </div>
      </section>

      {/* =================================================
          BILL
      ================================================= */}

      <section className="checkout-card bill-summary-card">
        <div className="section-heading">
          <div className="section-icon">
            🧾
          </div>

          <div>
            <span className="section-label">
              BILL DETAILS
            </span>

            <h3>
              Order Total
            </h3>
          </div>
        </div>

        <div className="bill-lines">
          <div className="bill-line">
            <span>
              Item Total
            </span>

            <strong>
              {money(
                totalPrice
              )}
            </strong>
          </div>

          {orderType ===
            "Delivery" && (
            <div className="bill-line">
              <span>
                Delivery Charge
              </span>

              <strong>
                {deliveryCharge >
                0
                  ? money(
                      deliveryCharge
                    )
                  : "FREE"}
              </strong>
            </div>
          )}

          {!loyaltyUnlocked &&
            scratchDiscount >
              0 && (
              <div className="bill-line discount">
                <span>
                  🎟️ Daily Scratch Discount
                </span>

                <strong>
                  -
                  {money(
                    scratchDiscount
                  )}
                </strong>
              </div>
            )}

          {loyaltyUnlocked &&
            selectedLoyaltyReward && (
              <div className="bill-line reward">
                <span>
                  🎁 Sugar Reward
                </span>

                <strong>
                  FREE
                </strong>
              </div>
            )}

          {rewardFreeItem &&
            !loyaltyUnlocked && (
              <div className="bill-line reward">
                <span>
                  🎁 Daily Free Item
                </span>

                <strong>
                  FREE
                </strong>
              </div>
            )}

          <div className="bill-divider" />

          <div className="bill-total">
            <span>
              Grand Total
            </span>

            <strong>
              {money(
                grandTotal
              )}
            </strong>
          </div>
        </div>
      </section>

      {/* =================================================
          BOTTOM ACTION
      ================================================= */}

      <div className="checkout-bottom">

        {/* MINIMUM DELIVERY WARNING */}

        {orderType ===
          "Delivery" &&
          Number(totalPrice) <
            MIN_ORDER_AMOUNT && (
            <div className="checkout-action-warning">
              🛵 Minimum delivery order is ₹169.
              Please add ₹
              {Math.max(
                0,
                MIN_ORDER_AMOUNT -
                  Number(totalPrice)
              ).toFixed(0)}
              {" "}more to your cart.
            </div>
          )}

        {/* GPS WARNING */}

        {orderType ===
          "Delivery" &&
          !gpsVerified && (
            <div className="checkout-action-warning">
              📍 Please use your current GPS location before placing the delivery order.
            </div>
          )}

        {/* ADDRESS WARNING */}

        {orderType ===
          "Delivery" &&
          gpsVerified &&
          !manualAddress.trim() && (
            <div className="checkout-action-warning">
              🏠 Please enter your complete delivery address. This address will be printed on the bill/KOT.
            </div>
          )}

        {/* REWARD WARNING */}

        {loyaltyUnlocked &&
          !selectedLoyaltyReward && (
            <div className="checkout-action-warning">
              🎁 Please select your FREE Sugar Reward before placing the order.
            </div>
          )}

        {/* OUTSIDE RANGE */}

        {orderType ===
          "Delivery" &&
          gpsVerified &&
          !deliveryAvailable && (
            <div className="checkout-action-warning">
              📍 Your current GPS location is outside our delivery area.
            </div>
          )}

        <button
          type="button"
          className="place-order-btn"
          onClick={
            placeOrder
          }
          disabled={
            orderDisabled ||
            (loyaltyUnlocked &&
              !selectedLoyaltyReward)
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
                {paymentMethod ===
                "Online Payment"
                  ? "💳"
                  : "🛵"}
              </span>

              <span>
                {paymentMethod ===
                "Online Payment"
                  ? `Pay ${money(
                      grandTotal
                    )}`
                  : `Place Order • ${money(
                      grandTotal
                    )}`}
              </span>

              <span>
                →
              </span>
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
