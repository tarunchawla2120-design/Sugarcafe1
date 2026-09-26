import { useState, useRef, useEffect } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
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
import "./Checkout.css";
import { useStoreSettings } from "../context/StoreContext";


/* =========================================================
   SUGAR CAFE 6 + 1 LOYALTY
========================================================= */

const LOYALTY_MIN_BILL = 500;

const LOYALTY_REWARDS = [
  {
    type: "free_menu_item",
    itemName: "Classic Cold Coffee",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Cheese Aloo Tikki Burger",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Aloo Cheese Puff",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Paneer Cheese Sandwich",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Diet Coke",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Salted French Fries",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Hot Chocolate Brownie",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Hot Chocolava",
    discountPercent: 0,
  },
];


/* =========================================================
   DAILY SCRATCH & WIN
========================================================= */

const DAILY_SCRATCH_MIN_BILL = 499;

const DAILY_SCRATCH_REWARDS = [
  {
    type: "discount",
    discountPercent: 5,
    title: "5% OFF",
  },
  {
    type: "free_menu_item",
    itemName: "Cheese Aloo Puff",
    title: "FREE Cheese Aloo Puff",
  },
  {
    type: "free_menu_item",
    itemName: "Veg Aloo Tikka Burger",
    title: "FREE Veg Aloo Tikka Burger",
  },
  {
    type: "free_menu_item",
    itemName: "French Fries",
    title: "FREE French Fries",
  },
];


/* =========================================================
   HELPERS
========================================================= */

function loyaltyTime(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}


function normalizeMenuName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}


/* =========================================================
   DAILY SCRATCH CANVAS
========================================================= */

function DailyScratchCard({
  disabled = false,
  onReveal,
}) {
  const canvasRef = useRef(null);
  const scratchingRef = useRef(false);
  const revealedRef = useRef(false);

  const prepareCanvas = () => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const width = 640;
    const height = 320;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.globalCompositeOperation = "source-over";

    const gradient = ctx.createLinearGradient(
      0,
      0,
      width,
      height
    );

    gradient.addColorStop(0, "#f4f4f4");
    gradient.addColorStop(0.5, "#cfcfcf");
    gradient.addColorStop(1, "#eeeeee");

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

    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = "#333";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "800 42px Arial";

    ctx.fillText(
      "SCRATCH HERE",
      width / 2,
      height / 2 - 15
    );

    ctx.font = "600 23px Arial";
    ctx.fillStyle = "#666";

    ctx.fillText(
      "✨ Reveal your reward ✨",
      width / 2,
      height / 2 + 35
    );
  };


  useEffect(() => {
    if (!disabled) {
      revealedRef.current = false;
      prepareCanvas();
    }

    return () => {
      scratchingRef.current = false;
    };
  }, [disabled]);


  const getPoint = (event) => {
    const canvas = canvasRef.current;

    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    const scaleX =
      canvas.width / rect.width;

    const scaleY =
      canvas.height / rect.height;

    return {
      x:
        (event.clientX - rect.left) *
        scaleX,

      y:
        (event.clientY - rect.top) *
        scaleY,
    };
  };


  const scratchAt = (event) => {
    if (
      disabled ||
      revealedRef.current
    ) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) return;

    const point = getPoint(event);

    if (!point) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.globalCompositeOperation =
      "destination-out";

    ctx.beginPath();

    ctx.arc(
      point.x,
      point.y,
      34,
      0,
      Math.PI * 2
    );

    ctx.fill();

    checkScratchPercentage();
  };


  const checkScratchPercentage = () => {
    if (revealedRef.current) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    try {
      const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      let transparent = 0;
      let total = 0;

      const step = 10;

      for (
        let y = 0;
        y < canvas.height;
        y += step
      ) {
        for (
          let x = 0;
          x < canvas.width;
          x += step
        ) {
          const index =
            (y * canvas.width + x) * 4;

          const alpha =
            imageData.data[index + 3];

          total++;

          if (alpha < 80) {
            transparent++;
          }
        }
      }

      const percentage =
        total > 0
          ? (transparent / total) * 100
          : 0;

      if (percentage >= 45) {
        revealCard();
      }
    } catch (error) {
      console.error(
        "Scratch percentage error:",
        error
      );
    }
  };


  const revealCard = () => {
    if (revealedRef.current) return;

    revealedRef.current = true;

    const canvas = canvasRef.current;

    if (canvas) {
      const ctx =
        canvas.getContext("2d");

      if (ctx) {
        ctx.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );
      }
    }

    if (typeof onReveal === "function") {
      onReveal();
    }
  };


  const handlePointerDown = (event) => {
    if (disabled) return;

    scratchingRef.current = true;

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {}

    scratchAt(event);
  };


  const handlePointerMove = (event) => {
    if (
      !scratchingRef.current ||
      disabled
    ) {
      return;
    }

    scratchAt(event);
  };


  const handlePointerUp = (event) => {
    scratchingRef.current = false;

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {}
  };


  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "360px",
        margin: "18px auto 0",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow:
          "0 15px 35px rgba(0,0,0,.14)",
        background:
          "linear-gradient(135deg,#fff7ed,#fff)",
        userSelect: "none",
      }}
    >
      <div
        style={{
          padding: "24px 18px",
          minHeight: "180px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "48px",
            marginBottom: "8px",
          }}
        >
          🎁
        </div>

        <strong
          style={{
            fontSize: "22px",
            color: "#241b17",
          }}
        >
          Your Daily Reward
        </strong>

        <span
          style={{
            marginTop: "8px",
            color: "#777",
            fontSize: "14px",
          }}
        >
          Scratch the card to reveal
        </span>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          cursor: disabled
            ? "default"
            : "grab",
          touchAction: "none",
        }}
      />
    </div>
  );
}


/* =========================================================
   LEAFLET LOCATION ICON
========================================================= */

const locationIcon = L.divIcon({
  className: "checkout-location-pin",

  html: `
    <div class="checkout-pin-marker">
      <div class="checkout-pin-dot"></div>
    </div>
  `,

  iconSize: [40, 40],
  iconAnchor: [20, 40],
});


/* =========================================================
   MAP MOVER
========================================================= */

function MapMover({ position }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;

    map.setView(
      [position.lat, position.lng],
      16,
      {
        animate: true,
      }
    );
  }, [position, map]);

  return null;
}


/* =========================================================
   CHECKOUT
========================================================= */

