/* =========================================================
   SUGAR CAFE — PREMIUM CHECKOUT FINAL
   UI + DELIVERY + TAKEAWAY + RAZORPAY + FIREBASE
========================================================= */

import {
  useState,
  useRef,
  useEffect,
} from "react";

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
} from "firebase/firestore";

import { db } from "../firebase";

import "./Checkout.css";

import {
  useStoreSettings,
} from "../context/StoreContext";


function Checkout() {

  const navigate = useNavigate();

  const store = useStoreSettings();

  const {
    cart,
    totalPrice,
  } = useCart();


  /* =====================================================
     BASIC STATE
  ===================================================== */

  const [orderType, setOrderType] =
    useState("Delivery");

  const [address, setAddress] =
    useState("");

  const [loadingLocation, setLoadingLocation] =
    useState(false);

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState("Cash on Delivery");

  const [specialNote, setSpecialNote] =
    useState("");

  const [autocomplete, setAutocomplete] =
    useState(null);

  const [customerProfile, setCustomerProfile] =
    useState(null);

  const [savedAddresses, setSavedAddresses] =
    useState([]);

  const [manualAddress, setManualAddress] =
    useState("");

  const [geocodingManual, setGeocodingManual] =
    useState(false);


  /* =====================================================
     SHOP LOCATION
  ===================================================== */

  const SHOP_LOCATION = {
    lat: 22.417212,
    lng: 82.665984,
  };


  const [mapCenter, setMapCenter] =
    useState(SHOP_LOCATION);

  const [marker, setMarker] =
    useState(SHOP_LOCATION);

  const mapRef = useRef(null);


  /* =====================================================
     GOOGLE MAP API
  ===================================================== */

  const googleApiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY;


  /* =====================================================
     DELIVERY SETTINGS
  ===================================================== */

  const MAX_DELIVERY_DISTANCE =
    Number(
      store.maxDeliveryDistanceKm ?? 10
    );

  const DELIVERY_PER_KM =
    Number(
      store.deliveryPerKm ?? 20
    );

  const MIN_DELIVERY_CHARGE =
    Number(
      store.minDeliveryCharge ?? 20
    );

  const MAX_DELIVERY_CHARGE =
    Number(
      store.maxDeliveryCharge ?? 300
    );


  /* =====================================================
     LOAD CUSTOMER
  ===================================================== */

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
          customerId: "",
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || "",
          addresses:
            data.addresses || [],
          guest: true,
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

          setMarker(saved);
          setMapCenter(saved);

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
        "Checkout loading error:",
        error
      );

    }

  }, []);


  /* =====================================================
     DISTANCE
  ===================================================== */

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


  const distance =
    calculateDistance(
      SHOP_LOCATION.lat,
      SHOP_LOCATION.lng,
      marker.lat,
      marker.lng
    );


  const deliveryAvailable =
    distance <=
    MAX_DELIVERY_DISTANCE;


  /* =====================================================
     DELIVERY CHARGE
  ===================================================== */

  let deliveryCharge = 0;

  if (
    orderType === "Delivery" &&
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


  const discount = 0;

  const gst = 0;


  const grandTotal =
    Number(totalPrice) +
    Number(deliveryCharge) -
    Number(discount) +
    Number(gst);


  /* =====================================================
     CURRENT LOCATION
  ===================================================== */

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


  /* =====================================================
     MANUAL ADDRESS
  ===================================================== */

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

        const lat =
          location.lat();

        const lng =
          location.lng();

        const formatted =
          results[0].formatted_address ||
          value;

        setMarker({
          lat,
          lng,
        });

        setMapCenter({
          lat,
          lng,
        });

        setAddress(
          formatted
        );

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


  /* =====================================================
     MAP
  ===================================================== */

  const onLoad = (map) => {

    mapRef.current = map;
  };


  /* =====================================================
     MARKER DRAG
  ===================================================== */

  const onMarkerDragEnd =
    async (e) => {

      const lat =
        e.latLng.lat();

      const lng =
        e.latLng.lng();

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


  /* =====================================================
     GOOGLE SEARCH
  ===================================================== */

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

    const selectedAddress =
      place.formatted_address || "";

    setMarker(
      newLocation
    );

    setMapCenter(
      newLocation
    );

    setAddress(
      selectedAddress
    );

    localStorage.setItem(
      "userLocation",
      JSON.stringify({
        latitude: lat,
        longitude: lng,
        address:
          selectedAddress,
      })
    );


    if (mapRef.current) {

      mapRef.current.panTo(
        newLocation
      );

      mapRef.current.setZoom(16);
    }
  };


  /* =====================================================
     CUSTOMER DATA
  ===================================================== */

  const getCustomerData = () => {

    if (!customerProfile) {
      return null;
    }

    return {

      userId: "",

      customerId: "",

      customerName:
        customerProfile.name ||
        "Customer",

      customerPhone:
        customerProfile.phone ||
        "",

      customerEmail:
        customerProfile.email ||
        "",

      photoURL: "",
    };
  };


  /* =====================================================
     RAZORPAY
  ===================================================== */

  const loadRazorpay = () =>
    new Promise(
      (resolve) => {

        if (window.Razorpay) {

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


  /* =====================================================
     SAVE ADDRESS
  ===================================================== */

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


      if (
        orderType !== "Delivery"
      ) {

        return selectedAddress;
      }


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

          const existingAddresses =
            Array.isArray(
              profile.addresses
            )
              ? profile.addresses
              : [];

          const updatedProfile = {

            ...profile,

            customerId: "",

            addresses: [
              ...existingAddresses,
              selectedAddress,
            ],

            defaultAddress:
              selectedAddress,

            guest: true,
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
            updatedProfile.addresses
          );
        }

      } catch (error) {

        console.error(
          "Guest address save error:",
          error
        );
      }

      return selectedAddress;
    };


  /* =====================================================
     SAVE ORDER
  ===================================================== */

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


      if (
        savedUser &&
        orderType === "Delivery"
      ) {

        try {

          const profile =
            JSON.parse(
              savedUser
            );

          const updatedProfile = {

            ...profile,

            customerId: "",

            addresses: [
              ...(profile.addresses || []),
              selectedAddress,
            ],

            defaultAddress:
              selectedAddress,

            guest: true,
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
            updatedProfile.addresses ||
            []
          );

        } catch (error) {

          console.error(
            "Guest profile update error:",
            error
          );
        }
      }


      return orderRef;
    };


  /* =====================================================
     API RESPONSE
  ===================================================== */

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

        const preview =
          raw
            .replace(/\s+/g, " ")
            .slice(0, 180);

        throw new Error(
          `Payment service returned an invalid response (HTTP ${response.status}). ${preview}`
        );
      }
    };


  /* =====================================================
     ONLINE PAYMENT
  ===================================================== */

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
              .VITE_PAYMENT_API_URL ||
            ""
          }/api/payment/create-order`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
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
                        `${
                          import.meta.env
                            .VITE_PAYMENT_API_URL ||
                          ""
                        }/api/payment/verify`,
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

                ondismiss:
                  () =>
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


  /* =====================================================
     PLACE ORDER
  ===================================================== */

  const placeOrder = async () => {

    if (!store.deliveryAvailable) {

      alert(
        store.announcement ||
        `Orders are unavailable ${store.orderTimingLabel || ""}.`
      );

      return;
    }


    if (
      paymentMethod ===
        "Online Payment" &&
      !store.upiEnabled
    ) {

      alert(
        "Online payment is currently unavailable. Please choose another payment method."
      );

      return;
    }


    if (
      paymentMethod ===
        "Cash on Delivery" &&
      !store.codEnabled
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
        "Please enter your name and mobile number before placing the order."
      );

      navigate(
        "/login",
        {
          state: {
            from: "/checkout",
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
        "Mobile number is required to place an order."
      );

      return;
    }


    /* DELIVERY ONLY VALIDATION */

    if (
      orderType === "Delivery"
    ) {

      if (!address.trim()) {

        alert(
          "Please select your delivery address."
        );

        return;
      }


      if (!deliveryAvailable) {

        alert(
          `Sorry! We currently deliver within ${MAX_DELIVERY_DISTANCE} km of our shop.`
        );

        return;
      }
    }


    try {

      setPlacingOrder(true);


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


      const orderData = {

        orderNumber:
          `SC-${Date.now()}`,

        userId: "",

        customerId: "",

        customerName:
          customer.customerName,

        phone:
          customer.customerPhone,

        email:
          customer.customerEmail,

        photoURL:
          customer.photoURL,


        /* ORDER TYPE */

        orderType:
          orderType,


        /* ADDRESS */

        address:
          orderType === "Delivery"
            ? address
            : "Takeaway — Pickup from Sugar Cafe",


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


        /* SPECIAL NOTE */

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


        /* TOTALS */

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


        /* STATUS */

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


      const selectedAddress =
        await saveCustomerAddress();


      /* ONLINE */

      if (
        paymentMethod ===
        "Online Payment"
      ) {

        await startOnlinePayment({
          customer,
          orderData,
          selectedAddress,
        });

      }

      /* COD */

      else {

        await saveCompletedOrder(
          orderData,
          selectedAddress
        );
      }


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

      const message =
        error?.message ||
        "Unknown error";


      alert(
        `Order place nahi ho paya.\n\n${message}`
      );


    } finally {

      setPlacingOrder(
        false
      );
    }
  };


  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="checkout-page">


      {/* =================================================
         HEADER
      ================================================= */}

      <div className="checkout-header">

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

          <span>
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

      </div>


      {/* =================================================
         ORDER TYPE
      ================================================= */}

      <div className="checkout-card">

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

          {/* DELIVERY */}

          <button
            type="button"
            className={`order-type-option ${
              orderType === "Delivery"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrderType(
                "Delivery"
              )
            }
          >

            <div className="option-top">

              <span className="option-emoji">
                🛵
              </span>

              <span className="option-radio">
                {orderType ===
                "Delivery"
                  ? "✓"
                  : ""}
              </span>

            </div>

            <strong>
              Delivery
            </strong>

            <small>
              We deliver to your location
            </small>

          </button>


          {/* TAKEAWAY */}

          <button
            type="button"
            className={`order-type-option ${
              orderType === "Takeaway"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setOrderType(
                "Takeaway"
              )
            }
          >

            <div className="option-top">

              <span className="option-emoji">
                🛍️
              </span>

              <span className="option-radio">
                {orderType ===
                "Takeaway"
                  ? "✓"
                  : ""}
              </span>

            </div>

            <strong>
              Takeaway
            </strong>

            <small>
              Pick up from our cafe
            </small>

          </button>

        </div>

      </div>


      {/* =================================================
         DELIVERY LOCATION
      ================================================= */}

      {orderType ===
        "Delivery" && (

        <div className="checkout-card">

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
                Your location is detected automatically
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
                👤
              </div>

              <div className="customer-info">

                <strong>
                  {customerProfile.name ||
                    "Customer"}
                </strong>

                <span>
                  📱{" "}
                  {customerProfile.phone}
                </span>

                {customerProfile.email && (
                  <span>
                    ✉️{" "}
                    {customerProfile.email}
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
                    <strong>
                      {saved.label ||
                        "Delivery Address"}
                    </strong>

                    <span>
                      {saved.fullAddress ||
                        saved.address}
                    </span>

                  </button>
                )
              )}

            </div>
          )}


          {/* GOOGLE SEARCH */}

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
                className="address-search-input"
              />

            </Autocomplete>


            {/* MANUAL ADDRESS */}

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


            {/* CURRENT LOCATION */}

            <button
              type="button"
              onClick={
                getCurrentLocation
              }
              className="current-location-btn"
            >

              {loadingLocation
                ? "Getting Location..."
                : "📍 Use My Current Location"}

            </button>


            {/* MAP */}

            <GoogleMap
              mapContainerStyle={{
                width: "100%",
                height: "300px",
                marginTop: "15px",
                borderRadius: "20px",
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


            {/* MAP HELP */}

            <div className="map-help-box">

              <span>
                💡
              </span>

              <div>

                <strong>
                  Easy location selection
                </strong>

                <p>
                  Map ko finger se move karein.
                  Center pin aapki selected
                  delivery location hai.
                </p>

              </div>

            </div>

          </LoadScript>


          {/* DELIVERY STATUS */}

          <div
            className={`delivery-status ${
              deliveryAvailable
                ? "available"
                : "unavailable"
            }`}
          >

            {deliveryAvailable ? (

              <>
                📍{" "}
                <strong>
                  Delivery available
                </strong>

                <span>
                  Distance:{" "}
                  {distance.toFixed(1)}
                  {" "}km
                </span>

                <span>
                  Delivery charge: ₹
                  {deliveryCharge}
                </span>
              </>

            ) : (

              <>
                ⚠️{" "}
                <strong>
                  Delivery unavailable
                </strong>

                <span>
                  Your location is{" "}
                  {distance.toFixed(1)}
                  {" "}km away.
                </span>

                <span>
                  We deliver within{" "}
                  {MAX_DELIVERY_DISTANCE}
                  {" "}km.
                </span>
              </>

            )}

          </div>

        </div>
      )}


      {/* =================================================
         TAKEAWAY INFO
      ================================================= */}

      {orderType ===
        "Takeaway" && (

        <div className="checkout-card takeaway-info-card">

          <div className="section-heading">

            <div className="section-icon">
              🛍️
            </div>

            <div>

              <span className="section-label">
                TAKEAWAY
              </span>

              <h3>
                Pick Up From Cafe
              </h3>

              <p>
                Your order will be prepared
                for pickup at Sugar Cafe.
              </p>

            </div>

          </div>


          <div className="takeaway-box">

            <span>
              🏪
            </span>

            <div>

              <strong>
                Sugar Cafe
              </strong>

              <p>
                Please collect your order
                from the cafe when it is ready.
              </p>

            </div>

          </div>

        </div>
      )}


      {/* =================================================
         SPECIAL NOTE
      ================================================= */}

      <div className="checkout-card">

        <div className="section-heading">

          <div className="section-icon">
            📝
          </div>

          <div>

            <span className="section-label">
              OPTIONAL
            </span>

            <h3>
              Special Note
            </h3>

            <p>
              Any special request for your order?
            </p>

          </div>

          <span className="optional-badge">
            OPTIONAL
          </span>

        </div>


        <div className="special-note-wrapper">

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
            maxLength={300}
            placeholder="Example: Less spicy, no onion, extra cheese, birthday message..."
            rows={5}
          />

          <span className="note-pencil">
            ✎
          </span>

        </div>


        <div className="note-footer">

          <span>
            Your request will be shared with the café.
          </span>

          <span>
            {specialNote.length}/300
          </span>

        </div>

      </div>


      {/* =================================================
         PAYMENT
      ================================================= */}

      <div className="checkout-card">

        <div className="section-heading">

          <div className="section-icon">
            💳
          </div>

          <div>

            <span className="section-label">
              SECURE CHECKOUT
            </span>

            <h3>
              Payment Method
            </h3>

            <p>
              Choose how you want to pay
            </p>

          </div>

        </div>


        {/* COD */}

        <label
          className={`payment-option ${
            paymentMethod ===
            "Cash on Delivery"
              ? "active"
              : ""
          }`}
        >

          <div className="payment-icon">
            💵
          </div>

          <div className="payment-text">

            <strong>
              Cash on Delivery
            </strong>

            <small>
              Pay when your order arrives
            </small>

          </div>

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

        </label>


        {/* ONLINE */}

        <label
          className={`payment-option ${
            paymentMethod ===
            "Online Payment"
              ? "active"
              : ""
          }`}
        >

          <div className="payment-icon">
            💳
          </div>

          <div className="payment-text">

            <strong>
              Online Payment
            </strong>

            <small>
              UPI / Card / Net Banking
            </small>

          </div>

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

        </label>


        {paymentMethod ===
          "Online Payment" && (

          <div className="upi-payment-box">

            <strong>
              🔒 Secure Online Payment
            </strong>

            <p>
              UPI, cards and net banking
              are processed securely by Razorpay.
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

      <div className="checkout-card summary-card">

        <div className="section-heading">

          <div className="section-icon">
            🧾
          </div>

          <div>

            <span className="section-label">
              YOUR ORDER
            </span>

            <h3>
              Order Summary
            </h3>

          </div>

        </div>


        <div className="summary-row">

          <span>
            Subtotal
          </span>

          <strong>
            ₹{totalPrice}
          </strong>

        </div>


        <div className="summary-row">

          <span>
            Delivery
          </span>

          <strong>
            ₹{deliveryCharge}
          </strong>

        </div>


        <div className="summary-row">

          <span>
            GST
          </span>

          <strong>
            ₹{gst}
          </strong>

        </div>


        <div className="summary-divider" />


        <div className="grand-total">

          <span>
            Total
          </span>

          <strong>
            ₹{grandTotal}
          </strong>

        </div>


        <button
          className="place-order-btn"
          onClick={
            placeOrder
          }
          disabled={
            !store.deliveryAvailable ||
            placingOrder ||
            (
              orderType ===
              "Delivery" &&
              !deliveryAvailable
            )
          }
        >

          {placingOrder
            ? "Placing Order..."
            : orderType ===
              "Takeaway"
            ? "Place Takeaway Order"
            : !store.deliveryAvailable
            ? `Orders available ${store.orderTimingLabel || ""}`
            : !deliveryAvailable
            ? "Delivery Not Available"
            : "Place Order"}

        </button>

      </div>

    </div>
  );
}


export default Checkout;
