import React, { useEffect, useRef, useState } from "react";
import "./LocationPicker.css";

/*
=========================================================
SUGAR CAFE - PREMIUM GOOGLE MAP LOCATION PICKER
=========================================================
*/

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// ⚠️ Yaha apne Sugar Cafe ke exact coordinates rakho
const SHOP_LOCATION = {
  lat: 22.3595,
  lng: 82.7501,
};

const MAX_DELIVERY_DISTANCE = 15;
const DELIVERY_PER_KM = 20;
const MIN_DELIVERY_CHARGE = 20;
const MAX_DELIVERY_CHARGE = 300;

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    if (!GOOGLE_MAPS_KEY) {
      reject(new Error("Google Maps API key missing"));
      return;
    }

    const existing = document.getElementById("sugar-google-maps");

    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");

    script.id = "sugar-google-maps";
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}` +
      `&libraries=places`;

    script.async = true;
    script.defer = true;

    script.onload = () => resolve(window.google);
    script.onerror = reject;

    document.head.appendChild(script);
  });
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDeliveryCharge(distance) {
  if (distance > MAX_DELIVERY_DISTANCE) {
    return null;
  }

  return Math.min(
    MAX_DELIVERY_CHARGE,
    Math.max(
      MIN_DELIVERY_CHARGE,
      Math.ceil(distance) * DELIVERY_PER_KM
    )
  );
}

export default function LocationPicker({
  onLocationConfirm,
  initialLocation = null,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const pinMarker = useRef(null);
  const gpsMarker = useRef(null);
  const searchInputRef = useRef(null);
  const geocoderRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const [location, setLocation] = useState(initialLocation);
  const [address, setAddress] = useState("");
  const [distance, setDistance] = useState(null);
  const [deliveryCharge, setDeliveryCharge] = useState(null);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);

  const [mapsReady, setMapsReady] = useState(false);

  /*
  ========================================================
  LOAD GOOGLE MAP
  ========================================================
  */

  useEffect(() => {
    let mounted = true;

    loadGoogleMaps()
      .then(() => {
        if (!mounted) return;

        setMapsReady(true);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;

        setError(
          "Google Maps load nahi ho pa raha. API key check karein."
        );

        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  /*
  ========================================================
  INITIALIZE MAP
  ========================================================
  */

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstance.current) return;

    const google = window.google;

    const defaultCenter = initialLocation
      ? {
          lat: Number(initialLocation.lat),
          lng: Number(initialLocation.lng),
        }
      : SHOP_LOCATION;

    mapInstance.current = new google.maps.Map(mapRef.current, {
      center: defaultCenter,

      zoom: initialLocation ? 17 : 14,

      mapTypeId: "roadmap",

      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,

      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_CENTER,
      },

      gestureHandling: "greedy",

      clickableIcons: true,

      styles: [
        {
          elementType: "geometry",
          stylers: [{ color: "#1f2937" }],
        },
        {
          elementType: "labels.text.fill",
          stylers: [{ color: "#e5e7eb" }],
        },
        {
          elementType: "labels.text.stroke",
          stylers: [{ color: "#111827" }],
        },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#374151" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry",
          stylers: [{ color: "#806b43" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry.stroke",
          stylers: [{ color: "#5b4a2f" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#172554" }],
        },
        {
          featureType: "landscape",
          elementType: "geometry",
          stylers: [{ color: "#1e293b" }],
        },
        {
          featureType: "poi",
          elementType: "geometry",
          stylers: [{ color: "#263449" }],
        },
        {
          featureType: "poi",
          elementType: "labels.text.fill",
          stylers: [{ color: "#f0a46b" }],
        },
      ],
    });

    geocoderRef.current = new google.maps.Geocoder();

    /*
    ======================================================
    SEARCH BOX
    ======================================================
    */

    if (searchInputRef.current) {
      const autocomplete =
        new google.maps.places.Autocomplete(
          searchInputRef.current,
          {
            fields: [
              "formatted_address",
              "geometry",
              "name",
            ],
            componentRestrictions: {
              country: "in",
            },
          }
        );

      autocomplete.bindTo(
        "bounds",
        mapInstance.current
      );

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();

        if (!place.geometry?.location) return;

        const lat =
          place.geometry.location.lat();

        const lng =
          place.geometry.location.lng();

        updateLocation(
          lat,
          lng,
          place.formatted_address ||
            place.name ||
            ""
        );
      });
    }

    /*
    ======================================================
    MAP CLICK
    ======================================================
    */

    mapInstance.current.addListener(
      "click",
      (event) => {
        if (!event.latLng) return;

        updateLocation(
          event.latLng.lat(),
          event.latLng.lng()
        );
      }
    );

    /*
    ======================================================
    INITIAL LOCATION
    ======================================================
    */

    if (initialLocation) {
      updateLocation(
        Number(initialLocation.lat),
        Number(initialLocation.lng),
        initialLocation.address || ""
      );
    } else {
      detectCurrentLocation();
    }

    return () => {
      if (mapInstance.current) {
        google.maps.event.clearInstanceListeners(
          mapInstance.current
        );
      }
    };
  }, [mapsReady]);

  /*
  ========================================================
  UPDATE LOCATION
  ========================================================
  */

  const updateLocation = (
    lat,
    lng,
    knownAddress = ""
  ) => {
    if (!mapInstance.current) return;

    const google = window.google;

    const position = {
      lat: Number(lat),
      lng: Number(lng),
    };

    /*
    ------------------------------------------------------
    RED DELIVERY PIN
    ------------------------------------------------------
    */

    if (pinMarker.current) {
      pinMarker.current.setPosition(position);
    } else {
      pinMarker.current =
        new google.maps.Marker({
          position,
          map: mapInstance.current,

          title: "Delivery Location",

          draggable: true,

          animation:
            google.maps.Animation.DROP,

          icon: {
            path:
              google.maps.SymbolPath
                .CIRCLE,

            scale: 11,

            fillColor: "#ff2d2d",
            fillOpacity: 1,

            strokeColor: "#ffffff",
            strokeWeight: 4,
          },
        });

      pinMarker.current.addListener(
        "dragend",
        () => {
          const pos =
            pinMarker.current.getPosition();

          if (!pos) return;

          updateLocation(
            pos.lat(),
            pos.lng()
          );
        }
      );
    }

    /*
    ------------------------------------------------------
    BLUE GPS DOT
    ------------------------------------------------------
    */

    if (gpsMarker.current) {
      gpsMarker.current.setPosition(
        position
      );
    } else {
      gpsMarker.current =
        new google.maps.Marker({
          position,
          map: mapInstance.current,

          clickable: false,

          icon: {
            path:
              google.maps.SymbolPath
                .CIRCLE,

            scale: 8,

            fillColor: "#4285f4",
            fillOpacity: 1,

            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
    }

    /*
    ------------------------------------------------------
    MAP CENTER
    ------------------------------------------------------
    */

    mapInstance.current.panTo(position);

    mapInstance.current.setZoom(17);

    /*
    ------------------------------------------------------
    DISTANCE
    ------------------------------------------------------
    */

    const calculatedDistance =
      calculateDistance(
        SHOP_LOCATION.lat,
        SHOP_LOCATION.lng,
        lat,
        lng
      );

    const roundedDistance =
      Number(calculatedDistance.toFixed(1));

    const charge =
      getDeliveryCharge(
        roundedDistance
      );

    setLocation({
      lat,
      lng,
    });

    setDistance(roundedDistance);

    setDeliveryCharge(charge);

    setDeliveryAvailable(
      charge !== null
    );

    /*
    ------------------------------------------------------
    REVERSE GEOCODE
    ------------------------------------------------------
    */

    if (knownAddress) {
      setAddress(knownAddress);
    } else if (geocoderRef.current) {
      geocoderRef.current.geocode(
        {
          location: {
            lat,
            lng,
          },
        },
        (results, status) => {
          if (
            status === "OK" &&
            results?.length
          ) {
            setAddress(
              results[0].formatted_address
            );
          }
        }
      );
    }
  };

  /*
  ========================================================
  GPS LOCATION
  ========================================================
  */

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError(
        "Is phone mein location support available nahi hai."
      );
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat =
          position.coords.latitude;

        const lng =
          position.coords.longitude;

        updateLocation(lat, lng);

        setLocating(false);
      },
      (err) => {
        console.error(err);

        setLocating(false);

        setError(
          "Location permission allow karein."
        );
      },
      {
        enableHighAccuracy: true,

        timeout: 15000,

        maximumAge: 0,
      }
    );
  };

  /*
  ========================================================
  CONFIRM LOCATION
  ========================================================
  */

  const handleConfirm = () => {
    if (!location || !address) {
      setError(
        "Please location select karein."
      );
      return;
    }

    if (!deliveryAvailable) {
      setError(
        `Sorry, hum ${MAX_DELIVERY_DISTANCE} km ke bahar delivery nahi karte.`
      );
      return;
    }

    const finalLocation = {
      latitude: location.lat,
      longitude: location.lng,

      lat: location.lat,
      lng: location.lng,

      address,

      distanceKm: distance,

      deliveryCharge,

      deliveryAvailable: true,
    };

    /*
    Save locally
    */

    localStorage.setItem(
      "sugarCafeDeliveryLocation",
      JSON.stringify(finalLocation)
    );

    /*
    Send to checkout
    */

    if (onLocationConfirm) {
      onLocationConfirm(
        finalLocation
      );
    }
  };

  return (
    <section className="sc-location-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="sc-location-header">

        <button
          className="sc-back-btn"
          type="button"
          onClick={() =>
            window.history.back()
          }
        >
          ←
        </button>

        <div className="sc-brand">
          <div className="sc-brand-script">
            SugarCafe
          </div>

          <div className="sc-brand-tag">
            GOOD FOOD · GOOD MOOD
          </div>
        </div>

        <button
          className="sc-support-btn"
          type="button"
        >
          <span>◉</span>
          Support
        </button>

      </header>

      {/* =================================================
          MAP CARD
      ================================================= */}

      <div className="sc-map-section">

        <div className="sc-map-heading">

          <div className="sc-location-title">

            <span className="sc-big-pin">
              📍
            </span>

            <div>
              <h1>
                Select Delivery Location
              </h1>

              <p>
                Find your current location on map
              </p>
            </div>

          </div>

          {location && (
            <div className="sc-detected">
              ✓ Location Detected
            </div>
          )}

        </div>

        {/* SEARCH */}

        <div className="sc-search-box">

          <span>⌕</span>

          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for an area, landmark or move map"
          />

        </div>

      </div>

      {/* =================================================
          GOOGLE MAP
      ================================================= */}

      <div className="sc-map-wrapper">

        {loading && (
          <div className="sc-map-loading">
            <div className="sc-spinner" />
            <span>
              Loading map...
            </span>
          </div>
        )}

        <div
          ref={mapRef}
          className="sc-google-map"
        />

        {/* CURRENT LOCATION BUTTON */}

        <button
          type="button"
          className="sc-current-location"
          onClick={
            detectCurrentLocation
          }
          disabled={locating}
        >
          {locating ? "…" : "⌾"}
        </button>

      </div>

      {/* =================================================
          SELECTED ADDRESS
      ================================================= */}

      <div className="sc-address-card">

        <div className="sc-address-top">

          <div className="sc-address-title">

            <span>📍</span>

            <strong>
              Your Delivery Location
            </strong>

          </div>

          <button
            type="button"
            className="sc-change-btn"
            onClick={
              detectCurrentLocation
            }
          >
            ↻ Change Location
          </button>

        </div>

        <div className="sc-address-text">
          {address ||
            "Detecting your location..."}
        </div>

      </div>

      {/* =================================================
          DELIVERY INFO
      ================================================= */}

      {location && (
        <div
          className={`sc-delivery-card ${
            deliveryAvailable
              ? "available"
              : "unavailable"
          }`}
        >

          <div className="sc-delivery-heading">

            <div className="sc-check-circle">
              {deliveryAvailable
                ? "✓"
                : "!"}
            </div>

            <div>

              <h2>
                {deliveryAvailable
                  ? "Delivery available"
                  : "Delivery unavailable"}
              </h2>

              <p>
                {deliveryAvailable
                  ? "We deliver to your location"
                  : `We currently deliver within ${MAX_DELIVERY_DISTANCE} km`}
              </p>

            </div>

          </div>

          {deliveryAvailable && (
            <div className="sc-delivery-stats">

              <div className="sc-stat">

                <span className="sc-stat-icon">
                  ⌖
                </span>

                <div>

                  <small>
                    Distance
                  </small>

                  <strong>
                    {distance} km
                  </strong>

                </div>

              </div>

              <div className="sc-stat-divider" />

              <div className="sc-stat">

                <span className="sc-stat-icon">
                  🚚
                </span>

                <div>

                  <small>
                    Delivery charge
                  </small>

                  <strong>
                    ₹{deliveryCharge}
                  </strong>

                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* ERROR */}

      {error && (
        <div className="sc-location-error">
          {error}
        </div>
      )}

      {/* =================================================
          CONFIRM
      ================================================= */}

      <button
        type="button"
        className="sc-confirm-btn"
        onClick={handleConfirm}
        disabled={
          !location ||
          !address ||
          !deliveryAvailable
        }
      >
        Continue to Checkout
        <span>→</span>
      </button>

    </section>
  );
}
