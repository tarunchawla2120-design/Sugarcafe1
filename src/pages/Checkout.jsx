import { useState, useRef, useEffect, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useStoreSettings } from "../context/StoreContext";

import "./Checkout.css";

/* =========================================================
   SUGAR CAFE - CHECKOUT
   FIREBASE-FREE FINAL VERSION

   Firebase:
   ❌ No Firestore
   ❌ No db
   ❌ No addDoc
   ❌ No getDocs
   ❌ No updateDoc

   Orders:
   COD       -> /api/orders/create
   Online    -> /api/payment/create-order
                Razorpay
                /api/payment/verify
                /api/orders/create

   Location:
   GPS + Leaflet + OpenStreetMap + Nominatim
========================================================= */


/* =========================================================
   REWARD SETTINGS
========================================================= */

const DAILY_SCRATCH_MIN_BILL = 499;
const LOYALTY_MIN_BILL = 500;

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

const LOYALTY_REWARDS = [
  {
    type: "free_menu_item",
    itemName: "Classic Cold Coffee",
  },
  {
    type: "free_menu_item",
    itemName: "Cheese Aloo Tikki Burger",
  },
  {
    type: "free_menu_item",
    itemName: "Aloo Cheese Puff",
  },
  {
    type: "free_menu_item",
    itemName: "Paneer Cheese Sandwich",
  },
  {
    type: "free_menu_item",
    itemName: "Diet Coke",
  },
  {
    type: "free_menu_item",
    itemName: "Salted French Fries",
  },
  {
    type: "free_menu_item",
    itemName: "Hot Chocolate Brownie",
  },
  {
    type: "free_menu_item",
    itemName: "Hot Chocolava",
  },
];


/* =========================================================
   STORE
========================================================= */

