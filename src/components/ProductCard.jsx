import { useCart } from "../context/CartContext";
import React from "react";
import "./ProductCard.css";
import { FaStar, FaHeart, FaPlus } from "react-icons/fa";
import { useStoreSettings } from "../context/StoreContext";

function ProductCard({ product }) {
  const { addToCart } = useCart();
  const store = useStoreSettings();

  if (!product) return null;

  // Product availability
  const available =
    product.available !== false &&
    store.isOpen &&
    store.acceptingOrders;

  // =========================
  // BESTSELLER PRODUCTS
  // =========================

  const bestsellerItems = [
    "Exotic Cheese Pizza",
    "Cold Coffee with Ice Cream",
    "Cheese Fries",
    "Bombay Sandwich",
    "Rasmalai Sweet",
    "KitKat Shake",
    "Paneer Tikka Pizza",
    "Exotic Cheese Sandwich",
  ];

  const isBestseller = bestsellerItems.some(
    (item) =>
      item.toLowerCase() ===
      (product.name || "").trim().toLowerCase()
  );

  // =========================
  // PRODUCT RATING
  // =========================

  const getRating = (name = "") => {
    const ratings = [4.5, 4.6, 4.7, 4.8, 4.9];

    let total = 0;

    for (let i = 0; i < name.length; i++) {
      total += name.charCodeAt(i);
    }

    return ratings[total % ratings.length];
  };

  const rating =
    product.rating || getRating(product.name);

  // =========================
  // UNAVAILABLE TEXT
  // =========================

  const unavailableText = !store.isOpen
    ? "🔒 Closed"
    : !store.acceptingOrders
    ? "⏸ Unavailable"
    : "⏸ Unavailable";

  return (
    <div
      className={`product-card ${
        !available ? "product-unavailable" : ""
      }`}
    >

      {/* =========================
          PRODUCT IMAGE
      ========================= */}

      <div className="product-image-box">

        <img
          src={
            product.image ||
            "/food-placeholder.jpg"
          }
          alt={product.name}
          className="product-image"
        />

        {/* OFF OVERLAY */}

        {!available && (
          <div className="unavailable-overlay">
            <span className="unavailable-badge">
              {unavailableText}
            </span>
          </div>
        )}

        {/* BESTSELLER */}

        {isBestseller && available && (
          <span className="product-badge">
            ⭐ Bestseller
          </span>
        )}

        {/* WISHLIST */}

        <button
          className="wishlist-btn"
          type="button"
        >
          <FaHeart />
        </button>

      </div>

      {/* =========================
          PRODUCT INFORMATION
      ========================= */}

      <div className="product-info">

        <div className="product-title">

          <h3>
            {product.name}
          </h3>

          <div className="rating">

            <FaStar />

            <span>
              {rating}
            </span>

          </div>

        </div>

        <p>
          {product.description ||
            "Delicious and freshly prepared."}
        </p>

        <div className="product-bottom">

          <div className="price-box">

            <span className="price">
              ₹{product.price}
            </span>

            {product.oldPrice && (
              <span className="old-price">
                ₹{product.oldPrice}
              </span>
            )}

          </div>

          {/* ADD BUTTON */}

          <button
            className={`add-btn ${
              !available
                ? "add-btn-disabled"
                : ""
            }`}
            disabled={!available}
            type="button"
            onClick={() =>
              available &&
              addToCart(product)
            }
          >
            <FaPlus />

            <span>
              {available
                ? "Add"
                : "Unavailable"}
            </span>

          </button>

        </div>

      </div>

    </div>
  );
}

export default ProductCard;
