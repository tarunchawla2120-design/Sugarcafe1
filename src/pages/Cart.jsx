import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import "./Cart.css";
import { useStoreSettings } from "../context/StoreContext";

function Cart() {
  const navigate = useNavigate();
  const store = useStoreSettings();

  const {
    cart,
    increaseQty,
    decreaseQty,
    removeFromCart,
    totalPrice,
  } = useCart();

  const [distance, setDistance] = useState(null);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [deliveryError, setDeliveryError] = useState("");

  // =====================================================
  // SHOP LOCATION
  // =====================================================

  // Sugar Crown Cakes - Jamnipali
  // Location captured from your shop location
  const SHOP_LOCATION = {
    latitude: 22.417212,
    longitude: 82.665984,
  };

  // =====================================================
  // DELIVERY AREA
  // =====================================================

  // 10 KM radius covers the SugarCafe delivery area
  const MAX_DELIVERY_DISTANCE = Number(store.maxDeliveryDistanceKm ?? 10);

  // =====================================================
  // DELIVERY CHARGE
  // =====================================================

  const DELIVERY_PER_KM = Number(store.deliveryPerKm ?? 20);
  const MIN_DELIVERY_CHARGE = Number(store.minDeliveryCharge ?? 20);
  const MAX_DELIVERY_CHARGE = Number(store.maxDeliveryCharge ?? 300);

  // =====================================================
  // DISCOUNT
  // =====================================================

  // Discount removed
  const discount = 0;

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
  // CALCULATE DELIVERY
  // =====================================================

  useEffect(() => {
    if (!cart.length) {
      setDistance(null);
      setDeliveryCharge(0);
      setDeliveryError("");
      return;
    }

    const savedLocation =
      localStorage.getItem(
        "userLocation"
      );

    // Location not selected yet
    if (!savedLocation) {
      setDistance(null);
      setDeliveryCharge(0);

      setDeliveryError(
        "Please select your delivery location at checkout."
      );

      return;
    }

    try {
      const customer =
        JSON.parse(savedLocation);

      if (
        customer.latitude == null ||
        customer.longitude == null
      ) {
        throw new Error(
          "Invalid customer location"
        );
      }

      // =================================================
      // DISTANCE
      // =================================================

      const calculatedDistance =
        calculateDistance(
          SHOP_LOCATION.latitude,
          SHOP_LOCATION.longitude,
          customer.latitude,
          customer.longitude
        );

      setDistance(
        calculatedDistance
      );

      // =================================================
      // DELIVERY AREA
      // =================================================

      if (
        calculatedDistance >
        MAX_DELIVERY_DISTANCE
      ) {
        setDeliveryCharge(0);

        setDeliveryError(
          `Sorry! We currently deliver within ${MAX_DELIVERY_DISTANCE} km of our shop, covering the Jamnipali–Chhuri area.`
        );

        return;
      }

      // =================================================
      // DELIVERY CHARGE
      // =================================================

      const roundedDistance =
        Math.ceil(
          calculatedDistance
        );

      let charge =
        roundedDistance *
        DELIVERY_PER_KM;

      if (
        charge <
        MIN_DELIVERY_CHARGE
      ) {
        charge =
          MIN_DELIVERY_CHARGE;
      }

      if (
        charge >
        MAX_DELIVERY_CHARGE
      ) {
        charge =
          MAX_DELIVERY_CHARGE;
      }

      setDeliveryCharge(charge);
      setDeliveryError("");

    } catch (error) {
      console.error(
        "Delivery calculation error:",
        error
      );

      setDistance(null);
      setDeliveryCharge(0);

      setDeliveryError(
        "Unable to calculate delivery charge."
      );
    }
  }, [cart]);

  // =====================================================
  // GRAND TOTAL
  // =====================================================

  const grandTotal =
    totalPrice +
    deliveryCharge -
    discount;

  // =====================================================
  // CHECKOUT
  // =====================================================

  const handleCheckout = () => {
    if (!cart.length) {
      alert("Your cart is empty.");
      return;
    }

    if (!store.deliveryAvailable) {
      alert(store.announcement || `Delivery orders are available only from ${store.orderTimingLabel}.`);
      return;
    }
    navigate("/checkout");
  };

  // =====================================================
  // RETURN
  // =====================================================

  return (
    <div className="cart-page">

      <h2 className="cart-title">
        🛒 My Cart
      </h2>

      {/* EMPTY CART */}

      {cart.length === 0 ? (

        <div className="empty-cart">

          <h2>
            🛒 Your Cart is Empty
          </h2>

          <p>
            Add your favourite food and
            start your order.
          </p>

          <button
            className="shop-btn"
            onClick={() =>
              window.history.back()
            }
          >
            Continue Shopping
          </button>

        </div>

      ) : (

        <>

          {/* CART ITEMS */}

          {cart.map((item) => (

            <div
              className="cart-item"
              key={item.id}
            >

              <div className="item-left">

                <img
                  src={item.image}
                  alt={item.name}
                  className="cart-image"

                  onError={(e) => {
                    e.target.src =
                      "https://placehold.co/100x100/FDE8D7/FF5722?text=Food";
                  }}
                />

                <div>

                  <h3 className="item-name">
                    {item.name}
                  </h3>

                  <p className="item-price">
                    ₹{item.price}
                  </p>

                </div>

              </div>

              {/* QUANTITY */}

              <div className="qty-box">

                <button
                  type="button"
                  className="qty-btn"
                  onClick={() =>
                    decreaseQty(item.id)
                  }
                >
                  −
                </button>

                <strong>
                  {item.qty}
                </strong>

                <button
                  type="button"
                  className="qty-btn"
                  onClick={() =>
                    increaseQty(item.id)
                  }
                >
                  +
                </button>

                <button
                  type="button"
                  className="remove-btn"
                  onClick={() =>
                    removeFromCart(item.id)
                  }
                >
                  🗑
                </button>

              </div>

            </div>

          ))}

          {/* DELIVERY DISTANCE */}

          {distance !== null && (

            <div
              style={{
                margin: "10px 0 15px",
                padding: "12px 14px",
                background:
                  deliveryError
                    ? "#fff1f1"
                    : "#f0fdf4",
                color:
                  deliveryError
                    ? "#dc2626"
                    : "#15803d",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              📍 Delivery distance:

              <strong>
                {" "}
                {distance.toFixed(1)} km
              </strong>

            </div>

          )}

          {/* DELIVERY ERROR */}

          {deliveryError && (

            <div
              style={{
                margin: "10px 0 15px",
                padding: "12px 14px",
                background: "#fff1f1",
                color: "#dc2626",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              ⚠️ {deliveryError}
            </div>

          )}

          {/* SUMMARY */}

          <div className="summary">

            <p>
              <span>
                Subtotal
              </span>

              <span>
                ₹{totalPrice}
              </span>
            </p>

            {/* DISCOUNT REMOVED */}

            <p>
              <span>
                Delivery
              </span>

              <span>
                {deliveryError
                  ? "—"
                  : `₹${deliveryCharge}`}
              </span>
            </p>

            <hr />

            <h2>
              <span>
                Total
              </span>

              <span>
                ₹
                {deliveryError
                  ? totalPrice
                  : grandTotal}
              </span>
            </h2>

            <button
              type="button"
              className="checkout-btn"
              onClick={handleCheckout}
            >
              Proceed to Checkout →
            </button>

          </div>

        </>

      )}

    </div>
  );
}

export default Cart;