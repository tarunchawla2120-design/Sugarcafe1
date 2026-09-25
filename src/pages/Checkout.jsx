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
   SUGARCAFE 6 + 1 LOYALTY
========================================================= */

const LOYALTY_MIN_BILL = 500;

const LOYALTY_REWARDS = [
  {
    type: "free_menu_item",
    itemName: "Cold Coffee",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Cheese Puff",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Aloo Tikki Burger",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Peri Peri Fries",
    discountPercent: 0,
  },
  {
    type: "discount",
    itemName: "",
    discountPercent: 5,
  },
  {
    type: "free_menu_item",
    itemName: "Black Currant Shake",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Paneer Cheese Sandwich",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Choco Lava",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Hot Chocolate Brownie",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Chocolate Pastry",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "KitKat Shake",
    discountPercent: 0,
  },
  {
    type: "free_menu_item",
    itemName: "Oreo Shake",
    discountPercent: 0,
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

  /* =======================================================
     SAFE STORE SETTINGS
  ======================================================= */

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

  const [geocodingManual, setGeocodingManual] =
    useState(false);

  /* =======================================================
     LOYALTY STATE
  ======================================================= */

  const [loyaltyData, setLoyaltyData] =
    useState({
      loading: true,
      qualifyingOrders: 0,
      pendingReward: null,
      currentReward: null,
    });

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
     LOYALTY STATUS
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

          /* =================================================
             QUALIFYING ORDERS

             ONLY:
             Delivered + subtotal/total >= ₹500
          ================================================= */

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

          /* =================================================
             COMPLETED CYCLES
          ================================================= */

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

          /* =================================================
             ALREADY USED SOURCE REWARDS
          ================================================= */

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

          /* =================================================
             ACTIVE REWARD

             ONLY:
             scratch_pending
             OR
             available
          ================================================= */

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

          /* =================================================
             NEXT CYCLE
          ================================================= */

          const nextCycle =
            maxCompletedCycle + 1;

          const requiredOrders =
            maxCompletedCycle * 6 +
            6;

          /* =================================================
             7TH ORDER READY?

             Example:

             Cycle 1:
             6 qualifying -> 7th order gets scratch card

             Cycle 2:
             12 qualifying -> next order gets scratch card
          ================================================= */

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

              scratchCardReady:
                true,
            };
          }

          /* =================================================
             PROGRESS

             Cycle 1:
             0/6 → 6/6

             After cycle 1:
             7 qualifying → 1/6
             8 qualifying → 2/6
          ================================================= */

          let progress =
            qualifyingOrders.length -
            maxCompletedCycle * 6;

          progress = Math.max(
            0,
            Math.min(progress, 6)
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
     CURRENT REWARD

     IMPORTANT:
     This was the cause of the white-screen error earlier.
  ======================================================= */

  const currentReward =
    loyaltyData.currentReward ||
    null;

  /* =======================================================
     PREVIOUS SCRATCH REWARD
  ======================================================= */

  const pendingReward =
    loyaltyData.pendingReward
      ?.loyaltyReward || null;

  const pendingRewardStatus =
    pendingReward?.status || "";

  const rewardAvailable =
    Boolean(
      pendingReward &&
      pendingRewardStatus ===
        "available"
    );

  /* =======================================================
     LOYALTY DISCOUNT
  ======================================================= */

  let discount = 0;

  if (
    rewardAvailable &&
    pendingReward.type ===
      "discount" &&
    Number(
      pendingReward.discountPercent
    ) === 5
  ) {
    discount =
      Number(totalPrice) * 0.05;
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

      setGeocodingManual(true);

      try {
        const queryText =
          `${value}, Korba, Chhattisgarh, India`;

        const response =
          await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
              queryText
            )}&limit=5&addressdetails=1&countrycodes=in`,
            {
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            "Address search failed"
          );
        }

        const results =
          await response.json();

        if (
          !Array.isArray(results) ||
          results.length === 0
        ) {
          alert(
            "Address nahi mila. Please House/Area/Landmark ke saath complete address enter karein."
          );

          return;
        }

        const korbaResult =
          results.find((item) =>
            String(
              item.display_name || ""
            )
              .toLowerCase()
              .includes("korba")
          ) ||
          results[0];

        const lat =
          Number(
            korbaResult.lat
          );

        const lng =
          Number(
            korbaResult.lon
          );

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          throw new Error(
            "Invalid location received"
          );
        }

        const formatted =
          korbaResult.display_name ||
          value;

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

        setAddress(
          formatted
        );

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
          mapRef.current.setView(
            [lat, lng],
            16,
            {
              animate: true,
            }
          );
        }
      } catch (error) {
        console.error(
          "Manual address error:",
          error
        );

        alert(
          "Address check nahi ho paya. Please complete address enter karke dobara try karein."
        );
      } finally {
        setGeocodingManual(false);
      }
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
  ======================================================= */

  const onMarkerDragEnd =
    async (event) => {
      const position =
        event.target.getLatLng();

      const lat =
        position.lat;

      const lng =
        position.lng;

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

      const newAddress =
        await reverseGeocode(
          lat,
          lng
        );

      setAddress(
        newAddress
      );

      localStorage.setItem(
        "userLocation",
        JSON.stringify({
          latitude: lat,
          longitude: lng,
          address:
            newAddress,
          fullAddress:
            newAddress,
        })
      );
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
          "Loyalty menu lookup error:",
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
        id: `${Date.now()}`,

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

      /* =================================================
         MARK SOURCE SCRATCH REWARD AS APPLIED
      ================================================= */

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
      /* -----------------------------------------------
         LOYALTY LOADING
      ----------------------------------------------- */

      if (
        loyaltyData.loading
      ) {
        alert(
          "Please wait a moment while we check your Sugar Rewards."
        );

        return;
      }

      /* -----------------------------------------------
         DELIVERY STORE CHECK
      ----------------------------------------------- */

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

      /* -----------------------------------------------
         PAYMENT CHECK
      ----------------------------------------------- */

      if (
        paymentMethod ===
          "Online Payment" &&
        !upiEnabled
      ) {
        alert(
          "UPI payment is currently unavailable. Please choose another payment method."
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

      /* -----------------------------------------------
         CART
      ----------------------------------------------- */

      if (!cart.length) {
        alert(
          "Your cart is empty."
        );

        return;
      }

      /* -----------------------------------------------
         CUSTOMER LOGIN
      ----------------------------------------------- */

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

      /* -----------------------------------------------
         DELIVERY ADDRESS
      ----------------------------------------------- */

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

      try {
        setPlacingOrder(true);

        /* =============================================
           NORMAL CART ITEMS
        ============================================= */

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

        /* =============================================
           PREVIOUS SCRATCH REWARD

           ONLY AVAILABLE REWARD IS APPLIED.
        ============================================= */

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
              ?.id || null;

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

          /* =========================================
             5% DISCOUNT
          ========================================= */

          if (
            reward.type ===
              "discount" &&
            Number(
              reward.discountPercent
            ) === 5
          ) {
            orderLoyaltyReward.appliedDiscount =
              Number(
                discount
              );
          }

          /* =========================================
             FREE MENU ITEM
          ========================================= */

          if (
            reward.type ===
            "free_menu_item"
          ) {
            let menuItem = null;

            /* Saved exact snapshot */

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

            /* Exact current menu fallback */

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

              price: 0,

              qty: 1,

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

        /* =============================================
           NEW SCRATCH CARD

           THIS IS THE 7TH ORDER.

           Reward is NOT applied.
        ============================================= */

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

          /* =========================================
             EXACT MENU SNAPSHOT
          ========================================= */

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

        /* =============================================
           ORDER DATA
        ============================================= */

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

        /* =============================================
           ADDRESS OBJECT
        ============================================= */

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

        /* =============================================
           PAYMENT
        ============================================= */

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

        /* =============================================
           SUCCESS
        ============================================= */

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
              borderRadius: "10px",

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

              fontWeight: "700",
              cursor: "pointer",
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
              borderRadius: "10px",

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

              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            🛍️ Takeaway
          </button>

        </div>

        {isTakeaway && (
          <div
            style={{
              marginTop: "14px",
              padding: "12px",
              borderRadius: "10px",
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

                      setAddress(
                        saved.fullAddress ||
                          saved.address ||
                          ""
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
            placeholder="🔍 Search your delivery address"
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

          <div className="manual-address-box">

            <label htmlFor="manual-delivery-address">
              Or enter address manually
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
              rows={3}
            />

            <button
              type="button"
              onClick={
                useManualAddress
              }
              disabled={
                geocodingManual
              }
              className="manual-address-btn"
            >
              {geocodingManual
                ? "Checking address..."
                : "✓ Use This Manual Address"}
            </button>

          </div>

          <button
            type="button"
            onClick={
              getCurrentLocation
            }
            style={{
              marginTop: "10px",
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background:
                "#ff4d4f",
              color: "#fff",
              cursor:
                "pointer",
              fontSize: "15px",
              fontWeight:
                "600",
            }}
          >
            {loadingLocation
              ? "Getting Location..."
              : "📍 Use My Current Location"}
          </button>

          <div
            style={{
              width: "100%",
              height: "300px",
              marginTop: "15px",
              borderRadius: "10px",
              overflow:
                "hidden",
            }}
          >
            <MapContainer
              center={[
                mapCenter.lat,
                mapCenter.lng,
              ]}
              zoom={14}
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
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
              marginTop: "8px",
              fontSize: "13px",
              color: "#777",
              textAlign:
                "center",
            }}
          >
            📍 Drag the pin to
            your exact delivery
            location
          </div>

          <div
            style={{
              marginTop: "12px",
              padding: "12px",
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
            onChange={() =>
              setPaymentMethod(
                "Cash on Delivery"
              )
            }
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
            onChange={() =>
              setPaymentMethod(
                "Online Payment"
              )
            }
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
          SUGAR REWARDS
      ================================================= */}

      {!loyaltyData.loading &&
        (
          currentReward ||
          pendingReward
        ) && (
          <div
            className="checkout-card"
            style={{
              background:
                "linear-gradient(135deg,#fffaf0,#fff3d6)",

              border:
                "1px solid #f2c66d",

              boxShadow:
                "0 8px 24px rgba(0,0,0,.06)",
            }}
          >

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: "10px",
              }}
            >

              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius:
                    "50%",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  background:
                    "#fff",
                  fontSize:
                    "24px",
                }}
              >
                🎁
              </div>

              <div>

                <div
                  style={{
                    fontSize:
                      "11px",
                    fontWeight:
                      "900",
                    letterSpacing:
                      "1.5px",
                    color:
                      "#9a6700",
                  }}
                >
                  SUGAR REWARDS
                </div>

                <h3
                  style={{
                    margin:
                      "3px 0 0",
                  }}
                >
                  {currentReward
                    ? "Scratch Card Unlocked"
                    : pendingReward.status ===
                      "scratch_pending"
                    ? "Scratch Your Reward"
                    : "Reward Ready"}
                </h3>

              </div>

            </div>

            <div
              style={{
                marginTop:
                  "14px",
                padding:
                  "16px",
                background:
                  "#fff",
                borderRadius:
                  "12px",
              }}
            >

              {/* =========================================
                  NEW 7TH ORDER
              ========================================= */}

              {currentReward?.scratchCardReady ? (
                <>

                  <div
                    style={{
                      fontSize:
                        "34px",
                      textAlign:
                        "center",
                      marginBottom:
                        "8px",
                    }}
                  >
                    🎫✨
                  </div>

                  <strong
                    style={{
                      display:
                        "block",
                      textAlign:
                        "center",
                      fontSize:
                        "20px",
                      color:
                        "#9a6700",
                    }}
                  >
                    Scratch Card Unlocked!
                  </strong>

                  <p
                    style={{
                      margin:
                        "8px 0 0",
                      textAlign:
                        "center",
                      color:
                        "#795548",
                      lineHeight:
                        "1.5",
                    }}
                  >
                    This order is your{" "}
                    <strong>
                      7th loyalty order.
                    </strong>

                    <br />

                    Place this order and
                    scratch your digital
                    card after the order
                    is created to reveal
                    your reward.
                  </p>

                  <div
                    style={{
                      marginTop:
                        "12px",
                      padding:
                        "10px",
                      borderRadius:
                        "10px",
                      background:
                        "#fff8e1",
                      color:
                        "#8a6100",
                      textAlign:
                        "center",
                      fontSize:
                        "13px",
                      fontWeight:
                        "700",
                    }}
                  >
                    🎁 Reward will be
                    available for your
                    NEXT order.
                  </div>

                </>

              ) : pendingReward?.status ===
                "scratch_pending" ? (

                <>
                  <div
                    style={{
                      fontSize:
                        "34px",
                      textAlign:
                        "center",
                    }}
                  >
                    🎫
                  </div>

                  <strong
                    style={{
                      display:
                        "block",
                      textAlign:
                        "center",
                      marginTop:
                        "8px",
                      fontSize:
                        "18px",
                      color:
                        "#9a6700",
                    }}
                  >
                    Your Scratch Card
                    is Waiting!
                  </strong>

                  <p
                    style={{
                      textAlign:
                        "center",
                      color:
                        "#795548",
                      lineHeight:
                        "1.5",
                    }}
                  >
                    Go to your Orders
                    page and scratch
                    your card to reveal
                    your reward.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/orders"
                      )
                    }
                    style={{
                      width:
                        "100%",
                      marginTop:
                        "8px",
                      padding:
                        "12px",
                      border:
                        "none",
                      borderRadius:
                        "10px",
                      background:
                        "#f59e0b",
                      color:
                        "#fff",
                      fontWeight:
                        "800",
                      cursor:
                        "pointer",
                    }}
                  >
                    🎁 Scratch My Card
                  </button>
                </>

              ) : (

                <>
                  {pendingReward?.type ===
                  "discount" ? (
                    <>
                      <strong
                        style={{
                          display:
                            "block",
                          textAlign:
                            "center",
                          fontSize:
                            "24px",
                          color:
                            "#15803d",
                        }}
                      >
                        🎉 5% OFF
                      </strong>

                      <p
                        style={{
                          textAlign:
                            "center",
                          color:
                            "#166534",
                          fontWeight:
                            "700",
                        }}
                      >
                        Your 5% loyalty
                        reward will be
                        applied to this
                        order.
                      </p>
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
                            "Reward"
                          }
                          style={{
                            width:
                              "85px",
                            height:
                              "85px",
                            objectFit:
                              "cover",
                            borderRadius:
                              "14px",
                            display:
                              "block",
                            margin:
                              "0 auto 10px",
                          }}
                        />
                      )}

                      <strong
                        style={{
                          display:
                            "block",
                          textAlign:
                            "center",
                          fontSize:
                            "19px",
                          color:
                            "#9a6700",
                        }}
                      >
                        🎉 FREE{" "}
                        {
                          pendingReward?.itemName
                        }
                      </strong>

                      <p
                        style={{
                          textAlign:
                            "center",
                          color:
                            "#166534",
                          fontWeight:
                            "700",
                          marginBottom:
                            "0",
                        }}
                      >
                        This reward will be
                        added free to your
                        current order.
                      </p>
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
                      ) * 100
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
            ₹{Number(totalPrice).toFixed(0)}
          </span>
        </p>

        <p>
          <span>
            {isTakeaway
              ? "Pickup"
              : "Delivery"}
          </span>

          <span>
            ₹{Number(deliveryCharge).toFixed(0)}
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
              🎁 Loyalty Discount
            </span>

            <span>
              -₹{discount.toFixed(2)}
            </span>
          </p>
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
          ₹{grandTotal.toFixed(2)}
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
