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
  arrayUnion,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

import "./Checkout.css";
import { useStoreSettings } from "../context/StoreContext";

function Checkout() {
  const navigate = useNavigate();
  const store = useStoreSettings();

  const {
    cart,
    totalPrice,
  } = useCart();

  // =====================================================
  // STATES
  // =====================================================

  const [address, setAddress] =
    useState("");

  const [loadingLocation, setLoadingLocation] =
    useState(false);

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState("Cash on Delivery");

  const [autocomplete, setAutocomplete] =
    useState(null);

  const [currentUser, setCurrentUser] =
    useState(null);

  const [authChecking, setAuthChecking] =
    useState(true);

  const [customerProfile, setCustomerProfile] =
    useState(null);

  const [savedAddresses, setSavedAddresses] =
    useState([]);

  const [manualAddress, setManualAddress] =
    useState("");

  const [geocodingManual, setGeocodingManual] =
    useState(false);

  // =====================================================
  // GOOGLE MAP API
  // =====================================================

  const googleApiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // =====================================================
  // SHOP LOCATION
  // =====================================================

  const SHOP_LOCATION = {
    lat: 22.417212,
    lng: 82.665984,
  };

  // =====================================================
  // DELIVERY SETTINGS
  // =====================================================

  const MAX_DELIVERY_DISTANCE = Number(store.maxDeliveryDistanceKm ?? 10);

  const DELIVERY_PER_KM = Number(store.deliveryPerKm ?? 20);

  const MIN_DELIVERY_CHARGE = Number(store.minDeliveryCharge ?? 20);

  const MAX_DELIVERY_CHARGE = Number(store.maxDeliveryCharge ?? 300);

  // =====================================================
  // MAP
  // =====================================================

  const [mapCenter, setMapCenter] =
    useState(SHOP_LOCATION);

  const [marker, setMarker] =
    useState(SHOP_LOCATION);

  const mapRef = useRef(null);

  // =====================================================
  // CUSTOMER AUTH + PROFILE
  // Order is allowed only after phone OTP login.
  // =====================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        let user = firebaseUser;

        // Free customer authentication: Firebase Anonymous Auth.
        // No SMS, OTP, reCAPTCHA, or billing account is required.
        if (!user) {
          const result = await signInAnonymously(auth);
          user = result.user;
        }

        setCurrentUser(user);

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};
        const customerId =
          data.customerId ||
          `SC-CUST-${user.uid.slice(-8).toUpperCase()}`;

        const profile = {
          ...data,
          uid: user.uid,
          customerId,
          phone: user.phoneNumber || data.phone || "",
          phoneVerified: Boolean(user.phoneNumber),
          name: data.name || "Sugar Customer",
          email: user.email || data.email || "",
          addresses: data.addresses || [],
        };

        if (snap.exists() || !user.isAnonymous) {
          await setDoc(userRef, profile, { merge: true });
        }
        setCustomerProfile(profile);
        setSavedAddresses(profile.addresses || []);
        localStorage.setItem("sugarCafeUser", JSON.stringify(profile));

        const savedLocation = localStorage.getItem("userLocation");
        if (savedLocation) {
          try {
            const loc = JSON.parse(savedLocation);
            if (loc.latitude != null && loc.longitude != null) {
              setMarker({ lat: Number(loc.latitude), lng: Number(loc.longitude) });
              setMapCenter({ lat: Number(loc.latitude), lng: Number(loc.longitude) });
              if (loc.fullAddress || loc.address) {
                setAddress(loc.fullAddress || loc.address);
              }
            }
          } catch (error) {
            console.error("Saved checkout location error:", error);
          }
        }
      } catch (error) {
        console.error("Customer profile loading error:", error);
      } finally {
        setAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // =====================================================
  // DISTANCE CALCULATOR
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

  // =====================================================
  // CURRENT DISTANCE
  // =====================================================

  const distance =
    calculateDistance(
      SHOP_LOCATION.lat,
      SHOP_LOCATION.lng,
      marker.lat,
      marker.lng
    );

  // =====================================================
  // DELIVERY AVAILABLE
  // =====================================================

  const deliveryAvailable =
    distance <= MAX_DELIVERY_DISTANCE;

  // =====================================================
  // DELIVERY CHARGE
  // =====================================================

  let deliveryCharge = 0;

  if (
    totalPrice > 0 &&
    deliveryAvailable
  ) {
    const roundedDistance =
      Math.ceil(distance);

    deliveryCharge =
      roundedDistance *
      DELIVERY_PER_KM;

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

  // =====================================================
  // DISCOUNT
  // =====================================================

  const discount = 0;

  // =====================================================
  // GST
  // =====================================================

  const gst = 0;

  // =====================================================
  // GRAND TOTAL
  // =====================================================

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
          const {
            latitude,
            longitude,
          } = position.coords;

          console.log(
            "📍 USER LOCATION:",
            latitude,
            longitude
          );

          const newLocation = {
            lat: latitude,
            lng: longitude,
          };

          // Update map
          setMapCenter(newLocation);
          setMarker(newLocation);

          // Save location
          localStorage.setItem(
            "userLocation",
            JSON.stringify({
              latitude,
              longitude,
            })
          );

          // Reverse address
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
          } catch (error) {
            console.error(
              "Address lookup error:",
              error
            );

            setAddress(
              `${latitude}, ${longitude}`
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
          "📍 Location Error:",
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

  // =====================================================
  // MANUAL ADDRESS -> MAP LOCATION
  // =====================================================

  const useManualAddress = () => {
    const value = manualAddress.trim();

    if (!value) {
      alert("Please enter your complete delivery address.");
      return;
    }

    if (!window.google?.maps?.Geocoder) {
      alert("Address search is still loading. Please try again.");
      return;
    }

    setGeocodingManual(true);

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode(
      { address: `${value}, Korba, Chhattisgarh, India` },
      (results, status) => {
        setGeocodingManual(false);

        if (status !== "OK" || !results?.[0]?.geometry?.location) {
          alert("Address nahi mila. Please thoda aur complete address enter karein.");
          return;
        }

        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        const formatted = results[0].formatted_address || value;

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
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(16);
        }
      }
    );
  };

  // =====================================================
  // GOOGLE MAP LOAD
  // =====================================================

  const onLoad = (map) => {
    mapRef.current = map;
  };

  // =====================================================
  // MARKER DRAG
  // =====================================================

  const onMarkerDragEnd = async (e) => {
    const lat =
      e.latLng.lat();

    const lng =
      e.latLng.lng();

    const newLocation = {
      lat,
      lng,
    };

    setMarker(newLocation);
    setMapCenter(newLocation);

    // Save location
    localStorage.setItem(
      "userLocation",
      JSON.stringify({
        latitude: lat,
        longitude: lng,
      })
    );

    // Reverse address
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
    } catch (error) {
      console.error(
        "Address error:",
        error
      );

      setAddress(
        `${lat}, ${lng}`
      );
    }
  };

  // =====================================================
  // GOOGLE SEARCH
  // =====================================================

  const onPlaceChanged = () => {
    if (!autocomplete) {
      return;
    }

    const place =
      autocomplete.getPlace();

    if (
      !place ||
      !place.geometry ||
      !place.geometry.location
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

    setMarker(newLocation);
    setMapCenter(newLocation);

    const selectedAddress =
      place.formatted_address || "";

    setAddress(
      selectedAddress
    );

    // Save location
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
  // GET CUSTOMER DATA
  // =====================================================

  const getCustomerData = () => {
    if (!currentUser || !customerProfile) return null;

    return {
      userId: currentUser.uid,
      customerId:
        customerProfile.customerId ||
        `SC-CUST-${currentUser.uid.slice(-8).toUpperCase()}`,
      customerName: customerProfile.name || "Sugar Customer",
      customerPhone: currentUser.phoneNumber || customerProfile.phone || "",
      customerEmail: currentUser.email || customerProfile.email || "",
      photoURL: currentUser.photoURL || "",
    };
  };

  // =====================================================
  // PAYMENT GATEWAY
  // =====================================================

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const saveCustomerAddress = async (customer) => {
    const selectedAddress = {
      id: `${Date.now()}`,
      label: "Delivery Address",
      address: address.trim(),
      fullAddress: address.trim(),
      latitude: Number(marker.lat),
      longitude: Number(marker.lng),
      savedAt: new Date().toISOString(),
    };
    const userRef = doc(db, "users", currentUser.uid);
    await setDoc(userRef, {
      customerId: customer.customerId,
      phone: customer.customerPhone,
      addresses: arrayUnion(selectedAddress),
      defaultAddress: selectedAddress,
    }, { merge: true });
    return selectedAddress;
  };

  const saveCompletedOrder = async (orderData, selectedAddress) => {
    const orderRef = await addDoc(collection(db, "orders"), orderData);
    localStorage.setItem("lastOrderId", orderRef.id);
    localStorage.setItem("lastOrderNumber", orderData.orderNumber);
    localStorage.setItem("lastOrderPaymentStatus", orderData.paymentStatus);
    const updatedProfile = {
      ...customerProfile,
      customerId: orderData.customerId,
      phone: orderData.phone,
      addresses: [...(customerProfile.addresses || []), selectedAddress],
      defaultAddress: selectedAddress,
    };
    setCustomerProfile(updatedProfile);
    setSavedAddresses(updatedProfile.addresses);
    localStorage.setItem("sugarCafeUser", JSON.stringify(updatedProfile));
    return orderRef;
  };

  const readApiResponse = async (response) => {
    const raw = await response.text();
    if (!raw) {
      throw new Error(`Payment service returned an empty response (HTTP ${response.status}).`);
    }

    try {
      return JSON.parse(raw);
    } catch {
      const preview = raw.replace(/\s+/g, " ").slice(0, 180);
      throw new Error(
        `Payment service returned an invalid response (HTTP ${response.status}). ${preview}`
      );
    }
  };

  const startOnlinePayment = async ({ customer, orderData, selectedAddress }) => {
    const gatewayResponse = await fetch(`${import.meta.env.VITE_PAYMENT_API_URL || ""}/api/payment/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderData,
        selectedAddress,
      }),
    });
    const gatewayData = await readApiResponse(gatewayResponse);
    if (!gatewayResponse.ok) throw new Error(gatewayData.error || "Unable to start online payment.");
    const loaded = await loadRazorpay();
    if (!loaded) throw new Error("Payment gateway load nahi ho paya. Internet connection check karein.");

    await new Promise((resolve, reject) => {
      const razorpay = new window.Razorpay({
        key: gatewayData.keyId,
        amount: gatewayData.amount,
        currency: gatewayData.currency,
        name: "Sugar Cafe",
        description: `Sugar Cafe Order ${orderData.orderNumber}`,
        order_id: gatewayData.orderId,
        prefill: {
          name: customer.customerName || "",
          email: customer.customerEmail || "",
          contact: customer.customerPhone || "",
        },
        handler: async (response) => {
          try {
            const verifyResponse = await fetch(`${import.meta.env.VITE_PAYMENT_API_URL || ""}/api/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const verifyData = await readApiResponse(verifyResponse);
            if (!verifyResponse.ok || !verifyData.verified) {
              reject(new Error("Payment verification failed."));
              return;
            }
            // In production Firebase mode the server finalizes the Firestore
            // order after signature + captured-payment verification. For local
            // development, the local payment server returns finalized=false,
            // so the browser saves the verified order as a fallback.
            if (!verifyData.finalized) {
              const paidOrder = {
                ...orderData,
                paymentMethod: "Online Payment",
                paymentStatus: "Paid",
                paymentNote: "Paid and verified by Razorpay.",
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              };
              await saveCompletedOrder(paidOrder, selectedAddress);
            }
            resolve();
          } catch (error) { reject(error); }
        },
        modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
      });
      razorpay.on("payment.failed", (response) => {
        reject(new Error(response?.error?.description || "Payment failed. Please try again."));
      });
      razorpay.open();
    });
  };

  // =====================================================
  // PLACE ORDER
  // =====================================================

  const placeOrder = async () => {

    if (!store.deliveryAvailable) {
      alert(store.announcement || `Delivery orders are available only from ${store.orderTimingLabel}.`);
      return;
    }

    if (paymentMethod === "Online Payment" && !store.upiEnabled) {
      alert("UPI payment is currently unavailable. Please choose another payment method.");
      return;
    }

    if (paymentMethod === "Cash on Delivery" && !store.codEnabled) {
      alert("Cash on Delivery is currently unavailable. Please choose another payment method.");
      return;
    }

    // =================================================
    // CART CHECK
    // =================================================

    if (!cart.length) {
      alert(
        "Your cart is empty."
      );
      return;
    }

    // =================================================
    // CUSTOMER CHECK
    // =================================================

    if (!currentUser || !customerProfile ||
        customerProfile.name === "Sugar Customer" || !customerProfile.phone) {
      alert("Please enter your name and mobile number before placing the order.");
      navigate("/login", { state: { from: "/checkout" } });
      return;
    }

    const customer = getCustomerData();

    if (!customer?.customerPhone) {
      alert("Mobile number is required to place an order.");
      navigate("/login", { state: { from: "/checkout" } });
      return;
    }

    // =================================================
    // ADDRESS CHECK
    // =================================================

    if (!address.trim()) {
      alert(
        "Please select your delivery address."
      );
      return;
    }

    // =================================================
    // DELIVERY CHECK
    // =================================================

    if (!deliveryAvailable) {
      alert(
        `Sorry! We currently deliver within ${MAX_DELIVERY_DISTANCE} km of our shop.`
      );
      return;
    }

    try {
      setPlacingOrder(true);

      // Customer identity is tied to Firebase Auth. Anonymous customers get a
      // persistent UID on this browser/device; the manually entered mobile
      // number is used for contact and is not OTP-verified.

      console.log(
        "👤 CUSTOMER:",
        customer
      );

      // =================================================
      // ORDER ITEMS
      // =================================================

      const orderItems =
        cart.map((item) => ({
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
        }));

      // =================================================
      // ORDER DATA
      // =================================================

      const orderData = {

        // =================================================
        // ORDER NUMBER
        // =================================================

        orderNumber:
          `SC-${Date.now()}`,

        // =================================================
        // CUSTOMER
        // =================================================

        userId:
          customer.userId,

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

        // =================================================
        // ADDRESS
        // =================================================

        address:
          address,

        latitude:
          marker.lat,

        longitude:
          marker.lng,

        distance:
          Number(
            distance.toFixed(2)
          ),

        // =================================================
        // ORDER TYPE
        // =================================================

        orderType:
          "Delivery",

        // =================================================
        // PAYMENT
        // =================================================

        paymentMethod:
          paymentMethod,

        paymentStatus:
          paymentMethod === "Online Payment" ? "Paid" : "Pending",

        paymentNote:
          paymentMethod === "Online Payment" ? "Paid and verified by Razorpay." : "",

        // =================================================
        // ITEMS
        // =================================================

        items:
          orderItems,

        // =================================================
        // BILL
        // =================================================

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
          Number(
            gst
          ),

        total:
          Number(
            grandTotal
          ),

        // =================================================
        // ORDER STATUS
        // =================================================

        status:
          "New",

        // =================================================
        // PREPARATION
        // =================================================

        preparationMinutes:
          Number(store.preparationMinutes ?? 15),

        preparationStartedAt:
          null,

        preparationEndAt:
          null,

        // =================================================
        // TIMELINE
        // =================================================

        foodReadyAt:
          null,

        dispatchedAt:
          null,

        deliveredAt:
          null,

        // =================================================
        // CREATED
        // =================================================

        createdAt:
          Timestamp.now(),
      };

      console.log(
        "📦 ORDER DATA:",
        orderData
      );

      const selectedAddress = await saveCustomerAddress(customer);

      if (paymentMethod === "Online Payment") {
        await startOnlinePayment({ customer, orderData, selectedAddress });
      } else {
        await saveCompletedOrder(orderData, selectedAddress);
      }

      // =================================================
      // SUCCESS
      // =================================================

      alert(
        "🎉 Order Placed Successfully!"
      );

      navigate(
        "/success"
      );

    } catch (error) {

      console.error(
        "❌ Order placement error:",
        error
      );

      const message = error?.message || "Unknown error";
      alert(
        `Order place nahi ho paya.\n\n${message}`
      );

    } finally {

      setPlacingOrder(false);

    }
  };

  // =====================================================
  // PAGE
  // =====================================================

  if (authChecking) {
    return (
      <div className="checkout-page">
        <div className="checkout-card" style={{ textAlign: "center" }}>
          Checking customer account...
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">

      <h2>
        Checkout
      </h2>

      {/* =================================================
          DELIVERY ADDRESS
      ================================================= */}

      <div className="checkout-card">

        <h3>
          📍 Delivery Address
        </h3>

        {/* CUSTOMER CONTACT */}
        {currentUser && customerProfile && (
          <div className="checkout-customer-box">
            <div>👤 <strong>{customerProfile.name || "Sugar Customer"}</strong></div>
            <div className="checkout-customer-id">Customer ID: {customerProfile.customerId}</div>
            <div>📱 {currentUser.phoneNumber || customerProfile.phone}</div>
          </div>
        )}

        {/* SAVED ADDRESSES */}
        {savedAddresses.length > 0 && (
          <div className="saved-addresses">
            <strong>Saved Addresses</strong>
            {savedAddresses.map((saved) => (
              <button
                type="button"
                key={saved.id || `${saved.latitude}-${saved.longitude}-${saved.address}`}
                className="saved-address-btn"
                onClick={() => {
                  const lat = Number(saved.latitude);
                  const lng = Number(saved.longitude);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                  setAddress(saved.fullAddress || saved.address || "");
                  setMarker({ lat, lng });
                  setMapCenter({ lat, lng });
                  localStorage.setItem("userLocation", JSON.stringify(saved));
                }}
              >
                📍 {saved.label || "Address"}<br />
                <span>{saved.fullAddress || saved.address}</span>
              </button>
            ))}
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

          {/* SEARCH */}

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
            <label htmlFor="manual-delivery-address">Or enter address manually</label>
            <textarea
              id="manual-delivery-address"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="House/Flat No., Area, Landmark, City, PIN"
              rows={3}
            />
            <button
              type="button"
              onClick={useManualAddress}
              disabled={geocodingManual}
              className="manual-address-btn"
            >
              {geocodingManual ? "Checking address..." : "✓ Use This Manual Address"}
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

          {/* MAP */}

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
              draggable={
                true
              }
              onDragEnd={
                onMarkerDragEnd
              }
            />

          </GoogleMap>

        </LoadScript>

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
              {deliveryCharge}

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
              {MAX_DELIVERY_DISTANCE}{" "}
              km.

            </>
          )}

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
            disabled={!store.codEnabled}
            checked={paymentMethod === "Cash on Delivery"}
            onChange={() => setPaymentMethod("Cash on Delivery")}
          />
          <span><strong>Cash on Delivery</strong><small>Pay when your order is delivered</small></span>
        </label>

        <label>
          <input
            type="radio"
            name="payment"
            disabled={!store.upiEnabled}
            checked={paymentMethod === "Online Payment"}
            onChange={() => setPaymentMethod("Online Payment")}
          />
          <span><strong>Online Payment</strong><small>UPI / Card / Net Banking via Razorpay</small></span>
        </label>

        {paymentMethod === "Online Payment" && (
          <div className="upi-payment-box">
            <strong>Secure Online Payment</strong>
            <p>UPI, cards and net banking are processed securely by Razorpay.</p>
            <small>No UTR entry or staff payment verification is required.</small>
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
            Delivery
          </span>

          <span>
            ₹{deliveryCharge}
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

        {/* =================================================
            PLACE ORDER
        ================================================= */}

        <button
          className="place-order-btn"
          onClick={
            placeOrder
          }
          disabled={
            !store.deliveryAvailable ||
            placingOrder ||
            !deliveryAvailable
          }
        >

          {placingOrder
            ? "Placing Order..."
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