function Checkout() {
  const navigate = useNavigate();
  const rawStore = useStoreSettings();

  const store = rawStore || {};

  const maxDeliveryDistanceKm =
    Number(
      store.maxDeliveryDistanceKm ?? 10
    );

  const deliveryPerKm =
    Number(
      store.deliveryPerKm ?? 20
    );

  const minDeliveryCharge =
    Number(
      store.minDeliveryCharge ?? 20
    );

  const maxDeliveryCharge =
    Number(
      store.maxDeliveryCharge ?? 300
    );

  const deliveryAvailableSetting =
    store.deliveryAvailable ?? true;

  const upiEnabled =
    store.upiEnabled ?? false;

  const codEnabled =
    store.codEnabled ?? true;

  const cafeName =
    store.cafeName || "Sugar Cafe";

  const preparationMinutes =
    Number(
      store.preparationMinutes ?? 15
    );

  const orderTimingLabel =
    store.orderTimingLabel ||
    "during store hours";

  const announcement =
    store.announcement || "";


  /* =======================================================
     CART
  ======================================================= */

  const {
    cart,
    totalPrice,
    clearCart,
  } = useCart();


  /* =======================================================
     ORDER TYPE
  ======================================================= */

  const [orderType, setOrderType] =
    useState(() => {
      return (
        localStorage.getItem(
          "sugarCafeOrderType"
        ) || "Delivery"
      );
    });

  const isTakeaway =
    orderType === "Takeaway";


  /* =======================================================
     TAKEAWAY STORE
  ======================================================= */

  const TAKEAWAY_STORE = {
    name: "Sugar Crown – NTPC",

    address:
      "NTPC Gate, Sada Colony, Jamnipali, Korba, Chhattisgarh – 495450",

    lat: 22.417212,
    lng: 82.665984,
  };


  /* =======================================================
     BASIC STATES
  ======================================================= */

  const [address, setAddress] =
    useState("");

  const [loadingLocation, setLoadingLocation] =
    useState(false);

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [specialNote, setSpecialNote] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState(() => {
      if (
        rawStore?.codEnabled !== false
      ) {
        return "Cash on Delivery";
      }

      if (
        rawStore?.upiEnabled === true
      ) {
        return "Online Payment";
      }

      return "Cash on Delivery";
    });

  const [customerProfile, setCustomerProfile] =
    useState(null);

  const [savedAddresses, setSavedAddresses] =
    useState([]);

  const [manualAddress, setManualAddress] =
    useState("");


  /* =======================================================
     6 + 1 LOYALTY STATE
  ======================================================= */

  const [loyaltyData, setLoyaltyData] =
    useState({
      loading: true,
      qualifyingOrders: 0,
      pendingReward: null,
      currentReward: null,
    });


  /* =======================================================
     DAILY SCRATCH STATE
  ======================================================= */

  const [dailyScratch, setDailyScratch] =
    useState({
      loading: true,
      eligible: false,
      unlocked: false,
      revealed: false,
      reward: null,
      rewardIndex: null,
      previousCount: 0,
    });


  const [dailyScratchRevealing, setDailyScratchRevealing] =
    useState(false);


  /* =======================================================
     SHOP LOCATION
  ======================================================= */

  const SHOP_LOCATION = {
    lat: 22.417212,
    lng: 82.665984,
  };

  const [mapCenter, setMapCenter] =
    useState(SHOP_LOCATION);

  const [marker, setMarker] =
    useState(SHOP_LOCATION);

  const mapRef = useRef(null);


  /* =======================================================
     LOAD CUSTOMER
  ======================================================= */

  useEffect(() => {
    try {
      const savedUser =
        localStorage.getItem(
          "sugarCafeUser"
        );

      if (savedUser) {
        const data =
          JSON.parse(savedUser);

        const profile = {
          ...data,

          customerId:
            data.customerId ||
            localStorage.getItem(
              "sugarCafeCustomerId"
            ) ||
            "",

          name:
            data.name || "",

          phone:
            data.phone || "",

          email:
            data.email || "",

          photoURL:
            data.photoURL || "",

          addresses:
            Array.isArray(data.addresses)
              ? data.addresses
              : [],

          guest: false,
          loggedIn: true,
        };

        setCustomerProfile(profile);

        setSavedAddresses(
          profile.addresses || []
        );
      }

      const savedLocation =
        localStorage.getItem(
          "userLocation"
        );

      if (savedLocation) {
        const loc =
          JSON.parse(savedLocation);

        if (
          loc.latitude != null &&
          loc.longitude != null
        ) {
          const saved = {
            lat: Number(
              loc.latitude
            ),

            lng: Number(
              loc.longitude
            ),
          };

          if (
            Number.isFinite(saved.lat) &&
            Number.isFinite(saved.lng)
          ) {
            setMarker(saved);
            setMapCenter(saved);
          }

          if (
            loc.fullAddress ||
            loc.address
          ) {
            setAddress(
              loc.fullAddress ||
              loc.address
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "Customer checkout loading error:",
        error
      );
    }
  }, []);


  /* =======================================================
     6 + 1 LOYALTY STATUS
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadLoyaltyStatus =
      async () => {

        const customerId =
          customerProfile?.customerId ||
          localStorage.getItem(
            "sugarCafeCustomerId"
          );

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
          setLoyaltyData((prev) => ({
            ...prev,
            loading: true,
          }));

          const ordersQuery =
            query(
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
            await getDocs(
              ordersQuery
            );

          if (cancelled) return;

          const customerOrders =
            snapshot.docs
              .map((orderDoc) => ({
                id: orderDoc.id,
                ...orderDoc.data(),
              }))
              .sort(
                (a, b) =>
                  loyaltyTime(
                    a.createdAt
                  ) -
                  loyaltyTime(
                    b.createdAt
                  )
              );

          const qualifyingOrders =
            customerOrders.filter(
              (order) => {

                const status =
                  String(
                    order.status || ""
                  ).toLowerCase();

                const bill =
                  Number(
                    order.subtotal ??
                    order.total ??
                    0
                  );

                return (
                  status === "delivered" &&
                  bill >=
                    LOYALTY_MIN_BILL
                );
              }
            );

          const rewardOrders =
            customerOrders.filter(
              (order) => {

                const cycle =
                  Number(
                    order.loyaltyReward
                      ?.cycle
                  );

                return (
                  Number.isFinite(cycle) &&
                  cycle > 0
                );
              }
            );

          const maxCompletedCycle =
            rewardOrders.length > 0
              ? Math.max(
                  ...rewardOrders.map(
                    (order) =>
                      Number(
                        order.loyaltyReward
                          .cycle
                      )
                  )
                )
              : 0;

          const alreadyAppliedSourceIds =
            new Set(
              customerOrders
                .map(
                  (order) =>
                    order.loyaltyReward
                      ?.sourceOrderId
                )
                .filter(Boolean)
            );

          const activeRewardOrders =
            customerOrders
              .filter((order) => {

                const reward =
                  order.loyaltyReward;

                if (!reward) {
                  return false;
                }

                if (
                  reward.status !==
                    "scratch_pending" &&
                  reward.status !==
                    "available"
                ) {
                  return false;
                }

                if (
                  alreadyAppliedSourceIds.has(
                    order.id
                  )
                ) {
                  return false;
                }

                return true;
              })
              .sort(
                (a, b) =>
                  loyaltyTime(
                    b.loyaltyReward
                      ?.createdAt ||
                    b.createdAt
                  ) -
                  loyaltyTime(
                    a.loyaltyReward
                      ?.createdAt ||
                    a.createdAt
                  )
              );

          const pendingRewardOrder =
            activeRewardOrders[0] ||
            null;

          const nextCycle =
            maxCompletedCycle + 1;

          const requiredOrders =
            maxCompletedCycle * 6 +
            6;

          const rewardReadyForNextOrder =
            qualifyingOrders.length >=
              requiredOrders &&
            !pendingRewardOrder;

          let currentReward = null;

          if (
            rewardReadyForNextOrder
          ) {

            const rewardIndex =
              (nextCycle - 1) %
              LOYALTY_REWARDS.length;

            const reward =
              LOYALTY_REWARDS[
                rewardIndex
              ];

            currentReward = {
              cycle:
                nextCycle,

              rewardIndex,

              type:
                reward.type,

              itemName:
                reward.itemName ||
                null,

              discountPercent:
                Number(
                  reward.discountPercent ||
                  0
                ),

              scratchCardReady: true,
            };
          }

          let progress =
            qualifyingOrders.length -
            maxCompletedCycle * 6;

          progress = Math.max(
            0,
            Math.min(
              progress,
              6
            )
          );

          if (!cancelled) {
            setLoyaltyData({
              loading: false,

              qualifyingOrders:
                progress,

              pendingReward:
                pendingRewardOrder,

              currentReward,
            });
          }

        } catch (error) {

          console.error(
            "Loyalty status error:",
            error
          );

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

  }, [
    customerProfile?.customerId,
  ]);


  /* =======================================================
     DAILY SCRATCH STATUS
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadDailyScratchStatus =
      async () => {

        const customerId =
          customerProfile?.customerId ||
          localStorage.getItem(
            "sugarCafeCustomerId"
          );

        if (!customerId) {
          if (!cancelled) {
            setDailyScratch({
              loading: false,
              eligible:
                Number(totalPrice) >=
                DAILY_SCRATCH_MIN_BILL,
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

          const ordersQuery =
            query(
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
            await getDocs(
              ordersQuery
            );

          if (cancelled) return;

          const scratchOrders =
            snapshot.docs
              .map((orderDoc) => ({
                id: orderDoc.id,
                ...orderDoc.data(),
              }))
              .filter(
                (order) =>
                  order.dailyScratchReward
                    ?.enabled === true
              )
              .sort(
                (a, b) =>
                  loyaltyTime(
                    a.dailyScratchReward
                      ?.createdAt ||
                    a.createdAt
                  ) -
                  loyaltyTime(
                    b.dailyScratchReward
                      ?.createdAt ||
                    b.createdAt
                  )
              );

          const previousCount =
            scratchOrders.length;

          const rewardIndex =
            previousCount %
            DAILY_SCRATCH_REWARDS.length;

          const reward =
            DAILY_SCRATCH_REWARDS[
              rewardIndex
            ];

          let restored = null;

          try {

            const stored =
              sessionStorage.getItem(
                `sugarCafeDailyScratch_${customerId}`
              );

            if (stored) {
              const parsed =
                JSON.parse(stored);

              if (
                parsed &&
                Number(
                  parsed.rewardIndex
                ) === rewardIndex
              ) {
                restored = parsed;
              }
            }

          } catch (storageError) {
            console.warn(
              "Daily scratch session restore error:",
              storageError
            );
          }

          if (!cancelled) {

            setDailyScratch({
              loading: false,

              eligible:
                Number(totalPrice) >=
                DAILY_SCRATCH_MIN_BILL,

              unlocked:
                restored?.unlocked ||
                false,

              revealed:
                restored?.revealed ||
                false,

              reward:
                restored?.reward ||
                reward,

              rewardIndex,

              previousCount,
            });
          }

        } catch (error) {

          console.error(
            "Daily Scratch status error:",
            error
          );

          if (!cancelled) {
            setDailyScratch({
              loading: false,

              eligible:
                Number(totalPrice) >=
                DAILY_SCRATCH_MIN_BILL,

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

  }, [
    customerProfile?.customerId,
    totalPrice,
  ]);


  /* =======================================================
     UPDATE DAILY SCRATCH ELIGIBILITY
  ======================================================= */

  useEffect(() => {

    const eligible =
      Number(totalPrice) >=
      DAILY_SCRATCH_MIN_BILL;

    setDailyScratch((prev) => {

      if (
        prev.eligible === eligible
      ) {
        return prev;
      }

      if (!eligible) {
        return {
          ...prev,

          eligible: false,
          unlocked: false,
          revealed: false,
        };
      }

      return {
        ...prev,
        eligible: true,
      };
    });

  }, [totalPrice]);


  /* =======================================================
     UNLOCK DAILY SCRATCH
  ======================================================= */

  const unlockDailyScratch = () => {

    if (
      Number(totalPrice) <
      DAILY_SCRATCH_MIN_BILL
    ) {
      return;
    }

    const reward =
      dailyScratch.reward ||
      DAILY_SCRATCH_REWARDS[
        Number.isFinite(
          dailyScratch.rewardIndex
        )
          ? dailyScratch.rewardIndex
          : 0
      ];

    const rewardIndex =
      Number.isFinite(
        dailyScratch.rewardIndex
      )
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
        localStorage.getItem(
          "sugarCafeCustomerId"
        ) ||
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


  /* =======================================================
     DAILY SCRATCH REVEAL
  ======================================================= */

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

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 300)
    );

    const state = {
      unlocked: true,
      revealed: true,
      reward:
        dailyScratch.reward,
      rewardIndex:
        dailyScratch.rewardIndex,
    };

    try {

      const customerId =
        customerProfile?.customerId ||
        localStorage.getItem(
          "sugarCafeCustomerId"
        ) ||
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
     DISTANCE
  ======================================================= */

  const calculateDistance = (
    lat1,
    lon1,
    lat2,
    lon2
  ) => {

    const R = 6371;

    const dLat =
      ((lat2 - lat1) *
        Math.PI) /
      180;

    const dLon =
      ((lon2 - lon1) *
        Math.PI) /
      180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(
        (lat1 * Math.PI) /
        180
      ) *
      Math.cos(
        (lat2 * Math.PI) /
        180
      ) *
      Math.sin(dLon / 2) ** 2;

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;
  };


  const distance =
    calculateDistance(
      SHOP_LOCATION.lat,
      SHOP_LOCATION.lng,
      marker.lat,
      marker.lng
    );


  const deliveryAvailable =
    distance <=
    maxDeliveryDistanceKm;


  /* =======================================================
     DELIVERY CHARGE
  ======================================================= */

  let deliveryCharge = 0;

  if (
    !isTakeaway &&
    Number(totalPrice) > 0 &&
    deliveryAvailable
  ) {

    const roundedDistance =
      Math.ceil(distance);

    deliveryCharge =
      roundedDistance *
      deliveryPerKm;

    if (
      deliveryCharge <
      minDeliveryCharge
    ) {
      deliveryCharge =
        minDeliveryCharge;
    }

    if (
      deliveryCharge >
      maxDeliveryCharge
    ) {
      deliveryCharge =
        maxDeliveryCharge;
    }
  }


  /* =======================================================
     CURRENT 6 + 1 REWARD
  ======================================================= */

  const currentReward =
    loyaltyData.currentReward ||
    null;


  /* =======================================================
     PREVIOUS 6 + 1 SCRATCH REWARD
  ======================================================= */

  const pendingReward =
    loyaltyData.pendingReward
      ?.loyaltyReward ||
    null;

  const pendingRewardStatus =
    pendingReward?.status ||
    "";

  const rewardAvailable =
    Boolean(
      pendingReward &&
      pendingRewardStatus ===
        "available"
    );


  /* =======================================================
     TOTAL DISCOUNT
  ======================================================= */

  let discount = 0;


  /* 6 + 1 discount */

  if (
    rewardAvailable &&
    pendingReward.type ===
      "discount" &&
    Number(
      pendingReward.discountPercent
    ) === 5
  ) {

    discount +=
      Number(totalPrice) *
      0.05;
  }


  /* Daily Scratch 5% */

  if (
    dailyScratch.revealed &&
    dailyScratch.reward?.type ===
      "discount" &&
    Number(
      dailyScratch.reward.discountPercent
    ) === 5
  ) {

    discount +=
      Number(totalPrice) *
      0.05;
  }


  discount =
    Math.round(
      discount * 100
    ) / 100;

  const gst = 0;

  const grandTotal =
    Number(totalPrice) +
    Number(deliveryCharge) -
    Number(discount) +
    Number(gst);


  /* =======================================================
     REVERSE GEOCODING
     
     ONLY USED FOR CURRENT GPS LOCATION.
     Manual address DOES NOT use this.
  ======================================================= */

  const reverseGeocode =
    async (
      latitude,
      longitude
    ) => {

      try {

        const response =
          await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=en`,
            {
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            "Address lookup failed"
          );
        }

        const data =
          await response.json();

        return (
          data.display_name ||
          `${latitude}, ${longitude}`
        );

      } catch (error) {

        console.error(
          "Reverse geocoding error:",
          error
        );

        return `${latitude}, ${longitude}`;
      }
    };


  /* =======================================================
     MANUAL ADDRESS
     
     IMPORTANT:
     No Google/Nominatim search.
     Address is saved exactly as typed.
  ======================================================= */

  const useManualAddress = () => {

    const value =
      manualAddress.trim();

    if (!value) {

      alert(
        "Please enter your complete delivery address."
      );

      return;
    }

    /*
     * Keep the typed address exactly as entered.
     */

    setAddress(value);

    /*
     * Coordinates come from the current map pin.
     */

    const savedLocation = {
      latitude: Number(marker.lat),
      longitude: Number(marker.lng),
      address: value,
      fullAddress: value,
      manualAddress: true,
      savedAt:
        new Date().toISOString(),
    };

    try {

      localStorage.setItem(
        "userLocation",
        JSON.stringify(
          savedLocation
        )
      );

    } catch (error) {

      console.error(
        "Manual address local save error:",
        error
      );
    }


    /*
     * Also update local customer profile
     * immediately when available.
     */

    try {

      const savedUser =
        localStorage.getItem(
          "sugarCafeUser"
        );

      if (savedUser) {

        const profile =
          JSON.parse(
            savedUser
          );

        const customerId =
          profile.customerId ||
          localStorage.getItem(
            "sugarCafeCustomerId"
          ) ||
          "";

        const newAddress = {

          id:
            `manual-${Date.now()}`,

          label:
            "Delivery Address",

          address:
            value,

          fullAddress:
            value,

          latitude:
            Number(marker.lat),

          longitude:
            Number(marker.lng),

          manualAddress:
            true,

          savedAt:
            new Date().toISOString(),
        };

        const existingAddresses =
          Array.isArray(
            profile.addresses
          )
            ? profile.addresses
            : [];

        const alreadyExists =
          existingAddresses.some(
            (item) =>
              String(
                item.address || ""
              ).trim() === value &&
              Number(
                item.latitude
              ) ===
                Number(marker.lat) &&
              Number(
                item.longitude
              ) ===
                Number(marker.lng)
          );

        const updatedAddresses =
          alreadyExists
            ? existingAddresses
            : [
                ...existingAddresses,
                newAddress,
              ];

        const updatedProfile = {
          ...profile,

          customerId,

          addresses:
            updatedAddresses,

          defaultAddress:
            newAddress,

          guest: false,

          loggedIn: true,
        };

        localStorage.setItem(
          "sugarCafeUser",
          JSON.stringify(
            updatedProfile
          )
        );

        localStorage.setItem(
          "sugarCafeCustomerId",
          customerId
        );

        setCustomerProfile(
          updatedProfile
        );

        setSavedAddresses(
          updatedAddresses
        );
      }

    } catch (error) {

      console.error(
        "Manual address profile save error:",
        error
      );
    }


    alert(
      "✓ Delivery address saved successfully."
    );
  };


  /* =======================================================
     CURRENT LOCATION
  ======================================================= */

  const getCurrentLocation =
    () => {

      if (
        !navigator.geolocation
      ) {

        alert(
          "Your browser does not support location."
        );

        return;
      }

      setLoadingLocation(true);

      navigator.geolocation.getCurrentPosition(

        async (position) => {

          try {

            const {
              latitude,
              longitude,
            } = position.coords;

            const newLocation = {
              lat: latitude,
              lng: longitude,
            };

            setMapCenter(
              newLocation
            );

            setMarker(
              newLocation
            );

            const detectedAddress =
              await reverseGeocode(
                latitude,
                longitude
              );

            setAddress(
              detectedAddress
            );

            setManualAddress(
              detectedAddress
            );

            localStorage.setItem(
              "userLocation",
              JSON.stringify({
                latitude,
                longitude,
                address:
                  detectedAddress,
                fullAddress:
                  detectedAddress,
              })
            );

            if (mapRef.current) {

              mapRef.current.setView(
                [
                  latitude,
                  longitude,
                ],
                16,
                {
                  animate: true,
                }
              );
            }

          } catch (error) {

            console.error(
              "Location processing error:",
              error
            );

            alert(
              "Location mil gayi, lekin address load nahi ho paya."
            );

          } finally {

            setLoadingLocation(false);
          }
        },

        (error) => {

          console.error(
            "Location Error:",
            error
          );

          setLoadingLocation(false);

          if (
            error.code ===
            error.PERMISSION_DENIED
          ) {

            alert(
              "Location permission denied. Browser settings mein location permission Allow karein."
            );

          } else if (
            error.code ===
            error.POSITION_UNAVAILABLE
          ) {

            alert(
              "Your location is currently unavailable. Please try again."
            );

          } else if (
            error.code ===
            error.TIMEOUT
          ) {

            alert(
              "Location lene mein time lag raha hai. Please try again."
            );

          } else {

            alert(
              "Unable to get your location."
            );
          }
        },

        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    };


  /* =======================================================
     MAP LOAD
  ======================================================= */

  const onMapLoad = (map) => {
    mapRef.current = map;
  };


  /* =======================================================
     MARKER DRAG
     
     IMPORTANT:
     Dragging pin changes coordinates only.
     It does NOT replace the customer's typed address.
  ======================================================= */

  const onMarkerDragEnd =
    (event) => {

      const position =
        event.target.getLatLng();

      const lat =
        Number(position.lat);

      const lng =
        Number(position.lng);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return;
      }

      const newLocation = {
        lat,
        lng,
      };

      setMarker(
        newLocation
      );

      setMapCenter(
        newLocation
      );


      /*
       * Preserve the current address text.
       */

      const currentAddress =
        address.trim();


      /*
       * Save the new coordinates locally.
       */

      try {

        localStorage.setItem(
          "userLocation",
          JSON.stringify({
            latitude: lat,
            longitude: lng,
            address:
              currentAddress,
            fullAddress:
              currentAddress,
            manualAddress:
              Boolean(currentAddress),
            savedAt:
              new Date().toISOString(),
          })
        );

      } catch (error) {

        console.error(
          "Marker location save error:",
          error
        );
      }


      /*
       * Do NOT reverse geocode here.
       *
       * Distance and delivery charge are automatically
       * recalculated because marker state changed.
       */
    };


  /* =======================================================
     CUSTOMER DATA
  ======================================================= */

  const getCustomerData =
    () => {

      if (!customerProfile) {
        return null;
      }

      return {
        userId:
          customerProfile.uid ||
          "",

        customerId:
          customerProfile.customerId ||
          localStorage.getItem(
            "sugarCafeCustomerId"
          ) ||
          "",

        customerName:
          customerProfile.name ||
          "Customer",

        customerPhone:
          customerProfile.phone ||
          "",

        customerEmail:
          customerProfile.email ||
          "",

        photoURL:
          customerProfile.photoURL ||
          "",
      };
    };


  /* =======================================================
     EXACT MENU ITEM
  ======================================================= */

  const findLoyaltyMenuItem =
    async (rewardName) => {

      if (!rewardName) {
        return null;
      }

      try {

        const menuSnapshot =
          await getDocs(
            collection(
              db,
              "menu"
            )
          );

        const menuItems =
          menuSnapshot.docs.map(
            (menuDoc) => ({
              id: menuDoc.id,
              ...menuDoc.data(),
            })
          );

        const wanted =
          normalizeMenuName(
            rewardName
          );

        const exact =
          menuItems.find(
            (item) => {

              const menuName =
                item.name ||
                item.title ||
                "";

              return (
                normalizeMenuName(
                  menuName
                ) === wanted
              );
            }
          );

        return exact || null;

      } catch (error) {

        console.error(
          "Menu lookup error:",
          error
        );

        return null;
      }
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


  /* =======================================================
     SAVE CUSTOMER ADDRESS
  ======================================================= */

  const saveCustomerAddress =
    async () => {

      const selectedAddress = {
        id:
          `${Date.now()}`,

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

        const savedUser =
          localStorage.getItem(
            "sugarCafeUser"
          );

        if (savedUser) {

          const profile =
            JSON.parse(
              savedUser
            );

          const customerId =
            profile.customerId ||
            localStorage.getItem(
              "sugarCafeCustomerId"
            ) ||
            "";

          const existingAddresses =
            Array.isArray(
              profile.addresses
            )
              ? profile.addresses
              : [];

          const alreadyExists =
            existingAddresses.some(
              (item) =>
                item.address ===
                  selectedAddress.address &&
                Number(
                  item.latitude
                ) ===
                  Number(
                    selectedAddress.latitude
                  ) &&
                Number(
                  item.longitude
                ) ===
                  Number(
                    selectedAddress.longitude
                  )
            );

          const updatedAddresses =
            alreadyExists
              ? existingAddresses
              : [
                  ...existingAddresses,
                  selectedAddress,
                ];

          const updatedProfile = {
            ...profile,

            customerId,

            addresses:
              updatedAddresses,

            defaultAddress:
              selectedAddress,

            guest: false,

            loggedIn: true,
          };

          localStorage.setItem(
            "sugarCafeUser",
            JSON.stringify(
              updatedProfile
            )
          );

          localStorage.setItem(
            "sugarCafeCustomerId",
            customerId
          );

          setCustomerProfile(
            updatedProfile
          );

          setSavedAddresses(
            updatedAddresses
          );

          if (customerId) {

            try {

              const customerQuery =
                query(
                  collection(
                    db,
                    "customers"
                  ),
                  where(
                    "customerId",
                    "==",
                    customerId
                  )
                );

              const customerSnapshot =
                await getDocs(
                  customerQuery
                );

              if (
                !customerSnapshot.empty
              ) {

                await updateDoc(
                  doc(
                    db,
                    "customers",
                    customerSnapshot
                      .docs[0].id
                  ),
                  {
                    addresses:
                      updatedAddresses,

                    defaultAddress:
                      selectedAddress,

                    updatedAt:
                      Timestamp.now(),
                  }
                );
              }

            } catch (
              firebaseError
            ) {

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
     SAVE COMPLETED ORDER
  ======================================================= */

  const saveCompletedOrder =
    async (
      orderData,
      selectedAddress
    ) => {

      const orderRef =
        await addDoc(
          collection(
            db,
            "orders"
          ),
          orderData
        );


      /* 6 + 1 source reward */

      if (
        orderData.loyaltyReward
          ?.sourceOrderId
      ) {

        try {

          await updateDoc(
            doc(
              db,
              "orders",
              orderData
                .loyaltyReward
                .sourceOrderId
            ),
            {
              "loyaltyReward.status":
                "applied",

              "loyaltyReward.appliedOrderId":
                orderRef.id,

              "loyaltyReward.appliedAt":
                Timestamp.now(),
            }
          );

        } catch (error) {

          console.error(
            "Source loyalty reward update error:",
            error
          );
        }
      }


      /* Clear Daily Scratch */

      try {

        const customerId =
          orderData.customerId ||
          localStorage.getItem(
            "sugarCafeCustomerId"
          ) ||
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
        localStorage.getItem(
          "sugarCafeUser"
        );

      if (savedUser) {

        try {

          const profile =
            JSON.parse(
              savedUser
            );

          const customerId =
            profile.customerId ||
            orderData.customerId ||
            localStorage.getItem(
              "sugarCafeCustomerId"
            ) ||
            "";

          const existingAddresses =
            Array.isArray(
              profile.addresses
            )
              ? profile.addresses
              : [];

          const alreadyExists =
            existingAddresses.some(
              (item) =>
                item.address ===
                  selectedAddress.address &&
                Number(
                  item.latitude
                ) ===
                  Number(
                    selectedAddress.latitude
                  ) &&
                Number(
                  item.longitude
                ) ===
                  Number(
                    selectedAddress.longitude
                  )
            );

          const updatedAddresses =
            alreadyExists
              ? existingAddresses
              : [
                  ...existingAddresses,
                  selectedAddress,
                ];

          const updatedProfile = {
            ...profile,

            customerId,

            addresses:
              updatedAddresses,

            defaultAddress:
              selectedAddress,

            guest: false,

            loggedIn: true,
          };

          localStorage.setItem(
            "sugarCafeUser",
            JSON.stringify(
              updatedProfile
            )
          );

          localStorage.setItem(
            "sugarCafeCustomerId",
            customerId
          );

          setCustomerProfile(
            updatedProfile
          );

          setSavedAddresses(
            updatedAddresses
          );

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

        return JSON.parse(raw);

      } catch {

        const preview =
          raw
            .replace(
              /\s+/g,
              " "
            )
            .slice(0, 180);

        throw new Error(
          `Payment service returned an invalid response (HTTP ${response.status}). ${preview}`
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

      const paymentBaseUrl =
        (
          import.meta.env
            .VITE_PAYMENT_API_URL ||
          ""
        ).replace(/\/$/, "");


      const gatewayResponse =
        await fetch(
          `${paymentBaseUrl}/api/payment/create-order`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              orderData,
              selectedAddress,
            }),
          }
        );


      const gatewayData =
        await readApiResponse(
          gatewayResponse
        );


      if (!gatewayResponse.ok) {

        throw new Error(
          gatewayData.error ||
          "Unable to start online payment."
        );
      }


      const loaded =
        await loadRazorpay();


      if (!loaded) {

        throw new Error(
          "Payment gateway load nahi ho paya. Internet connection check karein."
        );
      }


      await new Promise(
        (
          resolve,
          reject
        ) => {

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


          const razorpay =
            new window.Razorpay({

              key:
                gatewayData.keyId,

              amount:
                gatewayData.amount,

              currency:
                gatewayData.currency,

              name:
                "Sugar Cafe",

              description:
                `Sugar Cafe Order ${orderData.orderNumber}`,

              order_id:
                gatewayData.orderId,

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
                  response
                ) => {

                  try {

                    const verifyResponse =
                      await fetch(
                        `${paymentBaseUrl}/api/payment/verify`,
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
                                razorpayOrderId:
                                  response.razorpay_order_id,

                                razorpayPaymentId:
                                  response.razorpay_payment_id,

                                razorpaySignature:
                                  response.razorpay_signature,
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

                      fail(
                        new Error(
                          "Payment verification failed."
                        )
                      );

                      return;
                    }


                    if (
                      !verifyData.finalized
                    ) {

                      const paidOrder = {
                        ...orderData,

                        paymentMethod:
                          "Online Payment",

                        paymentStatus:
                          "Paid",

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

                ondismiss:
                  () => {

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
                  response?.error
                    ?.description ||
                  "Payment failed. Please try again."
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

  const placeOrder =
    async () => {

      if (
        loyaltyData.loading
      ) {

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
        paymentMethod ===
          "Online Payment" &&
        !upiEnabled
      ) {

        alert(
          "Online payment is currently unavailable. Please choose another payment method."
        );

        return;
      }


      if (
        paymentMethod ===
          "Cash on Delivery" &&
        !codEnabled
      ) {

        alert(
          "Cash on Delivery is currently unavailable. Please choose another payment method."
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
        !customerProfile ||
        !customerProfile.name ||
        !customerProfile.phone
      ) {

        alert(
          "Please login with your customer account before placing the order."
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
        !customer?.customerPhone
      ) {

        alert(
          "Mobile number is required to place the order."
        );

        return;
      }


      if (
        !customer?.customerId
      ) {

        alert(
          "Customer account is not ready. Please login again."
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


      if (!isTakeaway) {

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


      /* DAILY SCRATCH VALIDATION */

      if (
        Number(totalPrice) >=
        DAILY_SCRATCH_MIN_BILL
      ) {

        if (
          !dailyScratch.unlocked
        ) {

          alert(
            "🎁 Your bill is eligible for Daily Scratch & Win. Please select a payment method and scratch your card before placing the order."
          );

          return;
        }


        if (
          !dailyScratch.revealed
        ) {

          alert(
            "🎁 Please scratch your Daily Scratch Card to reveal your reward before placing the order."
          );

          return;
        }
      }


      try {

        setPlacingOrder(true);


        /* NORMAL CART ITEMS */

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
                Number(
                  item.qty ||
                  item.quantity ||
                  1
                ),

              image:
                item.image || "",

              category:
                item.category || "",
            })
          );


        let finalOrderItems = [
          ...orderItems,
        ];

        let orderLoyaltyReward =
          null;

        let orderDailyScratchReward =
          null;


        /* EXISTING 6 + 1 REWARD */

        if (
          pendingReward &&
          pendingReward.status ===
            "available"
        ) {

          const reward =
            pendingReward;

          const sourceOrderId =
            loyaltyData
              .pendingReward
              ?.id ||
            null;


          if (!sourceOrderId) {

            throw new Error(
              "Loyalty reward source order could not be identified."
            );
          }


          orderLoyaltyReward = {

            ...reward,

            sourceOrderId,

            status:
              "applied",

            appliedAt:
              Timestamp.now(),
          };


          if (
            reward.type ===
              "discount" &&
            Number(
              reward.discountPercent
            ) === 5
          ) {

            orderLoyaltyReward.appliedDiscount =
              Number(
                totalPrice
              ) * 0.05;
          }


          if (
            reward.type ===
            "free_menu_item"
          ) {

            let menuItem = null;


            if (
              reward.itemId &&
              reward.itemName
            ) {

              menuItem = {

                id:
                  reward.itemId,

                name:
                  reward.itemName,

                price:
                  Number(
                    reward.itemPrice ||
                    0
                  ),

                image:
                  reward.itemImage ||
                  "",

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
                `Loyalty reward item "${reward.itemName}" is currently unavailable in the menu. Please contact Sugar Cafe before placing this order.`
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

              id:
                menuItem.id,

              name:
                rewardItemName,

              price:
                0,

              qty:
                1,

              image:
                rewardItemImage,

              category:
                menuItem.category ||
                reward.itemCategory ||
                "Loyalty Reward",

              isFreeReward:
                true,

              loyaltyReward:
                true,

              originalPrice:
                rewardItemPrice,
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


        /* NEW 6 + 1 SCRATCH CARD */

        if (
          !orderLoyaltyReward &&
          currentReward?.scratchCardReady
        ) {

          const reward =
            currentReward;


          orderLoyaltyReward = {

            cycle:
              Number(
                reward.cycle
              ),

            rewardIndex:
              Number(
                reward.rewardIndex
              ),

            type:
              reward.type,

            itemName:
              reward.itemName ||
              null,

            discountPercent:
              Number(
                reward.discountPercent ||
                0
              ),

            status:
              "scratch_pending",

            scratchPending:
              true,

            scratchRevealed:
              false,

            source:
              "6+1-loyalty",

            createdAt:
              Timestamp.now(),
          };


          if (
            reward.type ===
            "free_menu_item"
          ) {

            const menuItem =
              await findLoyaltyMenuItem(
                reward.itemName
              );


            if (!menuItem) {

              throw new Error(
                `Loyalty reward item "${reward.itemName}" was not found in the current menu. Please contact Sugar Cafe before placing this order.`
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
              Number(
                menuItem.price ||
                0
              );


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
              "Loyalty Reward";
          }
        }


        /* DAILY SCRATCH & WIN */

        if (
          dailyScratch.eligible &&
          dailyScratch.unlocked &&
          dailyScratch.revealed &&
          dailyScratch.reward
        ) {

          const reward =
            dailyScratch.reward;

          const rewardIndex =
            Number(
              dailyScratch.rewardIndex
            );


          orderDailyScratchReward = {

            enabled:
              true,

            rewardIndex:

              Number.isFinite(
                rewardIndex
              )
                ? rewardIndex
                : 0,

            type:
              reward.type,

            title:
              reward.title ||
              "",

            status:
              "applied",

            scratchRevealed:
              true,

            discountPercent:
              Number(
                reward.discountPercent ||
                0
              ),

            createdAt:
              Timestamp.now(),
          };


          /* DAILY 5% */

          if (
            reward.type ===
              "discount" &&
            Number(
              reward.discountPercent
            ) === 5
          ) {

            orderDailyScratchReward.appliedDiscount =
              Math.round(
                Number(totalPrice) *
                  0.05 *
                  100
              ) / 100;
          }


          /* DAILY FREE FOOD */

          if (
            reward.type ===
            "free_menu_item"
          ) {

            const menuItem =
              await findLoyaltyMenuItem(
                reward.itemName
              );


            if (!menuItem) {

              throw new Error(
                `Daily Scratch reward "${reward.itemName}" is currently unavailable in the menu. Please contact Sugar Cafe before placing this order.`
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
              Number(
                menuItem.price ||
                0
              );


            finalOrderItems.push({

              id:
                menuItem.id,

              name:
                rewardItemName,

              price:
                0,

              qty:
                1,

              image:
                rewardItemImage,

              category:
                menuItem.category ||
                "Daily Scratch Reward",

              isFreeReward:
                true,

              dailyScratchReward:
                true,

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


        /* ORDER DATA */

        const orderData = {

          orderNumber:
            `SC-${Date.now()}`,

          userId:
            customer.userId ||
            "",

          customerId:
            customer.customerId,

          customerName:
            customer.customerName,

          phone:
            customer.customerPhone,

          email:
            customer.customerEmail,

          photoURL:
            customer.photoURL,

          address:
            isTakeaway
              ? TAKEAWAY_STORE.address
              : address,

          storeName:
            isTakeaway
              ? TAKEAWAY_STORE.name
              : cafeName,

          storeAddress:
            isTakeaway
              ? TAKEAWAY_STORE.address
              : "",

          specialNote:
            specialNote.trim(),

          latitude:
            isTakeaway
              ? TAKEAWAY_STORE.lat
              : marker.lat,

          longitude:
            isTakeaway
              ? TAKEAWAY_STORE.lng
              : marker.lng,

          distance:
            isTakeaway
              ? 0
              : Number(
                  distance.toFixed(
                    2
                  )
                ),

          orderType:
            isTakeaway
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

          items:
            finalOrderItems,

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
              discount
            ),

          gst:
            Number(gst),

          total:
            Number(
              grandTotal
            ),

          loyaltyReward:
            orderLoyaltyReward,

          dailyScratchReward:
            orderDailyScratchReward,

          status:
            "New",

          preparationMinutes:
            preparationMinutes,

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


        /* ADDRESS OBJECT */

        const selectedAddress =
          isTakeaway
            ? {

                id:
                  `takeaway-${Date.now()}`,

                label:
                  "Pickup Store",

                address:
                  TAKEAWAY_STORE.address,

                fullAddress:
                  TAKEAWAY_STORE.address,

                latitude:
                  TAKEAWAY_STORE.lat,

                longitude:
                  TAKEAWAY_STORE.lng,

                savedAt:
                  new Date().toISOString(),
              }

            : await saveCustomerAddress();


        /* PAYMENT */

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


        /* SUCCESS */

        alert(
          isTakeaway
            ? "🛍️ Takeaway order received! Sugar Café is preparing your order."
            : "🕐 Order received! Sugar Café is reviewing your order."
        );


        navigate(
          "/success"
        );

      } catch (error) {

        console.error(
          "❌ Order placement error:",
          error
        );

        const message =
          error?.message ||
          "Unknown error";

        alert(
          `Order place nahi ho paya.\n\n${message}`
        );

      } finally {

        setPlacingOrder(false);
      }
    };


  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="checkout-page">

      <h2>
        Checkout
      </h2>


      {/* =================================================
          ORDER TYPE
      ================================================= */}

      <div className="checkout-card">

        <h3>
          🛍️ Order Type
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "10px",
            marginTop: "12px",
          }}
        >

          <button
            type="button"
            onClick={() => {

              setOrderType(
                "Delivery"
              );

              localStorage.setItem(
                "sugarCafeOrderType",
                "Delivery"
              );
            }}

            style={{

              padding: "14px",

              borderRadius:
                "10px",

              border:
                orderType ===
                "Delivery"
                  ? "2px solid #ff4d4f"
                  : "1px solid #ddd",

              background:
                orderType ===
                "Delivery"
                  ? "#fff1f2"
                  : "#fff",

              fontWeight:
                "700",

              cursor:
                "pointer",
            }}
          >
            🚚 Delivery
          </button>


          <button
            type="button"
            onClick={() => {

              setOrderType(
                "Takeaway"
              );

              localStorage.setItem(
                "sugarCafeOrderType",
                "Takeaway"
              );
            }}

            style={{

              padding: "14px",

              borderRadius:
                "10px",

              border:
                orderType ===
                "Takeaway"
                  ? "2px solid #16a34a"
                  : "1px solid #ddd",

              background:
                orderType ===
                "Takeaway"
                  ? "#f0fdf4"
                  : "#fff",

              fontWeight:
                "700",

              cursor:
                "pointer",
            }}
          >
            🛍️ Takeaway
          </button>

        </div>


        {isTakeaway && (

          <div
            style={{

              marginTop:
                "14px",

              padding:
                "12px",

              borderRadius:
                "10px",

              background:
                "#f0fdf4",

              color:
                "#166534",
            }}
          >

            <strong>
              🏪{" "}
              {
                TAKEAWAY_STORE.name
              }
            </strong>

            <br />

            <small>
              {
                TAKEAWAY_STORE.address
              }
            </small>

            <br />

            <small>
              Your order will be
              prepared for pickup.
            </small>

          </div>
        )}

      </div>


      {/* =================================================
          DELIVERY ADDRESS
      ================================================= */}

      {!isTakeaway && (

        <div className="checkout-card">

          <h3>
            📍 Delivery Address
          </h3>


          {customerProfile && (

            <div className="checkout-customer-box">

              <div>
                👤{" "}
                <strong>
                  {
                    customerProfile.name ||
                    "Customer"
                  }
                </strong>
              </div>

              <div>
                📱{" "}
                {
                  customerProfile.phone
                }
              </div>

              {customerProfile.customerId && (

                <div>
                  🆔{" "}
                  {
                    customerProfile.customerId
                  }
                </div>

              )}

            </div>
          )}


          {savedAddresses.length >
            0 && (

            <div className="saved-addresses">

              <strong>
                Saved Addresses
              </strong>

              {savedAddresses.map(
                (saved) => (

                  <button
                    type="button"

                    key={
                      saved.id ||
                      `${saved.latitude}-${saved.longitude}-${saved.address}`
                    }

                    className="saved-address-btn"

                    onClick={() => {

                      const lat =
                        Number(
                          saved.latitude
                        );

                      const lng =
                        Number(
                          saved.longitude
                        );


                      if (
                        !Number.isFinite(
                          lat
                        ) ||
                        !Number.isFinite(
                          lng
                        )
                      ) {
                        return;
                      }


                      const savedAddressText =
                        saved.fullAddress ||
                        saved.address ||
                        "";

                      setAddress(
                        savedAddressText
                      );

                      setManualAddress(
                        savedAddressText
                      );

                      setMarker({
                        lat,
                        lng,
                      });

                      setMapCenter({
                        lat,
                        lng,
                      });


                      localStorage.setItem(
                        "userLocation",
                        JSON.stringify(
                          saved
                        )
                      );
                    }}
                  >

                    📍{" "}
                    {
                      saved.label ||
                      "Address"
                    }

                    <br />

                    <span>
                      {
                        saved.fullAddress ||
                        saved.address
                      }
                    </span>

                  </button>
                )
              )}

            </div>
          )}


          <input
            type="text"

            placeholder="Enter your complete delivery address"

            value={
              address
            }

            onChange={(e) =>
              setAddress(
                e.target.value
              )
            }

            style={{
              width: "100%",
              padding: "12px",
              marginTop: "5px",
              borderRadius: "10px",
              border:
                "1px solid #ddd",
              boxSizing:
                "border-box",
              fontSize: "15px",
            }}
          />


          {/* =================================================
              MANUAL ADDRESS
          ================================================= */}

          <div className="manual-address-box">

            <label htmlFor="manual-delivery-address">
              ✍️ Enter address manually
            </label>

            <textarea
              id="manual-delivery-address"

              value={
                manualAddress
              }

              onChange={(e) =>
                setManualAddress(
                  e.target.value
                )
              }

              placeholder="House/Flat No., Area, Landmark, City, PIN"

              rows={4}
            />


            <button
              type="button"

              onClick={
                useManualAddress
              }

              className="manual-address-btn"
            >
              ✓ Save This Address
            </button>

          </div>


          {/* CURRENT LOCATION */}

          <button
            type="button"

            onClick={
              getCurrentLocation
            }

            style={{

              marginTop:
                "10px",

              width:
                "100%",

              padding:
                "12px",

              borderRadius:
                "10px",

              border:
                "none",

              background:
                "#ff4d4f",

              color:
                "#fff",

              cursor:
                "pointer",

              fontSize:
                "15px",

              fontWeight:
                "600",
            }}
          >

            {loadingLocation
              ? "Getting Location..."
              : "📍 Use My Current Location"}

          </button>


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
                true
              }

              style={{
                width: "100%",
                height: "100%",
              }}

              whenCreated={
                onMapLoad
              }
            >

              <TileLayer

                attribution='&copy; OpenStreetMap contributors &copy; CARTO'

                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"

                maxZoom={20}
              />


              <MapMover
                position={
                  mapCenter
                }
              />


              <Marker

                position={[
                  marker.lat,
                  marker.lng,
                ]}

                icon={
                  locationIcon
                }

                draggable={
                  true
                }

                eventHandlers={{
                  dragend:
                    onMarkerDragEnd,
                }}
              />

            </MapContainer>

          </div>


          <div
            style={{

              marginTop:
                "10px",

              fontSize:
                "13px",

              color:
                "#777",

              textAlign:
                "center",

              lineHeight:
                "1.5",
            }}
          >
            📍 Drag the red pin to
            your exact delivery
            location.
            <br />
            Address text will remain
            unchanged.
          </div>


          {/* =================================================
              DELIVERY STATUS
          ================================================= */}

          <div
            style={{

              marginTop:
                "12px",

              padding:
                "12px",

              borderRadius:
                "10px",

              background:
                deliveryAvailable
                  ? "#f0fdf4"
                  : "#fff1f2",

              color:
                deliveryAvailable
                  ? "#15803d"
                  : "#dc2626",

              fontWeight:
                "600",
            }}
          >

            {deliveryAvailable ? (

              <>

                📍 Delivery available

                <br />

                Distance:{" "}
                {distance.toFixed(
                  1
                )} km

                <br />

                Delivery charge: ₹
                {
                  deliveryCharge
                }

              </>

            ) : (

              <>

                ⚠️ Delivery unavailable

                <br />

                Your location is{" "}
                {distance.toFixed(
                  1
                )} km away.

                <br />

                We deliver within{" "}
                {
                  maxDeliveryDistanceKm
                } km.

              </>
            )}

          </div>

        </div>
      )}


      {/* =================================================
          TAKEAWAY CUSTOMER
      ================================================= */}

      {isTakeaway &&
        customerProfile && (

          <div className="checkout-card">

            <h3>
              👤 Customer Details
            </h3>

            <div className="checkout-customer-box">

              <div>
                👤{" "}
                <strong>
                  {
                    customerProfile.name ||
                    "Customer"
                  }
                </strong>
              </div>

              <div>
                📱{" "}
                {
                  customerProfile.phone
                }
              </div>

              {customerProfile.customerId && (

                <div>
                  🆔{" "}
                  {
                    customerProfile.customerId
                  }
                </div>

              )}

            </div>

          </div>
        )}


      {/* =================================================
          SPECIAL NOTE
      ================================================= */}

      <div className="checkout-card special-note-card">

        <div className="special-note-heading">

          <div>

            <h3>
              📝 Special Note
            </h3>

            <p>
              Any special request or correction
              for your order?
            </p>

          </div>

          <span>
            OPTIONAL
          </span>

        </div>


        <textarea

          value={
            specialNote
          }

          onChange={(e) =>
            setSpecialNote(
              e.target.value.slice(
                0,
                300
              )
            )
          }

          placeholder="Example: Less spicy, no onion, extra cheese, birthday message, etc."

          rows={4}

          maxLength={300}
        />


        <div className="special-note-footer">

          <small>
            Please write any special
            request you want the
            café to know.
          </small>

          <small>
            {
              specialNote.length
            }
            /300
          </small>

        </div>

      </div>


      {/* =================================================
          PAYMENT
      ================================================= */}

      <div className="checkout-card">

        <h3>
          💳 Payment Method
        </h3>


        <label>

          <input
            type="radio"

            name="payment"

            disabled={
              !codEnabled
            }

            checked={
              paymentMethod ===
              "Cash on Delivery"
            }

            onChange={() => {

              setPaymentMethod(
                "Cash on Delivery"
              );

              if (
                Number(totalPrice) >=
                DAILY_SCRATCH_MIN_BILL
              ) {
                unlockDailyScratch();
              }
            }}
          />


          <span>

            <strong>
              Cash on Delivery
            </strong>

            <small>
              Pay when your order
              is delivered
            </small>

          </span>

        </label>


        <label>

          <input
            type="radio"

            name="payment"

            disabled={
              !upiEnabled
            }

            checked={
              paymentMethod ===
              "Online Payment"
            }

            onChange={() => {

              setPaymentMethod(
                "Online Payment"
              );

              if (
                Number(totalPrice) >=
                DAILY_SCRATCH_MIN_BILL
              ) {
                unlockDailyScratch();
              }
            }}
          />


          <span>

            <strong>
              Online Payment
            </strong>

            <small>
              UPI / Card / Net Banking
              via Razorpay
            </small>

          </span>

        </label>


        {paymentMethod ===
          "Online Payment" && (

          <div className="upi-payment-box">

            <strong>
              Secure Online Payment
            </strong>

            <p>
              UPI, cards and net
              banking are processed
              securely by Razorpay.
            </p>

            <small>
              No UTR entry or staff
              payment verification
              is required.
            </small>

          </div>
        )}

      </div>


      {/* =================================================
          DAILY SCRATCH & WIN
      ================================================= */}

      {!dailyScratch.loading &&
        dailyScratch.eligible && (

          <div
            className="checkout-card"
            style={{
              background:
                "linear-gradient(135deg,#fff7ed,#ffffff)",
              border:
                "1px solid #fed7aa",
              overflow:
                "hidden",
            }}
          >

            <div
              style={{
                textAlign:
                  "center",
              }}
            >

              <div
                style={{
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  gap:
                    "8px",
                  padding:
                    "7px 13px",
                  borderRadius:
                    "999px",
                  background:
                    "#fff1f2",
                  color:
                    "#dc2626",
                  fontSize:
                    "12px",
                  fontWeight:
                    "800",
                  letterSpacing:
                    ".8px",
                }}
              >
                🎁 DAILY SCRATCH & WIN
              </div>


              <h3
                style={{
                  margin:
                    "14px 0 6px",
                  fontSize:
                    "22px",
                }}
              >
                Daily Scratch Reward
              </h3>


              {!dailyScratch.unlocked && (

                <>
                  <p
                    style={{
                      color:
                        "#666",
                      lineHeight:
                        "1.6",
                      margin:
                        "0 auto",
                      maxWidth:
                        "400px",
                    }}
                  >
                    Your ₹
                    {
                      Number(
                        totalPrice
                      ).toFixed(0)
                    }{" "}
                    order qualifies for
                    today's Scratch & Win.
                  </p>


                  <div
                    style={{
                      marginTop:
                        "14px",
                      padding:
                        "12px",
                      borderRadius:
                        "12px",
                      background:
                        "#fff",
                      border:
                        "1px dashed #f59e0b",
                      color:
                        "#92400e",
                      fontWeight:
                        "700",
                    }}
                  >
                    💳 Select a payment method
                    above to unlock your scratch
                    card.
                  </div>

                </>
              )}


              {dailyScratch.unlocked &&
                !dailyScratch.revealed && (

                  <>
                    <p
                      style={{
                        color:
                          "#666",
                        margin:
                          "8px 0 0",
                      }}
                    >
                      Your card is unlocked.
                      Scratch it to reveal
                      today's reward.
                    </p>


                    <DailyScratchCard
                      disabled={
                        dailyScratchRevealing
                      }
                      onReveal={
                        revealDailyScratch
                      }
                    />

                  </>
                )}


              {dailyScratch.revealed &&
                dailyScratch.reward && (

                  <div
                    style={{
                      marginTop:
                        "18px",
                      padding:
                        "20px",
                      borderRadius:
                        "18px",
                      background:
                        "linear-gradient(135deg,#fff,#fff7ed)",
                      border:
                        "1px solid #fdba74",
                      boxShadow:
                        "0 10px 30px rgba(0,0,0,.06)",
                    }}
                  >

                    <div
                      style={{
                        fontSize:
                          "48px",
                      }}
                    >
                      🎉
                    </div>


                    <div
                      style={{
                        marginTop:
                          "8px",
                        fontSize:
                          "12px",
                        fontWeight:
                          "800",
                        letterSpacing:
                          "1px",
                        color:
                          "#888",
                      }}
                    >
                      YOU WON
                    </div>


                    <h3
                      style={{
                        margin:
                          "7px 0",
                        fontSize:
                          "25px",
                        color:
                          "#111",
                      }}
                    >
                      {
                        dailyScratch
                          .reward
                          .title
                      }
                    </h3>


                    {dailyScratch
                      .reward
                      .type ===
                      "discount" ? (

                      <p
                        style={{
                          margin:
                            "8px 0 0",
                          color:
                            "#15803d",
                          fontWeight:
                            "700",
                        }}
                      >
                        🎁 5% discount
                        applied to this
                        current order.
                      </p>

                    ) : (

                      <p
                        style={{
                          margin:
                            "8px 0 0",
                          color:
                            "#15803d",
                          fontWeight:
                            "700",
                        }}
                      >
                        🎁 Your free item
                        will be added to
                        this order.
                      </p>

                    )}

                  </div>
                )}

            </div>

          </div>
        )}


      {/* =================================================
          BELOW ₹499
      ================================================= */}

      {!dailyScratch.loading &&
        Number(totalPrice) > 0 &&
        Number(totalPrice) <
          DAILY_SCRATCH_MIN_BILL && (

          <div
            className="checkout-card"
            style={{
              background:
                "#fff",
              border:
                "1px dashed #ddd",
            }}
          >

            <div
              style={{
                fontWeight:
                  "800",
                fontSize:
                  "14px",
              }}
            >
              🎁 Daily Scratch & Win
            </div>

            <div
              style={{
                marginTop:
                  "6px",
                color:
                  "#777",
                fontSize:
                  "13px",
              }}
            >
              Add ₹
              {Math.max(
                0,
                DAILY_SCRATCH_MIN_BILL -
                  Number(totalPrice)
              ).toFixed(0)}
              {" "}
              more to unlock today's
              Scratch & Win.
            </div>

          </div>
        )}


      {/* =================================================
          SUGAR REWARDS 6 + 1
      ================================================= */}

      {!loyaltyData.loading &&
        (
          currentReward ||
          pendingReward
        ) && (

          <div className="checkout-card loyalty-unlock-card">

            <div className="loyalty-header">

              <div className="loyalty-icon">
                🎁
              </div>

              <div>

                <span className="loyalty-kicker">
                  SUGAR REWARDS
                </span>

                <h3 className="loyalty-heading">

                  {currentReward?.scratchCardReady
                    ? "Scratch Card Unlocked!"
                    : pendingReward?.status ===
                      "scratch_pending"
                    ? "Your Scratch Card"
                    : "Reward Ready"}

                </h3>

              </div>

            </div>


            <div className="loyalty-unlock-content">

              {currentReward?.scratchCardReady ? (

                <>

                  <div className="loyalty-ticket">
                    🎫✨
                  </div>


                  <h3 className="loyalty-scratch-title">
                    Scratch Card Unlocked!
                  </h3>


                  <p className="loyalty-unlock-description">

                    You’ve completed 6 qualifying
                    orders!

                    <br />

                    This is your{" "}
                    <strong>
                      7th order.
                    </strong>

                    <br />
                    <br />

                    Place this order to unlock
                    your Scratch Card.

                    <br />

                    After your order is placed,
                    scratch the card to reveal
                    your reward. 🎉

                  </p>


                  <div className="loyalty-next-order-notice">

                    🎁 Your reward can be used on your{" "}
                    <strong>
                      next order.
                    </strong>

                  </div>

                </>


              ) : pendingReward?.status ===
                "scratch_pending" ? (

                <div className="loyalty-scratch-pending">

                  <div className="loyalty-ticket">
                    🎫
                  </div>


                  <span className="loyalty-scratch-pending-title">
                    Your Scratch Card is Waiting!
                  </span>


                  <span className="loyalty-scratch-pending-text">

                    Your order has been created.

                    <br />

                    Scratch your digital card
                    to reveal your reward. 🎉

                  </span>


                  <button
                    type="button"
                    className="loyalty-scratch-button"

                    onClick={() =>
                      navigate(
                        "/orders"
                      )
                    }
                  >
                    🎁 Scratch My Card
                  </button>

                </div>


              ) : (

                <>

                  {pendingReward?.type ===
                  "discount" ? (

                    <>

                      <div className="loyalty-ticket">
                        🎉
                      </div>


                      <h3 className="loyalty-scratch-title">
                        5% OFF
                      </h3>


                      <p className="loyalty-unlock-description">

                        Your Scratch Card reward
                        has been revealed.

                        <br />

                        <strong>
                          5% discount
                        </strong>{" "}
                        will be applied to this
                        order.

                      </p>


                      <div className="loyalty-next-order-notice">

                        🎉 Your loyalty reward is
                        being applied to this order.

                      </div>

                    </>


                  ) : (

                    <>

                      {pendingReward?.itemImage && (

                        <img
                          src={
                            pendingReward.itemImage
                          }

                          alt={
                            pendingReward.itemName ||
                            "Sugar Cafe Reward"
                          }

                          style={{

                            width:
                              "100px",

                            height:
                              "100px",

                            objectFit:
                              "cover",

                            borderRadius:
                              "18px",

                            display:
                              "block",

                            margin:
                              "0 auto 12px",

                            boxShadow:
                              "0 8px 20px rgba(0,0,0,.10)",
                          }}
                        />

                      )}


                      <div className="loyalty-ticket">
                        🎁
                      </div>


                      <h3 className="loyalty-scratch-title">

                        FREE{" "}
                        {
                          pendingReward?.itemName
                        }

                      </h3>


                      <p className="loyalty-unlock-description">

                        Your Scratch Card reward
                        has been revealed.

                        <br />

                        <strong>
                          {
                            pendingReward?.itemName
                          }
                        </strong>{" "}
                        will be added free to
                        this order.

                      </p>


                      <div className="loyalty-next-order-notice">

                        🎉 Loyalty reward applied
                        to this order.

                      </div>

                    </>

                  )}

                </>

              )}

            </div>

          </div>
        )}


      {/* =================================================
          LOYALTY PROGRESS
      ================================================= */}

      {!loyaltyData.loading &&
        !currentReward &&
        !pendingReward &&
        loyaltyData.qualifyingOrders <
          6 && (

          <div
            className="checkout-card"
            style={{
              background:
                "#fff",

              border:
                "1px solid #eee",
            }}
          >

            <div
              style={{
                fontSize:
                  "12px",

                fontWeight:
                  "800",

                letterSpacing:
                  "1px",

                color:
                  "#888",
              }}
            >
              🎁 SUGAR REWARDS
            </div>


            <div
              style={{
                marginTop:
                  "6px",

                fontWeight:
                  "700",

                fontSize:
                  "16px",
              }}
            >

              {
                loyaltyData.qualifyingOrders
              }
              /6 qualifying orders

            </div>


            <div
              style={{
                marginTop:
                  "8px",

                height:
                  "8px",

                borderRadius:
                  "20px",

                background:
                  "#eee",

                overflow:
                  "hidden",
              }}
            >

              <div
                style={{

                  width:
                    `${Math.min(
                      100,
                      (
                        loyaltyData.qualifyingOrders /
                        6
                      ) *
                        100
                    )}%`,

                  height:
                    "100%",

                  borderRadius:
                    "20px",

                  background:
                    "linear-gradient(90deg,#f59e0b,#f97316)",
                }}
              />

            </div>


            <small
              style={{
                display:
                  "block",

                marginTop:
                  "8px",

                color:
                  "#777",
              }}
            >
              ₹500+ delivered orders
              count towards your next
              Scratch Card.
            </small>

          </div>
        )}


      {/* =================================================
          ORDER SUMMARY
      ================================================= */}

      <div className="checkout-card">

        <h3>
          Order Summary
        </h3>


        <p>

          <span>
            Subtotal
          </span>

          <span>
            ₹
            {Number(
              totalPrice
            ).toFixed(0)}
          </span>

        </p>


        <p>

          <span>
            {isTakeaway
              ? "Pickup"
              : "Delivery"}
          </span>

          <span>
            ₹
            {Number(
              deliveryCharge
            ).toFixed(0)}
          </span>

        </p>


        {discount > 0 && (

          <p
            style={{
              color:
                "#15803d",

              fontWeight:
                "700",
            }}
          >

            <span>
              🎁 Discount
            </span>

            <span>
              -₹
              {discount.toFixed(
                2
              )}
            </span>

          </p>
        )}


        {dailyScratch.revealed &&
          dailyScratch.reward && (

          <div
            style={{
              margin:
                "8px 0",
              padding:
                "10px 12px",
              borderRadius:
                "10px",
              background:
                "#fff7ed",
              color:
                "#9a3412",
              fontSize:
                "13px",
              fontWeight:
                "700",
            }}
          >
            🎁 Daily Scratch:{" "}
            {
              dailyScratch.reward.title
            }
          </div>
        )}


        <p>

          <span>
            GST
          </span>

          <span>
            ₹{gst}
          </span>

        </p>


        <hr />


        {isTakeaway && (

          <div
            style={{

              marginBottom:
                "12px",

              padding:
                "10px",

              borderRadius:
                "8px",

              background:
                "#f0fdf4",

              color:
                "#166534",

              fontSize:
                "14px",

              fontWeight:
                "600",
            }}
          >

            🛍️ Takeaway from{" "}
            {
              TAKEAWAY_STORE.name
            }

          </div>
        )}


        <h2>
          ₹
          {grandTotal.toFixed(
            2
          )}
        </h2>


        <button
          className="place-order-btn"

          onClick={
            placeOrder
          }

          disabled={
            placingOrder ||
            loyaltyData.loading ||
            (
              !isTakeaway &&
              (
                !deliveryAvailableSetting ||
                !deliveryAvailable
              )
            )
          }
        >

          {placingOrder

            ? "Placing Order..."

            : loyaltyData.loading

            ? "Checking Rewards..."

            : isTakeaway

            ? "Place Takeaway Order"

            : !deliveryAvailableSetting

            ? `Delivery available ${orderTimingLabel}`

            : !deliveryAvailable

            ? "Delivery Not Available"

            : "Place Delivery Order"}

        </button>

      </div>

    </div>
  );
}


export default Checkout;