const TAKEAWAY_STORE = {
  name: "Sugar Crown – NTPC",
  address:
    "NTPC Gate, Sada Colony, Jamnipali, Korba, Chhattisgarh – 495450",
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

function normalizeMenuName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

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

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

function formatAddressFallback(lat, lng) {
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}


/* =========================================================
   API BASE
========================================================= */

const getApiBaseUrl = () => {
  return String(
    import.meta.env.VITE_PAYMENT_API_URL ||
      window.location.origin
  ).replace(/\/$/, "");
};


/* =========================================================
   MAP EVENTS
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

function DailyScratchCard({
  disabled = false,
  onReveal,
}) {
  const canvasRef = useRef(null);
  const scratchingRef = useRef(false);
  const revealedRef = useRef(false);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    canvas.width = 640;
    canvas.height = 320;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const gradient = ctx.createLinearGradient(
      0,
      0,
      640,
      320
    );

    gradient.addColorStop(
      0,
      "#f4f4f4"
    );

    gradient.addColorStop(
      0.5,
      "#cfcfcf"
    );

    gradient.addColorStop(
      1,
      "#eeeeee"
    );

    ctx.globalCompositeOperation =
      "source-over";

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      640,
      320
    );

    ctx.strokeStyle =
      "rgba(0,0,0,.10)";

    ctx.lineWidth = 2;

    for (
      let x = -320;
      x < 640;
      x += 28
    ) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 320, 320);
      ctx.stroke();
    }

    ctx.fillStyle = "#333";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font =
      "800 42px Arial";

    ctx.fillText(
      "SCRATCH HERE",
      320,
      145
    );

    ctx.font =
      "600 23px Arial";

    ctx.fillStyle = "#666";

    ctx.fillText(
      "✨ Reveal your reward ✨",
      320,
      195
    );
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

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        (event.clientX - rect.left) *
        (canvas.width / rect.width),

      y:
        (event.clientY - rect.top) *
        (canvas.height / rect.height),
    };
  };

  const revealCard = () => {
    if (revealedRef.current) return;

    revealedRef.current = true;

    const canvas = canvasRef.current;
    const ctx =
      canvas?.getContext("2d");

    if (ctx) {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    if (typeof onReveal === "function") {
      onReveal();
    }
  };

  const checkScratchPercentage = () => {
    if (revealedRef.current) return;

    const canvas = canvasRef.current;
    const ctx =
      canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    try {
      const imageData =
        ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );

      let transparent = 0;
      let total = 0;

      for (
        let y = 0;
        y < canvas.height;
        y += 10
      ) {
        for (
          let x = 0;
          x < canvas.width;
          x += 10
        ) {
          const index =
            (y * canvas.width + x) *
            4;

          total++;

          if (
            imageData.data[index + 3] <
            80
          ) {
            transparent++;
          }
        }
      }

      if (
        total > 0 &&
        (transparent / total) * 100 >=
          45
      ) {
        revealCard();
      }
    } catch (error) {
      console.error(
        "Scratch error:",
        error
      );
    }
  };

  const scratchAt = (event) => {
    if (
      disabled ||
      revealedRef.current
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const point = getPoint(event);
    const ctx =
      canvas?.getContext("2d");

    if (!canvas || !point || !ctx) {
      return;
    }

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
    <div className="daily-scratch-wrap">
      <div className="daily-scratch-underlay">
        <div className="daily-scratch-gift">
          🎁
        </div>

        <strong>
          Your Daily Reward
        </strong>

        <span>
          Scratch the card to reveal
        </span>
      </div>

      <canvas
        ref={canvasRef}
        className="daily-scratch-canvas"
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerUp
        }
        onPointerCancel={
          handlePointerUp
        }
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

  /* =======================================================
     SETTINGS
  ======================================================= */

  const maxDeliveryDistanceKm =
    Number(
      store.maxDeliveryDistanceKm ??
        15
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
    store.deliveryAvailable ??
    true;

  const upiEnabled =
    store.upiEnabled ?? true;

  const codEnabled =
    store.codEnabled ?? true;

  const cafeName =
    store.cafeName ||
    "Sugar Cafe";

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
     ORDER TYPE
  ======================================================= */

  const [
    orderType,
    setOrderType,
  ] = useState(() =>
    localStorage.getItem(
      "sugarCafeOrderType"
    ) || "Delivery"
  );

  const isTakeaway =
    orderType === "Takeaway";


  /* =======================================================
     BASIC STATE
  ======================================================= */

  const [address, setAddress] =
    useState("");

  const [
    loadingLocation,
    setLoadingLocation,
  ] = useState(false);

  const [
    placingOrder,
    setPlacingOrder,
  ] = useState(false);

  const [
    specialNote,
    setSpecialNote,
  ] = useState("");

  const [
    locationConfirmed,
    setLocationConfirmed,
  ] = useState(false);

  const [
    customerProfile,
    setCustomerProfile,
  ] = useState(null);

  const [
    savedAddresses,
    setSavedAddresses,
  ] = useState([]);


  /* =======================================================
     PAYMENT
  ======================================================= */

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState(() => {
    if (codEnabled) {
      return "Cash on Delivery";
    }

    if (upiEnabled) {
      return "Online Payment";
    }

    return "Cash on Delivery";
  });


  /* =======================================================
     SCRATCH
  ======================================================= */

  const [
    dailyScratch,
    setDailyScratch,
  ] = useState({
    loading: false,
    eligible: false,
    unlocked: false,
    revealed: false,
    reward: null,
    rewardIndex: null,
  });

  const [
    dailyScratchRevealing,
    setDailyScratchRevealing,
  ] = useState(false);


  /* =======================================================
     LOYALTY
  ======================================================= */

  const [
    loyaltyData,
    setLoyaltyData,
  ] = useState({
    loading: false,
    qualifyingOrders: 0,
    pendingReward: null,
    currentReward: null,
  });


  /* =======================================================
     MAP
  ======================================================= */

  const [
    mapCenter,
    setMapCenter,
  ] = useState(
    SHOP_LOCATION
  );

  const [
    marker,
    setMarker,
  ] = useState(
    SHOP_LOCATION
  );

  const mapRef = useRef(null);

  const mapMoveAddressRequestRef =
    useRef(0);


  /* =======================================================
     CUSTOMER
     NO FIREBASE
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
            Array.isArray(
              data.addresses
            )
              ? data.addresses
              : [],

          loggedIn: true,
          guest: false,
        };

        setCustomerProfile(
          profile
        );

        setSavedAddresses(
          profile.addresses
        );
      }

      const savedLocation =
        localStorage.getItem(
          "userLocation"
        );

      if (savedLocation) {
        const loc =
          JSON.parse(savedLocation);

        const lat =
          Number(
            loc.latitude
          );

        const lng =
          Number(
            loc.longitude
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

          const savedAddress =
            loc.fullAddress ||
            loc.address ||
            "";

          if (savedAddress) {
            setAddress(
              savedAddress
            );

            setLocationConfirmed(
              true
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "Checkout local data error:",
        error
      );
    }
  }, []);


  /* =======================================================
     REVERSE GEOCODE
  ======================================================= */

  const reverseGeocode =
    useCallback(
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
            formatAddressFallback(
              latitude,
              longitude
            )
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
     AUTO LOCATION
  ======================================================= */

  useEffect(() => {
    if (isTakeaway) return;

    if (!navigator.geolocation) return;

    let cancelled = false;

    const savedLocation =
      localStorage.getItem(
        "userLocation"
      );

    if (savedLocation) {
      return;
    }

    const timer =
      setTimeout(() => {
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

              const location = {
                lat: latitude,
                lng: longitude,
              };

              setMarker(location);
              setMapCenter(location);

              if (mapRef.current) {
                mapRef.current.setView(
                  [
                    latitude,
                    longitude,
                  ],
                  17,
                  {
                    animate: true,
                  }
                );
              }

              const detectedAddress =
                await reverseGeocode(
                  latitude,
                  longitude
                );

              if (cancelled) return;

              setAddress(
                detectedAddress
              );

              setLocationConfirmed(
                false
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
                  savedAt:
                    new Date().toISOString(),
                })
              );
            } catch (error) {
              console.error(
                "Location processing error:",
                error
              );
            } finally {
              if (!cancelled) {
                setLoadingLocation(
                  false
                );
              }
            }
          },
          (error) => {
            if (cancelled) return;

            console.warn(
              "GPS error:",
              error
            );

            setLoadingLocation(
              false
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000,
          }
        );
      }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isTakeaway,
    reverseGeocode,
  ]);


  /* =======================================================
     DAILY SCRATCH
     LOCAL ONLY
  ======================================================= */

  useEffect(() => {
    const eligible =
      Number(totalPrice) >=
      DAILY_SCRATCH_MIN_BILL;

    const customerId =
      customerProfile?.customerId ||
      localStorage.getItem(
        "sugarCafeCustomerId"
      ) ||
      "guest";

    const storageKey =
      `sugarCafeDailyScratch_${customerId}`;

    if (!eligible) {
      setDailyScratch({
        loading: false,
        eligible: false,
        unlocked: false,
        revealed: false,
        reward: null,
        rewardIndex: null,
      });

      return;
    }

    let restored = null;

    try {
      const stored =
        sessionStorage.getItem(
          storageKey
        );

      if (stored) {
        restored =
          JSON.parse(stored);
      }
    } catch {}

    const rewardIndex =
      Number.isFinite(
        restored?.rewardIndex
      )
        ? restored.rewardIndex
        : Math.floor(
            Math.random() *
              DAILY_SCRATCH_REWARDS.length
          );

    const reward =
      restored?.reward ||
      DAILY_SCRATCH_REWARDS[
        rewardIndex
      ];

    setDailyScratch({
      loading: false,
      eligible: true,
      unlocked:
        restored?.unlocked ||
        false,
      revealed:
        restored?.revealed ||
        false,
      reward,
      rewardIndex,
    });
  }, [
    totalPrice,
    customerProfile?.customerId,
  ]);


  /* =======================================================
     UNLOCK SCRATCH
  ======================================================= */

  const unlockDailyScratch =
    () => {
      if (
        Number(totalPrice) <
        DAILY_SCRATCH_MIN_BILL
      ) {
        return;
      }

      const rewardIndex =
        Number.isFinite(
          dailyScratch.rewardIndex
        )
          ? dailyScratch.rewardIndex
          : 0;

      const reward =
        dailyScratch.reward ||
        DAILY_SCRATCH_REWARDS[
          rewardIndex
        ];

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

      setDailyScratch(
        (prev) => ({
          ...prev,
          eligible: true,
          unlocked: true,
          revealed: false,
          reward,
          rewardIndex,
        })
      );
    };


  /* =======================================================
     REVEAL
  ======================================================= */

  const revealDailyScratch =
    async () => {
      if (
        !dailyScratch.unlocked ||
        dailyScratch.revealed ||
        dailyScratchRevealing
      ) {
        return;
      }

      setDailyScratchRevealing(
        true
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            300
          )
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

      setDailyScratch(
        (prev) => ({
          ...prev,
          revealed: true,
        })
      );

      setDailyScratchRevealing(
        false
      );
    };


  /* =======================================================
     DISTANCE
  ======================================================= */

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
    deliveryCharge =
      Math.ceil(distance) *
      deliveryPerKm;

    deliveryCharge =
      Math.max(
        minDeliveryCharge,
        deliveryCharge
      );

    deliveryCharge =
      Math.min(
        maxDeliveryCharge,
        deliveryCharge
      );
  }


  /* =======================================================
     DISCOUNT
  ======================================================= */

  let discount = 0;

  if (
    dailyScratch.revealed &&
    dailyScratch.reward?.type ===
      "discount"
  ) {
    const percent =
      Number(
        dailyScratch.reward
          .discountPercent || 0
      );

    discount =
      Number(totalPrice) *
      (percent / 100);
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
     MAP MOVE
  ======================================================= */

  const handleMapMoveEnd =
    useCallback(
      async (location) => {
        setMarker(location);
        setMapCenter(location);
        setLocationConfirmed(
          false
        );

        const requestId =
          ++mapMoveAddressRequestRef.current;

        const detectedAddress =
          await reverseGeocode(
            location.lat,
            location.lng
          );

        if (
          requestId !==
          mapMoveAddressRequestRef.current
        ) {
          return;
        }

        setAddress(
          detectedAddress
        );

        try {
          localStorage.setItem(
            "userLocation",
            JSON.stringify({
              latitude:
                location.lat,
              longitude:
                location.lng,
              address:
                detectedAddress,
              fullAddress:
                detectedAddress,
              savedAt:
                new Date().toISOString(),
            })
          );
        } catch {}
      },
      [reverseGeocode]
    );


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
            } =
              position.coords;

            const location = {
              lat: latitude,
              lng: longitude,
            };

            setMarker(location);
            setMapCenter(location);
            setLocationConfirmed(
              false
            );

            if (mapRef.current) {
              mapRef.current.setView(
                [
                  latitude,
                  longitude,
                ],
                17,
                {
                  animate: true,
                }
              );
            }

            const detectedAddress =
              await reverseGeocode(
                latitude,
                longitude
              );

            setAddress(
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
                savedAt:
                  new Date().toISOString(),
              })
            );
          } catch (error) {
            console.error(
              "Location error:",
              error
            );

            alert(
              "Location mil gayi, lekin address load nahi ho paya."
            );
          } finally {
            setLoadingLocation(
              false
            );
          }
        },
        (error) => {
          console.error(
            "GPS Error:",
            error
          );

          setLoadingLocation(
            false
          );

          if (
            error.code ===
            error.PERMISSION_DENIED
          ) {
            alert(
              "Location permission denied. iPhone Settings > Privacy & Security > Location Services mein browser location Allow karein."
            );
          } else {
            alert(
              "Unable to get your current location. Please try again."
            );
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

  const confirmDeliveryLocation =
    () => {
      if (!address.trim()) {
        alert(
          "Please wait until your delivery address is detected."
        );
        return;
      }

      if (!deliveryAvailable) {
        alert(
          `Sorry! We currently deliver within ${maxDeliveryDistanceKm} km of our shop.`
        );
        return;
      }

      setLocationConfirmed(
        true
      );

      try {
        localStorage.setItem(
          "userLocation",
          JSON.stringify({
            latitude: marker.lat,
            longitude: marker.lng,
            address:
              address.trim(),
            fullAddress:
              address.trim(),
            savedAt:
              new Date().toISOString(),
          })
        );
      } catch {}
    };


  /* =======================================================
     SAVED ADDRESS
  ======================================================= */

  const selectSavedAddress =
    (saved) => {
      const lat =
        Number(
          saved.latitude
        );

      const lng =
        Number(
          saved.longitude
        );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return;
      }

      const selected = {
        lat,
        lng,
      };

      setMarker(selected);
      setMapCenter(selected);

      setAddress(
        saved.fullAddress ||
          saved.address ||
          ""
      );

      setLocationConfirmed(
        true
      );

      if (mapRef.current) {
        mapRef.current.setView(
          [
            lat,
            lng,
          ],
          17,
          {
            animate: true,
          }
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

  const getCustomerData =
    () => {
      if (!customerProfile) {
        return null;
      }

      return {
        userId:
          customerProfile.uid ||
          customerProfile.userId ||
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
     ADDRESS SAVE
     LOCAL ONLY
  ======================================================= */

  const saveCustomerAddress =
    async () => {
      const selectedAddress = {
        id: String(Date.now()),
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
            JSON.parse(savedUser);

          const existing =
            Array.isArray(
              profile.addresses
            )
              ? profile.addresses
              : [];

          const exists =
            existing.some(
              (item) =>
                String(
                  item.address || ""
                ).trim() ===
                  selectedAddress.address &&
                Number(
                  item.latitude
                ) ===
                  selectedAddress.latitude &&
                Number(
                  item.longitude
                ) ===
                  selectedAddress.longitude
            );

          const updated =
            exists
              ? existing
              : [
                  ...existing,
                  selectedAddress,
                ];

          const updatedProfile = {
            ...profile,
            addresses: updated,
            defaultAddress:
              selectedAddress,
          };

          localStorage.setItem(
            "sugarCafeUser",
            JSON.stringify(
              updatedProfile
            )
          );

          setCustomerProfile(
            updatedProfile
          );

          setSavedAddresses(
            updated
          );
        }
      } catch (error) {
        console.warn(
          "Local address save error:",
          error
        );
      }

      return selectedAddress;
    };


  /* =======================================================
     API JSON
  ======================================================= */

  const readApiResponse =
    async (response) => {
      const raw =
        await response.text();

      if (!raw) {
        throw new Error(
          `Server returned empty response (HTTP ${response.status}).`
        );
      }

      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(
          `Server returned invalid response (HTTP ${response.status}).`
        );
      }
    };


  /* =======================================================
     CREATE ORDER API
  ======================================================= */

  const createOrderOnServer =
    async (orderData) => {
      const apiBase =
        getApiBaseUrl();

      console.log(
        "🟡 Creating order through API:",
        `${apiBase}/api/orders/create`
      );

      const response =
        await fetch(
          `${apiBase}/api/orders/create`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              orderData
            ),
          }
        );

      const data =
        await readApiResponse(
          response
        );

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            "Order server par save nahi ho paya."
        );
      }

      if (
        data.success === false
      ) {
        throw new Error(
          data.error ||
            "Order creation failed."
        );
      }

      console.log(
        "✅ SERVER ORDER CREATED:",
        data
      );

      return data;
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
     ONLINE PAYMENT
  ======================================================= */

  const startOnlinePayment =
    async ({
      customer,
      orderData,
      selectedAddress,
    }) => {
      const apiBase =
        getApiBaseUrl();

      const createResponse =
        await fetch(
          `${apiBase}/api/payment/create-order`,
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
          createResponse
        );

      if (!createResponse.ok) {
        throw new Error(
          gatewayData.error ||
            gatewayData.message ||
            "Unable to start online payment."
        );
      }

      if (
        !gatewayData.orderId ||
        !gatewayData.keyId
      ) {
        throw new Error(
          "Payment server ne valid Razorpay order return nahi kiya."
        );
      }

      const loaded =
        await loadRazorpay();

      if (!loaded) {
        throw new Error(
          "Razorpay load nahi ho paya. Internet connection check karein."
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
                gatewayData.currency ||
                "INR",

              name:
                cafeName,

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
                    console.log(
                      "🟡 Razorpay payment successful, verifying..."
                    );

                    const verifyResponse =
                      await fetch(
                        `${apiBase}/api/payment/verify`,
                        {
                          method:
                            "POST",

                          headers: {
                            "Content-Type":
                              "application/json",
                          },

                          body:
                            JSON.stringify({
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
                      throw new Error(
                        verifyData.error ||
                          "Payment verification failed."
                      );
                    }

                    /*
                     * Payment verified.
                     * Now create the actual Sugar Cafe order.
                     */
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

                    await createOrderOnServer(
                      paidOrder
                    );

                    success();
                  } catch (error) {
                    console.error(
                      "❌ Payment verification/order error:",
                      error
                    );

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
      if (placingOrder) return;

      if (!cart.length) {
        alert(
          "Your cart is empty."
        );
        return;
      }

      if (
        !deliveryAvailableSetting &&
        !isTakeaway
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
          "Online payment is currently unavailable."
        );
        return;
      }

      if (
        paymentMethod ===
          "Cash on Delivery" &&
        !codEnabled
      ) {
        alert(
          "Cash on Delivery is currently unavailable."
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

      if (!customer?.customerPhone) {
        alert(
          "Mobile number is required."
        );
        return;
      }

      if (!customer?.customerId) {
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

      /* ===================================================
         DELIVERY
      =================================================== */

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
            `Sorry! We currently deliver within ${maxDeliveryDistanceKm} km.`
          );
          return;
        }
      }

      /* ===================================================
         SCRATCH
      =================================================== */

      if (
        Number(totalPrice) >=
        DAILY_SCRATCH_MIN_BILL
      ) {
        if (!dailyScratch.unlocked) {
          alert(
            "🎁 Please unlock your Daily Scratch & Win card first."
          );
          return;
        }

        if (!dailyScratch.revealed) {
          alert(
            "🎁 Please scratch your Daily Scratch Card before placing the order."
          );
          return;
        }
      }

      try {
        setPlacingOrder(true);

        /* =================================================
           ITEMS
        ================================================= */

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

        const finalOrderItems =
          [...orderItems];

        /* =================================================
           DAILY SCRATCH FREE ITEM
        ================================================= */

        let dailyScratchReward =
          null;

        if (
          dailyScratch.eligible &&
          dailyScratch.unlocked &&
          dailyScratch.revealed &&
          dailyScratch.reward
        ) {
          const reward =
            dailyScratch.reward;

          dailyScratchReward = {
            enabled: true,

            rewardIndex:
              Number(
                dailyScratch.rewardIndex ||
                  0
              ),

            type:
              reward.type,

            title:
              reward.title || "",

            discountPercent:
              Number(
                reward.discountPercent ||
                  0
              ),

            status:
              "applied",

            scratchRevealed:
              true,

            createdAt:
              new Date().toISOString(),
          };

          /*
           * Free reward:
           *
           * We don't query Firebase anymore.
           * If reward item is already available
           * in cart/menu data, it can be supplied
           * later by backend.
           */
          if (
            reward.type ===
              "free_menu_item" &&
            reward.itemName
          ) {
            dailyScratchReward.itemName =
              reward.itemName;
          }

          if (
            reward.type ===
              "discount"
          ) {
            dailyScratchReward.appliedDiscount =
              Math.round(
                Number(totalPrice) *
                  Number(
                    reward.discountPercent ||
                      0
                  ) /
                  100 *
                  100
              ) / 100;
          }
        }


        /* =================================================
           ORDER
        ================================================= */

        const orderNumber =
          `SC-${Date.now()}`;

        const orderData = {
          orderNumber,

          userId:
            customer.userId || "",

          customerId:
            customer.customerId,

          customerName:
            customer.customerName,

          phone:
            customer.customerPhone,

          email:
            customer.customerEmail,

          photoURL:
            customer.photoURL || "",

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
                  distance.toFixed(2)
                ),

          orderType:
            isTakeaway
              ? "Takeaway"
              : "Delivery",

          paymentMethod,

          paymentStatus:
            paymentMethod ===
            "Online Payment"
              ? "Pending"
              : "Pending",

          paymentNote: "",

          items:
            finalOrderItems,

          subtotal:
            Number(totalPrice),

          deliveryCharge:
            Number(deliveryCharge),

          discount:
            Number(discount),

          gst:
            Number(gst),

          total:
            Number(grandTotal),

          dailyScratchReward,

          loyaltyReward:
            null,

          status:
            "New",

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
            new Date().toISOString(),
        };


        /* =================================================
           ADDRESS
        ================================================= */

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


        /* =================================================
           PAYMENT / ORDER
        ================================================= */

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
          /*
           * COD:
           * Direct server order creation.
           * NO FIREBASE.
           */
          await createOrderOnServer(
            orderData
          );
        }


        /* =================================================
           SUCCESS
        ================================================= */

        localStorage.setItem(
          "lastOrderNumber",
          orderNumber
        );

        localStorage.setItem(
          "lastOrderPaymentStatus",
          paymentMethod ===
            "Online Payment"
            ? "Paid"
            : "Pending"
        );

        clearCart();

        try {
          const customerId =
            customer.customerId ||
            "guest";

          sessionStorage.removeItem(
            `sugarCafeDailyScratch_${customerId}`
          );
        } catch {}

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
          "========================================"
        );

        console.error(
          "❌ SUGAR CAFE ORDER FAILED"
        );

        console.error(
          error
        );

        console.error(
          "Message:",
          error?.message
        );

        console.error(
          "========================================"
        );

        alert(
          `Order place nahi ho paya.\n\n${
            error?.message ||
            "Please try again."
          }`
        );
      } finally {
        setPlacingOrder(
          false
        );
      }
    };


  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="checkout-page">

      {/* HEADER */}

      <header className="checkout-header">

        <button
          type="button"
          className="checkout-back"
          onClick={() =>
            navigate(-1)
          }
        >
          ←
        </button>

        <div className="checkout-header-content">

          <span className="checkout-eyebrow">
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

          <span className="secure-icon">
            ✓
          </span>

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


      {/* ORDER TYPE */}

      <section className="checkout-card order-type-card">

        <div className="section-heading">

          <div className="section-icon orange-icon">
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
              How would you like to receive your order?
            </p>

          </div>

        </div>


        <div className="order-type-grid">

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
            className={
              orderType ===
              "Delivery"
                ? "order-type-btn delivery active"
                : "order-type-btn delivery"
            }
          >

            <span className="order-type-visual">
              🛵
            </span>

            <span className="order-type-text">

              <strong>
                Delivery
              </strong>

              <small>
                We deliver to your location
              </small>

            </span>

            <span className="radio-modern">
              {orderType ===
                "Delivery" &&
                "✓"}
            </span>

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
            className={
              orderType ===
              "Takeaway"
                ? "order-type-btn takeaway active"
                : "order-type-btn takeaway"
            }
          >

            <span className="order-type-visual">
              🛍️
            </span>

            <span className="order-type-text">

              <strong>
                Takeaway
              </strong>

              <small>
                Pick up from our cafe
              </small>

            </span>

            <span className="radio-modern">
              {orderType ===
                "Takeaway" &&
                "✓"}
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


      {/* DELIVERY LOCATION */}

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
                <span>✓</span>
                Confirmed
              </span>
            ) : (
              <span className="location-detected-badge">
                <span>✦</span>
                Auto Detect
              </span>
            )}

          </div>


          {/* CUSTOMER */}

          {customerProfile && (
            <div className="checkout-customer-box premium-customer-box">

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

              <div className="customer-details">

                <strong>
                  {customerProfile.name ||
                    "Customer"}
                </strong>

                <span>
                  📱{" "}
                  {customerProfile.phone}
                </span>

                {customerProfile.customerId && (
                  <span>
                    🆔{" "}
                    {customerProfile.customerId}
                  </span>
                )}

              </div>

              <span className="customer-verified">
                ✓
              </span>

            </div>
          )}


          {/* SAVED ADDRESSES */}

          {savedAddresses.length >
            0 && (
            <div className="saved-addresses">

              <div className="subsection-title">
                <span>
                  Saved Addresses
                </span>

                <small>
                  Tap to use
                </small>
              </div>

              <div className="saved-address-list">

                {savedAddresses.map(
                  (saved) => (
                    <button
                      type="button"
                      key={
                        saved.id ||
                        `${saved.latitude}-${saved.longitude}`
                      }
                      className="saved-address-btn"
                      onClick={() =>
                        selectSavedAddress(
                          saved
                        )
                      }
                    >

                      <span className="saved-address-icon">
                        📍
                      </span>

                      <span>

                        <strong>
                          {saved.label ||
                            "Address"}
                        </strong>

                        <small>
                          {saved.fullAddress ||
                            saved.address}
                        </small>

                      </span>

                      <span className="saved-arrow">
                        →
                      </span>

                    </button>
                  )
                )}

              </div>

            </div>
          )}


          {/* CURRENT LOCATION */}

          <button
            type="button"
            className="detect-location-button premium-location-button"
            onClick={
              getCurrentLocation
            }
            disabled={
              loadingLocation
            }
          >

            <span className="location-button-icon">
              {loadingLocation
                ? "◌"
                : "⌖"}
            </span>

            <span>
              {loadingLocation
                ? "Detecting your location..."
                : "Use My Current Location"}
            </span>

            {!loadingLocation && (
              <span className="button-arrow">
                →
              </span>
            )}

          </button>


          {/* MAP */}

          <div className="location-picker">

            <div className="location-map premium-map">

              <MapContainer
                center={[
                  mapCenter.lat,
                  mapCenter.lng,
                ]}
                zoom={17}
                scrollWheelZoom={true}
                zoomControl={false}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                whenCreated={
                  onMapCreated
                }
              >

                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />

                <LocationMapEvents
                  onMoveEnd={
                    handleMapMoveEnd
                  }
                />

              </MapContainer>


              <div className="premium-center-pin">

                <div className="pin-pulse" />

                <div className="pin-marker">
                  <div className="pin-inner" />
                </div>

                <div className="pin-shadow" />

              </div>


              <button
                type="button"
                className="map-gps-button premium-gps-button"
                onClick={
                  getCurrentLocation
                }
              >
                ⌾
              </button>


              <div className="map-cafe-label">
                <span>
                  🍴
                </span>

                {cafeName}
              </div>


              <div className="map-status-pill">
                <span className="status-dot" />
                Live location
              </div>

            </div>


            {/* LOCATION INFO */}

            <div className="location-bottom-sheet premium-location-sheet">

              <div className="location-sheet-handle" />

              <div className="location-sheet-title">

                <div className="location-sheet-icon premium-sheet-icon">
                  📍
                </div>

                <div>

                  <strong>
                    Your delivery location
                  </strong>

                  <span>
                    Move the map to adjust your exact location
                  </span>

                </div>

              </div>


              <div
                className={
                  deliveryAvailable
                    ? "selected-location-box available premium-address-box"
                    : "selected-location-box unavailable premium-address-box"
                }
              >

                <div className="location-pin-small">
                  🏠
                </div>

                <div className="selected-location-content">

                  <span className="address-label">
                    Selected address
                  </span>

                  <strong>
                    {address ||
                      "Detecting your location..."}
                  </strong>

                  <span className="address-distance">

                    {address
                      ? `${distance.toFixed(
                          1
                        )} km from ${cafeName}`
                      : "Your address will appear here automatically"}

                  </span>

                </div>

                <button
                  type="button"
                  className="location-refresh premium-refresh"
                  onClick={
                    getCurrentLocation
                  }
                >
                  ⌾
                </button>

              </div>


              <div className="location-delivery-info premium-delivery-info">

                <div className="location-stat">

                  <span className="stat-icon">
                    🗺️
                  </span>

                  <span>
                    <small>
                      Distance
                    </small>

                    <strong>
                      {distance.toFixed(
                        1
                      )} km
                    </strong>
                  </span>

                </div>


                <div className="location-stat">

                  <span className="stat-icon">
                    🛵
                  </span>

                  <span>
                    <small>
                      Delivery charge
                    </small>

                    <strong>
                      {deliveryAvailable
                        ? `₹${deliveryCharge}`
                        : "Unavailable"}
                    </strong>
                  </span>

                </div>

              </div>


              {deliveryAvailable && (
                <div className="delivery-mini-success">

                  <span className="success-check">
                    ✓
                  </span>

                  <div>

                    <strong>
                      Delivery available
                    </strong>

                    <small>
                      We can deliver to this location
                    </small>

                  </div>

                </div>
              )}


              {!deliveryAvailable && (
                <div className="location-error premium-error">

                  <span>
                    ⚠️
                  </span>

                  <div>

                    <strong>
                      Delivery unavailable
                    </strong>

                    <small>
                      We currently deliver within{" "}
                      {maxDeliveryDistanceKm} km.
                    </small>

                  </div>

                </div>
              )}


              {locationConfirmed && (
                <div className="location-confirmed-message premium-confirmed">

                  <span>
                    ✓
                  </span>

                  Delivery location confirmed

                </div>
              )}


              <button
                type="button"
                className="confirm-location-button premium-confirm-button"
                disabled={
                  !address ||
                  !deliveryAvailable ||
                  loadingLocation
                }
                onClick={
                  confirmDeliveryLocation
                }
              >

                {locationConfirmed ? (
                  <>
                    <span>
                      ✓
                    </span>

                    Location Confirmed
                  </>
                ) : (
                  <>
                    Confirm Delivery Location

                    <span>
                      →
                    </span>
                  </>
                )}

              </button>

            </div>

          </div>


          <div className="location-tip premium-tip">

            <span className="tip-icon">
              💡
            </span>

            <span>

              <strong>
                Easy location selection
              </strong>

              <small>
                Map ko finger se move karein. Center pin aapki selected delivery location hai.
              </small>

            </span>

          </div>

        </section>
      )}


      {/* TAKEAWAY CUSTOMER */}

      {isTakeaway &&
        customerProfile && (
          <section className="checkout-card">

            <div className="section-heading compact">

              <div className="section-icon">
                👤
              </div>

              <div>

                <span className="section-kicker">
                  CUSTOMER
                </span>

                <h2>
                  Customer Details
                </h2>

              </div>

            </div>

            <div className="checkout-customer-box premium-customer-box">

              <div className="customer-avatar">
                👤
              </div>

              <div className="customer-details">

                <strong>
                  {customerProfile.name ||
                    "Customer"}
                </strong>

                <span>
                  📱{" "}
                  {customerProfile.phone}
                </span>

              </div>

            </div>

          </section>
        )}


      {/* SPECIAL NOTE */}

      <section className="checkout-card special-note-card premium-note-card">

        <div className="special-note-heading">

          <div className="section-heading compact">

            <div className="section-icon">
              📝
            </div>

            <div>

              <span className="section-kicker">
                OPTIONAL
              </span>

              <h2>
                Special Note
              </h2>

              <p>
                Any special request for your order?
              </p>

            </div>

          </div>

          <span className="optional-pill">
            OPTIONAL
          </span>

        </div>


        <div className="note-input-wrapper">

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
            placeholder="Example: Less spicy, no onion, extra cheese, birthday message..."
            rows={4}
            maxLength={300}
          />

          <span className="textarea-icon">
            ✎
          </span>

        </div>


        <div className="special-note-footer">

          <small>
            Your request will be shared with the café.
          </small>

          <small>
            {specialNote.length}/300
          </small>

        </div>

      </section>


      {/* PAYMENT */}

      <section className="checkout-card payment-card">

        <div className="section-heading">

          <div className="section-icon blue-icon">
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
              Choose how you want to pay
            </p>

          </div>

        </div>


        <div className="payment-options">

          <label
            className={
              paymentMethod ===
              "Cash on Delivery"
                ? "payment-option active"
                : "payment-option"
            }
          >

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

            <span className="payment-icon cod-icon">
              💵
            </span>

            <span className="payment-content">

              <strong>
                Cash on Delivery
              </strong>

              <small>
                Pay when your order arrives
              </small>

            </span>

            <span className="payment-check">
              ✓
            </span>

          </label>


          <label
            className={
              paymentMethod ===
              "Online Payment"
                ? "payment-option active online"
                : "payment-option online"
            }
          >

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

            <span className="payment-icon online-icon">
              💳
            </span>

            <span className="payment-content">

              <strong>
                Online Payment
              </strong>

              <small>
                UPI / Card / Net Banking
              </small>

            </span>

            <span className="payment-check">
              ✓
            </span>

          </label>

        </div>


        {paymentMethod ===
          "Online Payment" && (
          <div className="upi-payment-box premium-upi-box">

            <div className="upi-shield">
              🔒
            </div>

            <div>

              <strong>
                Secure Razorpay Payment
              </strong>

              <p>
                UPI, cards and net banking are processed securely.
              </p>

              <small>
                Your payment details are protected.
              </small>

            </div>

          </div>
        )}

      </section>


      {/* DAILY SCRATCH */}

      {!dailyScratch.loading &&
        dailyScratch.eligible && (
          <section className="checkout-card daily-scratch-section premium-scratch-card">

            <div className="scratch-glow" />

            <div className="daily-scratch-heading">

              <div className="scratch-gift-large">
                🎁
              </div>

              <div>

                <span>
                  DAILY SCRATCH & WIN
                </span>

                <h2>
                  Your Daily Reward
                </h2>

                <p>
                  One order. One surprise. Every day.
                </p>

              </div>

            </div>


            {!dailyScratch.unlocked && (
              <div className="scratch-unlock-banner">

                <span>
                  🔓
                </span>

                <div>

                  <strong>
                    Reward unlocked for you
                  </strong>

                  <small>
                    Select a payment method above to unlock your scratch card.
                  </small>

                </div>

              </div>
            )}


            {dailyScratch.unlocked &&
              !dailyScratch.revealed && (
                <>
                  <p className="daily-scratch-description">
                    Your card is ready! Scratch below to reveal your surprise.
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
                <div className="daily-scratch-revealed premium-reward-revealed">

                  <div className="reward-confetti">
                    ✨ 🎉 ✨
                  </div>

                  <div className="daily-scratch-win-icon">
                    🎁
                  </div>

                  <span className="daily-scratch-you-won">
                    YOU WON
                  </span>

                  <h2>
                    {
                      dailyScratch
                        .reward
                        .title
                    }
                  </h2>

                  <p>
                    {dailyScratch.reward.type ===
                    "discount"
                      ? "Your 5% discount has been added to this order."
                      : "Your free reward will be added to this order."}
                  </p>

                </div>
              )}

          </section>
        )}


      {/* SCRATCH PROGRESS */}

      {!dailyScratch.loading &&
        Number(totalPrice) > 0 &&
        Number(totalPrice) <
          DAILY_SCRATCH_MIN_BILL && (
          <section className="checkout-card scratch-progress-note premium-unlock-card">

            <div className="unlock-card-icon">
              🎁
            </div>

            <div className="unlock-card-content">

              <span>
                DAILY SCRATCH & WIN
              </span>

              <strong>
                Add ₹
                {Math.max(
                  0,
                  DAILY_SCRATCH_MIN_BILL -
                    Number(totalPrice)
                ).toFixed(0)}{" "}
                more
              </strong>

              <small>
                to unlock today's Scratch & Win
              </small>

            </div>

            <div className="unlock-arrow">
              →
            </div>

          </section>
        )}


      {/* ORDER SUMMARY */}

      <section className="checkout-card order-summary-card premium-summary-card">

        <div className="section-heading compact">

          <div className="section-icon summary-icon">
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


        <div className="summary-lines">

          <div className="summary-row">

            <span>
              Subtotal
            </span>

            <strong>
              ₹
              {Number(
                totalPrice
              ).toFixed(0)}
            </strong>

          </div>


          <div className="summary-row">

            <span>

              {isTakeaway
                ? "Pickup"
                : `Delivery ${
                    distance > 0
                      ? `(${distance.toFixed(
                          1
                        )} km)`
                      : ""
                  }`}

            </span>

            <strong>
              ₹
              {Number(
                deliveryCharge
              ).toFixed(0)}
            </strong>

          </div>


          {discount > 0 && (
            <div className="summary-row discount-row">

              <span>
                🎁 Discount
              </span>

              <strong>
                -₹
                {discount.toFixed(
                  2
                )}
              </strong>

            </div>
          )}


          <div className="summary-row">

            <span>
              GST
            </span>

            <strong>
              ₹{gst}
            </strong>

          </div>

        </div>


        {dailyScratch.revealed &&
          dailyScratch.reward && (
          <div className="scratch-summary premium-scratch-summary">

            <span>
              🎁
            </span>

            Daily Scratch:{" "}

            <strong>
              {
                dailyScratch
                  .reward
                  .title
              }
            </strong>

          </div>
        )}


        {isTakeaway && (
          <div className="takeaway-summary premium-takeaway-summary">

            <span>
              🛍️
            </span>

            <div>

              <small>
                Pickup from
              </small>

              <strong>
                {TAKEAWAY_STORE.name}
              </strong>

            </div>

          </div>
        )}


        <div className="summary-divider" />


        <div className="summary-total">

          <span>
            Total Amount
          </span>

          <strong>
            ₹
            {grandTotal.toFixed(
              2
            )}
          </strong>

        </div>


        {/* CTA */}

        <button
          type="button"
          className={
            placingOrder
              ? "place-order-btn premium-place-btn loading"
              : "place-order-btn premium-place-btn"
          }
          onClick={
            placeOrder
          }
          disabled={
            placingOrder ||
            (!isTakeaway &&
              (!deliveryAvailableSetting ||
                !deliveryAvailable ||
                !locationConfirmed))
          }
        >

          <span className="place-order-icon">

            {placingOrder
              ? "◌"
              : isTakeaway
              ? "🛍️"
              : "🛵"}

          </span>


          <span className="place-order-content">

            <strong>

              {placingOrder
                ? "Placing Order..."

                : isTakeaway
                ? "Place Takeaway Order"

                : !deliveryAvailableSetting
                ? `Delivery available ${orderTimingLabel}`

                : !deliveryAvailable
                ? "Delivery Not Available"

                : !locationConfirmed
                ? "Confirm Delivery Location First"

                : "Place Delivery Order"}

            </strong>


            {!placingOrder &&
              (isTakeaway ||
                (locationConfirmed &&
                  deliveryAvailable)) && (
                <small>
                  Pay ₹
                  {grandTotal.toFixed(
                    2
                  )}
                </small>
              )}

          </span>


          <span className="place-order-arrow">
            →
          </span>

        </button>


        <div className="checkout-security-note">

          <span>
            🔒
          </span>

          Secure checkout • Your information is protected

        </div>

      </section>


      <div className="checkout-bottom-space" />

    </div>
  );
}


export default Checkout;
