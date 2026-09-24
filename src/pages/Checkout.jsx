import { useState, useRef, useEffect } from "react";
import {
  GoogleMap,
  Marker,
  LoadScript,
  Autocomplete,
} from "@react-google-maps/api";
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

const TAKEAWAY_STORE = {
  name: "Sugar Crown – NTPC",
  address:
    "NTPC Gate, Sada Colony, Jamnipali, Korba, Chhattisgarh – 495450",
};

const SHOP_LOCATION = {
  lat: 22.417212,
  lng: 82.665984,
};

function Checkout() {
  const navigate = useNavigate();
  const store = useStoreSettings();

  const { cart, totalPrice, clearCart } = useCart();

  const [orderType, setOrderType] = useState("Delivery");

  const [address, setAddress] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [geocodingManual, setGeocodingManual] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [specialNote, setSpecialNote] = useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("Cash on Delivery");

  const [autocomplete, setAutocomplete] = useState(null);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [mapCenter, setMapCenter] =
    useState(SHOP_LOCATION);

  const [marker, setMarker] =
    useState(SHOP_LOCATION);

  const mapRef = useRef(null);

  const googleApiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const MAX_DELIVERY_DISTANCE =
    Number(store.maxDeliveryDistanceKm ?? 10);

  const DELIVERY_PER_KM =
    Number(store.deliveryPerKm ?? 20);

  const MIN_DELIVERY_CHARGE =
    Number(store.minDeliveryCharge ?? 20);

  const MAX_DELIVERY_CHARGE =
    Number(store.maxDeliveryCharge ?? 300);

  // =====================================================
  // LOAD CUSTOMER
  // =====================================================

  useEffect(() => {
    try {
      const savedUser =
        localStorage.getItem("sugarCafeUser");

      if (savedUser) {
        const data = JSON.parse(savedUser);

        const profile = {
          ...data,
          customerId:
            data.customerId ||
            localStorage.getItem(
              "sugarCafeCustomerId"
            ) ||
            "",
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || "",
          photoURL: data.photoURL || "",
          addresses: Array.isArray(data.addresses)
            ? data.addresses
            : [],
          guest: false,
          loggedIn: true,
        };

        setCustomerProfile(profile);
        setSavedAddresses(profile.addresses || []);
      }

      const savedLocation =
        localStorage.getItem("userLocation");

      if (savedLocation) {
        const loc = JSON.parse(savedLocation);

        if (
          loc.latitude != null &&
          loc.longitude != null
        ) {
          const saved = {
            lat: Number(loc.latitude),
            lng: Number(loc.longitude),
          };

          setMarker(saved);
          setMapCenter(saved);

          if (loc.fullAddress || loc.address) {
            setAddress(
              loc.fullAddress || loc.address
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

  // =====================================================
  // DISTANCE
  // =====================================================

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
      Math.cos(
        (lat1 * Math.PI) / 180
      ) *
        Math.cos(
          (lat2 * Math.PI) / 180
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

  const distance = calculateDistance(
    SHOP_LOCATION.lat,
    SHOP_LOCATION.lng,
    marker.lat,
    marker.lng
  );

  const deliveryAvailable =
    distance <= MAX_DELIVERY_DISTANCE;

  // =====================================================
  // DELIVERY CHARGE
  // =====================================================

  let deliveryCharge = 0;

  if (
    orderType === "Delivery" &&
    totalPrice > 0 &&
    deliveryAvailable
  ) {
    const roundedDistance =
      Math.ceil(distance);

    deliveryCharge =
      roundedDistance * DELIVERY_PER_KM;

    if (
      deliveryCharge <
      MIN_DELIVERY_CHARGE
    ) {
      deliveryCharge =
        MIN_DELIVERY_CHARGE;
    }

    if (
      deliveryCharge >
      MAX_DELIVERY_CHARGE
    ) {
      deliveryCharge =
        MAX_DELIVERY_CHARGE;
    }
  }

  const discount = 0;
  const gst = 0;

  const grandTotal =
    Number(totalPrice) +
    Number(deliveryCharge) -
    Number(discount) +
    Number(gst);

  // =====================================================
  // CURRENT LOCATION
  // =====================================================

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(
        "Your browser does not support location."
      );
      return;
    }

    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } =
            position.coords;

          const newLocation = {
            lat: latitude,
            lng: longitude,
          };

          setMapCenter(newLocation);
          setMarker(newLocation);

          localStorage.setItem(
            "userLocation",
            JSON.stringify({
              latitude,
              longitude,
            })
          );

          try {
            const response =
              await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
              );

            const data =
              await response.json();

            setAddress(
              data.display_name ||
                `${latitude}, ${longitude}`
            );
          } catch {
            setAddress(
              `${latitude}, ${longitude}`
            );
          }
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

  // =====================================================
  // MANUAL ADDRESS
  // =====================================================

  const useManualAddress = () => {
    const value =
      manualAddress.trim();

    if (!value) {
      alert(
        "Please enter your complete delivery address."
      );
      return;
    }

    if (
      !window.google?.maps?.Geocoder
    ) {
      alert(
        "Address search is still loading. Please try again."
      );
      return;
    }

    setGeocodingManual(true);

    const geocoder =
      new window.google.maps.Geocoder();

    geocoder.geocode(
      {
        address:
          `${value}, Korba, Chhattisgarh, India`,
      },
      (results, status) => {
        setGeocodingManual(false);

        if (
          status !== "OK" ||
          !results?.[0]?.geometry?.location
        ) {
          alert(
            "Address nahi mila. Please thoda aur complete address enter karein."
          );
          return;
        }

        const location =
          results[0].geometry.location;

        const lat = location.lat();
        const lng = location.lng();

        const formatted =
          results[0].formatted_address ||
          value;

        setMarker({ lat, lng });
        setMapCenter({ lat, lng });
        setAddress(formatted);

        localStorage.setItem(
          "userLocation",
          JSON.stringify({
            latitude: lat,
            longitude: lng,
            address: formatted,
          })
        );

        if (mapRef.current) {
          mapRef.current.panTo({
            lat,
            lng,
          });

          mapRef.current.setZoom(16);
        }
      }
    );
  };

  // =====================================================
  // MAP
  // =====================================================

  const onLoad = (map) => {
    mapRef.current = map;
  };

  // =====================================================
  // MARKER DRAG
  // =====================================================

  const onMarkerDragEnd = async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    const newLocation = {
      lat,
      lng,
    };

    setMarker(newLocation);
    setMapCenter(newLocation);

    localStorage.setItem(
      "userLocation",
      JSON.stringify({
        latitude: lat,
        longitude: lng,
      })
    );

    try {
      const response =
        await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );

      const data =
        await response.json();

      setAddress(
        data.display_name ||
          `${lat}, ${lng}`
      );
    } catch {
      setAddress(`${lat}, ${lng}`);
    }
  };

  // =====================================================
  // GOOGLE SEARCH
  // =====================================================

  const onPlaceChanged = () => {
    if (!autocomplete) return;

    const place =
      autocomplete.getPlace();

    if (
      !place?.geometry?.location
    ) {
      alert(
        "Please select an address from the Google suggestions."
      );
      return;
    }

    const lat =
      place.geometry.location.lat();

    const lng =
      place.geometry.location.lng();

    const newLocation = {
      lat,
      lng,
    };

    const selectedAddress =
      place.formatted_address || "";

    setMarker(newLocation);
    setMapCenter(newLocation);
    setAddress(selectedAddress);

    localStorage.setItem(
      "userLocation",
      JSON.stringify({
        latitude: lat,
        longitude: lng,
        address: selectedAddress,
      })
    );

    if (mapRef.current) {
      mapRef.current.panTo(
        newLocation
      );

      mapRef.current.setZoom(16);
    }
  };

  // =====================================================
  // CUSTOMER DATA
  // =====================================================

  const getCustomerData = () => {
    if (!customerProfile) {
      return null;
    }

    return {
      userId:
        customerProfile.uid || "",

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

  // =====================================================
  // RAZORPAY
  // =====================================================

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script =
        document.createElement("script");

      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";

      script.onload = () =>
        resolve(true);

      script.onerror = () =>
        resolve(false);

      document.body.appendChild(script);
    });

  // =====================================================
  // SAVE CUSTOMER ADDRESS
  // =====================================================

  const saveCustomerAddress =
    async () => {
      // TAKEAWAY DOES NOT NEED DELIVERY ADDRESS
      if (orderType === "Takeaway") {
        return null;
      }

      const selectedAddress = {
        id: `${Date.now()}`,
        label: "Delivery Address",
        address: address.trim(),
        fullAddress: address.trim(),
        latitude: Number(marker.lat),
        longitude: Number(marker.lng),
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
                Number(item.latitude) ===
                  Number(
                    selectedAddress.latitude
                  ) &&
                Number(item.longitude) ===
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
                const customerDoc =
                  customerSnapshot.docs[0];

                await updateDoc(
                  doc(
                    db,
                    "customers",
                    customerDoc.id
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

  // =====================================================
  // SAVE ORDER
  // =====================================================

  const saveCompletedOrder =
    async (
      orderData,
      selectedAddress
    ) => {
      const orderRef =
        await addDoc(
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

      const savedUser =
        localStorage.getItem(
          "sugarCafeUser"
        );

      // Only save address for DELIVERY
      if (
        savedUser &&
        selectedAddress
      ) {
        try {
          const profile =
            JSON.parse(savedUser);

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
                Number(item.latitude) ===
                  Number(
                    selectedAddress.latitude
                  ) &&
                Number(item.longitude) ===
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
            updatedProfile.addresses ||
              []
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

  // =====================================================
  // API RESPONSE
  // =====================================================

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
        throw new Error(
          `Payment service returned an invalid response (HTTP ${response.status}).`
        );
      }
    };

  // =====================================================
  // ONLINE PAYMENT
  // =====================================================

  const startOnlinePayment =
    async ({
      customer,
      orderData,
      selectedAddress,
    }) => {
      const gatewayResponse =
        await fetch(
          `${
            import.meta.env
              .VITE_PAYMENT_API_URL || ""
          }/api/payment/create-order`,
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
        (resolve, reject) => {
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
                async (response) => {
                  try {
                    const verifyResponse =
                      await fetch(
                        `${
                          import.meta.env
                            .VITE_PAYMENT_API_URL ||
                          ""
                        }/api/payment/verify`,
                        {
                          method: "POST",
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
                      reject(
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

  // =====================================================
  // PLACE ORDER
  // =====================================================

  const placeOrder = async () => {
    // Delivery availability should NOT block takeaway
    if (
      orderType === "Delivery" &&
      !store.deliveryAvailable
    ) {
      alert(
        store.announcement ||
          `Delivery orders are available only from ${store.orderTimingLabel}.`
      );

      return;
    }

    if (
      paymentMethod === "Online Payment" &&
      !store.upiEnabled
    ) {
      alert(
        "UPI payment is currently unavailable. Please choose another payment method."
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
        "Please login with your customer account before placing the order."
      );

      navigate("/login", {
        state: {
          from: "/checkout",
        },
      });

      return;
    }

    const customer =
      getCustomerData();

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
        state: {
          from: "/checkout",
        },
      });

      return;
    }

    // Address required ONLY for delivery
    if (
      orderType === "Delivery" &&
      !address.trim()
    ) {
      alert(
        "Please select your delivery address."
      );
      return;
    }

    if (
      orderType === "Delivery" &&
      !deliveryAvailable
    ) {
      alert(
        `Sorry! We currently deliver within ${MAX_DELIVERY_DISTANCE} km of our shop.`
      );
      return;
    }

    try {
      setPlacingOrder(true);

      const orderItems =
        cart.map((item) => ({
          id: item.id || "",
          name: item.name || "",
          price: Number(item.price || 0),
          qty: Number(
            item.qty ||
              item.quantity ||
              1
          ),
          image: item.image || "",
          category:
            item.category || "",
        }));

      const orderData = {
        orderNumber:
          `SC-${Date.now()}`,

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
          customer.photoURL,

        // DELIVERY ADDRESS ONLY FOR DELIVERY
        address:
          orderType === "Delivery"
            ? address
            : "",

        specialNote:
          specialNote.trim(),

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
            ? Number(
                distance.toFixed(2)
              )
            : 0,

        // IMPORTANT
        orderType,

        // TAKEAWAY STORE
        takeawayStore:
          orderType === "Takeaway"
            ? {
                name:
                  TAKEAWAY_STORE.name,

                address:
                  TAKEAWAY_STORE.address,
              }
            : null,

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
          Number(totalPrice),

        deliveryCharge:
          Number(deliveryCharge),

        discount:
          Number(discount),

        gst:
          Number(gst),

        total:
          Number(grandTotal),

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

        collectedAt:
          null,

        createdAt:
          Timestamp.now(),
      };

      const selectedAddress =
        await saveCustomerAddress();

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
        orderType === "Takeaway"
          ? "🛍️ Takeaway order received! Sugar Café is reviewing your order."
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
          error?.message ||
          "Unknown error"
        }`
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="checkout-page">

      <h2>Checkout</h2>

      {/* =================================================
          ORDER TYPE
      ================================================= */}

      <div className="checkout-card">

        <h3>🛍️ Order Type</h3>

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
            onClick={() =>
              setOrderType("Delivery")
            }
            style={{
              padding: "14px",
              borderRadius: "12px",
              border:
                orderType === "Delivery"
                  ? "2px solid #ff6b35"
                  : "1px solid #ddd",
              background:
                orderType === "Delivery"
                  ? "#fff7ed"
                  : "#fff",
              color:
                orderType === "Delivery"
                  ? "#ea580c"
                  : "#333",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            🚚 Delivery
          </button>

          <button
            type="button"
            onClick={() => {
              setOrderType("Takeaway");
              setAddress("");
            }}
            style={{
              padding: "14px",
              borderRadius: "12px",
              border:
                orderType === "Takeaway"
                  ? "2px solid #16a34a"
                  : "1px solid #ddd",
              background:
                orderType === "Takeaway"
                  ? "#f0fdf4"
                  : "#fff",
              color:
                orderType === "Takeaway"
                  ? "#15803d"
                  : "#333",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            🛍️ Takeaway
          </button>

        </div>
      </div>

      {/* =================================================
          DELIVERY ADDRESS
      ================================================= */}

      {orderType === "Delivery" && (
        <div className="checkout-card">

          <h3>📍 Delivery Address</h3>

          {customerProfile && (
            <div className="checkout-customer-box">

              <div>
                👤{" "}
                <strong>
                  {customerProfile.name ||
                    "Customer"}
                </strong>
              </div>

              <div>
                📱{" "}
                {customerProfile.phone}
              </div>

              {customerProfile.customerId && (
                <div>
                  🆔{" "}
                  {customerProfile.customerId}
                </div>
              )}

            </div>
          )}

          {savedAddresses.length > 0 && (
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
                    {saved.label ||
                      "Address"}

                    <br />

                    <span>
                      {saved.fullAddress ||
                        saved.address}
                    </span>
                  </button>
                )
              )}

            </div>
          )}

          <LoadScript
            googleMapsApiKey={
              googleApiKey
            }
            libraries={[
              "places",
            ]}
          >

            <Autocomplete
              onLoad={(auto) =>
                setAutocomplete(
                  auto
                )
              }
              onPlaceChanged={
                onPlaceChanged
              }
            >

              <input
                type="text"
                placeholder="🔍 Search your delivery address"
                value={address}
                onChange={(e) =>
                  setAddress(
                    e.target.value
                  )
                }
                style={{
                  width:
                    "100%",
                  padding:
                    "12px",
                  marginTop:
                    "5px",
                  borderRadius:
                    "10px",
                  border:
                    "1px solid #ddd",
                  boxSizing:
                    "border-box",
                  fontSize:
                    "15px",
                }}
              />

            </Autocomplete>

            <div className="manual-address-box">

              <label>
                Or enter address manually
              </label>

              <textarea
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

            <GoogleMap
              mapContainerStyle={{
                width:
                  "100%",
                height:
                  "300px",
                marginTop:
                  "15px",
                borderRadius:
                  "10px",
              }}
              center={
                mapCenter
              }
              zoom={14}
              onLoad={
                onLoad
              }
            >

              <Marker
                position={
                  marker
                }
                draggable
                onDragEnd={
                  onMarkerDragEnd
                }
              />

            </GoogleMap>

          </LoadScript>

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
                {distance.toFixed(1)} km
                <br />
                Delivery charge: ₹
                {deliveryCharge}
              </>
            ) : (
              <>
                ⚠️ Delivery unavailable
                <br />
                Your location is{" "}
                {distance.toFixed(1)} km away.
                <br />
                We deliver within{" "}
                {MAX_DELIVERY_DISTANCE} km.
              </>
            )}

          </div>

        </div>
      )}

      {/* =================================================
          TAKEAWAY STORE
      ================================================= */}

      {orderType === "Takeaway" && (
        <div className="checkout-card">

          <h3>
            🏪 Pickup Store
          </h3>

          <div
            style={{
              marginTop: "12px",
              padding: "16px",
              borderRadius: "14px",
              border:
                "2px solid #16a34a",
              background:
                "#f0fdf4",
            }}
          >

            <div
              style={{
                fontSize: "17px",
                fontWeight: "800",
                color: "#166534",
              }}
            >
              🏪{" "}
              {TAKEAWAY_STORE.name}
            </div>

            <div
              style={{
                marginTop: "8px",
                fontSize: "14px",
                lineHeight: "1.5",
                color: "#374151",
              }}
            >
              📍{" "}
              {TAKEAWAY_STORE.address}
            </div>

            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                borderRadius: "10px",
                background:
                  "#dcfce7",
                color:
                  "#166534",
                fontSize: "13px",
                fontWeight: "700",
              }}
            >
              🛍️ Customer will
              collect the order
              from this store.
            </div>

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
          value={specialNote}
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
            Please write any special request
            you want the café to know.
          </small>

          <small>
            {specialNote.length}/300
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
              !store.codEnabled
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
              Pay when your order is
              delivered
            </small>
          </span>

        </label>

        <label>

          <input
            type="radio"
            name="payment"
            disabled={
              !store.upiEnabled
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
              UPI, cards and net banking
              are processed securely
              by Razorpay.
            </p>

            <small>
              No UTR entry or staff payment
              verification is required.
            </small>

          </div>
        )}

      </div>

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
            ₹{totalPrice}
          </span>
        </p>

        <p>
          <span>
            {orderType === "Takeaway"
              ? "Pickup"
              : "Delivery"}
          </span>

          <span>
            {orderType === "Takeaway"
              ? "₹0"
              : `₹${deliveryCharge}`}
          </span>
        </p>

        <p>
          <span>
            GST
          </span>

          <span>
            ₹{gst}
          </span>
        </p>

        <hr />

        <h2>
          ₹{grandTotal}
        </h2>

        <button
          className="place-order-btn"
          onClick={
            placeOrder
          }
          disabled={
            placingOrder ||
            (
              orderType === "Delivery" &&
              (
                !store.deliveryAvailable ||
                !deliveryAvailable
              )
            )
          }
        >

          {placingOrder
            ? "Placing Order..."
            : orderType === "Takeaway"
            ? "Confirm Takeaway Order"
            : !store.deliveryAvailable
            ? `Delivery available ${store.orderTimingLabel}`
            : !deliveryAvailable
            ? "Delivery Not Available"
            : "Place Order"}

        </button>

      </div>

    </div>
  );
}

export default Checkout;
