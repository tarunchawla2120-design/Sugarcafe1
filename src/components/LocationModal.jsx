import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "./LocationModal.css";
import { setDoc, doc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";

/* =========================
   CUSTOM LOCATION PIN
========================= */

const locationIcon = L.divIcon({
  className: "custom-location-pin",
  html: `
    <div class="pin-marker">
      <div class="pin-dot"></div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});


/* =========================
   MOVE MAP TO LOCATION
========================= */

function MapMover({ position }) {

  const map = useMap();

  useEffect(() => {

    if (position) {

      map.setView(
        [position.latitude, position.longitude],
        18,
        {
          animate: true,
        }
      );

    }

  }, [position, map]);

  return null;
}


/* =========================
   LOCATION MODAL
========================= */

function LocationModal({
  onClose,
  onLocationSaved,
  user,
}) {
  const [loading, setLoading] =
    useState(true);

  const [addressLoading, setAddressLoading] =
    useState(false);

  const [location, setLocation] =
    useState(null);

  const [address, setAddress] =
    useState("");

  const [houseNumber, setHouseNumber] =
    useState("");


  /* =========================
     REVERSE GEOCODING
  ========================= */

  const getAddress = async (
    latitude,
    longitude
  ) => {

    try {

      setAddressLoading(true);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=en`,
        {
          headers: {
            Accept: "application/json",
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


      const addressData =
        data.address || {};


      const parts = [

        addressData.house_number,

        addressData.road,

        addressData.neighbourhood,

        addressData.suburb,

        addressData.city,

        addressData.town,

        addressData.district,

        addressData.postcode,

      ].filter(Boolean);


     const finalAddress =
  parts.length >= 2
    ? parts.join(", ")
    : data.display_name || "Current Location";

      setAddress(
        finalAddress
      );


    } catch (error) {

      console.error(
        "Address error:",
        error
      );

      setAddress(
        "Address could not be detected"
      );

    } finally {

      setAddressLoading(false);

    }

  };


  /* =========================
     GET GPS LOCATION
  ========================= */

  const detectLocation = () => {

    if (!navigator.geolocation) {

      alert(
        "Location is not supported on this device."
      );

      setLoading(false);

      return;

    }


    setLoading(true);


    navigator.geolocation.getCurrentPosition(

      async (position) => {

        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const accuracy =
          position.coords.accuracy;


        console.log(
          "Latitude:",
          latitude
        );

        console.log(
          "Longitude:",
          longitude
        );

        console.log(
          "Accuracy:",
          accuracy,
          "meters"
        );


        setLocation({

          latitude,
          longitude,
          accuracy,

        });


        await getAddress(
          latitude,
          longitude
        );


        setLoading(false);

      },


      (error) => {

        console.error(
          "Location error:",
          error
        );

        setLoading(false);


        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {

          alert(
            "Please allow location permission."
          );

        } else {

          alert(
            "Unable to detect your location."
          );

        }

      },


      {

        enableHighAccuracy: true,

        timeout: 30000,

        maximumAge: 0,

      }

    );

  };


  /* =========================
     AUTO DETECT
  ========================= */

  useEffect(() => {

    detectLocation();

  }, []);


  /* =========================
     DRAG PIN
  ========================= */

  const handleMarkerDrag = async (
    event
  ) => {

    const marker =
      event.target;

    const position =
      marker.getLatLng();


    const latitude =
      position.lat;

    const longitude =
      position.lng;


    setLocation(
      (previous) => ({

        ...previous,

        latitude,
        longitude,

        accuracy: 5,

      })
    );


    await getAddress(
      latitude,
      longitude
    );

  };


  /* =========================
     SAVE LOCATION
  ========================= */
const saveLocation = async () => {

  if (!location) {

    alert(
      "Please detect your location first."
    );

    return;
  }



  const savedLocation = {

    id:
      Date.now().toString(),

    label:
      "Home",

    latitude:
      location.latitude,

    longitude:
      location.longitude,

    accuracy:
      location.accuracy,

    address:
      address,

    houseNumber:
      houseNumber.trim(),

    fullAddress:
      `${houseNumber.trim()}, ${address}`,

    savedAt:
      new Date().toISOString(),

  };


  try {

    /*
    =========================
    SAVE LOCAL
    =========================
    */

    localStorage.setItem(
      "userLocation",
      JSON.stringify(
        savedLocation
      )
    );


    /*
    =========================
    SAVE FIREBASE
    =========================
    */

    if (user) {

      const userRef = doc(
        db,
        "users",
        user.uid
      );


      await setDoc(
        userRef,

        {
          addresses:
            arrayUnion(
              savedLocation
            ),

          defaultAddress:
            savedLocation,

        },

        {
          merge: true
        }

      );


      console.log(
        "Address saved to Firebase:",
        savedLocation
      );

    }


    /*
    =========================
    UPDATE NAVBAR
    =========================
    */

    if (onLocationSaved) {

      onLocationSaved(
        savedLocation
      );

    }


    alert(
      "Location saved successfully! 📍"
    );


    onClose();


} catch (error) {

    console.error(
      "Save location error:",
      error
    );

    alert(
      "Location could not be saved. Please try again."
    );

  }

};

return (

  <div className="location-modal-overlay">

    {/* =========================
        HEADER
    ========================= */}

    <div className="location-modal-header">
          <div>

            <h2>
              Select Location
            </h2>

            <p>
              Move the pin to your exact location
            </p>

          </div>


          <button
            className="location-close"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        {/* =========================
            MAP
        ========================= */}

        {loading ? (

          <div className="location-map loading-map">

            <div className="location-loading">

              <div className="location-loader">
                📍
              </div>

              <strong>
                Detecting your location...
              </strong>

              <span>
                Please allow location access
              </span>

            </div>

          </div>

        ) : location ? (

          <div className="real-map">

            <MapContainer
              center={[
                location.latitude,
                location.longitude,
              ]}
              zoom={18}
              scrollWheelZoom={true}
              style={{
                width: "100%",
                height: "100%",
              }}
            >

              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />


              <MapMover
                position={location}
              />


              <Marker
                position={[
                  location.latitude,
                  location.longitude,
                ]}
                icon={locationIcon}
                draggable={true}
                eventHandlers={{
                  dragend:
                    handleMarkerDrag,
                }}
              />

            </MapContainer>


            <div className="map-hint">

              📍 Drag the pin to your exact location

            </div>

          </div>

        ) : null}


        {/* =========================
            ACCURACY
        ========================= */}

        {location && (

          <div className="accuracy-box">

            <span>
              📍
            </span>

            <div>

              <strong>
                Location detected
              </strong>

              <small>
                GPS accuracy:
                {" "}
                {Math.round(
                  location.accuracy
                )}
                {" "}meters
              </small>

            </div>

          </div>

        )}


        {/* =========================
            ADDRESS
        ========================= */}

        {location && (

          <div className="detected-address">

            <span>
              📍
            </span>

            <div>

              <strong>
                Delivery Address
              </strong>

              {addressLoading ? (

                <p>
                  Updating address...
                </p>

              ) : (

                <p>
                  {address}
                </p>

              )}

            </div>

          </div>

        )}


        {/* =========================
            HOUSE NUMBER
        ========================= */}

        {location && (

          <div className="house-input">

            <label>
              House / Flat / Shop No.
            </label>

            <input
              type="text"
              placeholder="e.g. House No. 123"
              value={houseNumber}
              onChange={(e) =>
                setHouseNumber(
                  e.target.value
                )
              }
            />

          </div>

        )}


        {/* =========================
            SAVE
        ========================= */}

        {location && (

          <button
            className="save-location-btn"
            onClick={saveLocation}
          >

            Save Location

          </button>

        )}


      </div>

  );

}

export default LocationModal;