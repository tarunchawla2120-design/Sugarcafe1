import { useCart } from "../context/CartContext";
import React from "react";
import "./ProductCard.css";
import { FaStar, FaHeart, FaPlus } from "react-icons/fa";
import { useStoreSettings } from "../context/StoreContext";

function ProductCard({ product }) {
  const { addToCart } = useCart();
  const store = useStoreSettings();
  const available = product.available !== false && store.isOpen && store.acceptingOrders;

  if (!product) return null;

  // Only these products will show Bestseller
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

  // Different fixed ratings for different products
  const getRating = (name = "") => {
    const ratings = [4.5, 4.6, 4.7, 4.8, 4.9];

    let total = 0;

    for (let i = 0; i < name.length; i++) {
      total += name.charCodeAt(i);
    }

    return ratings[total % ratings.length];
  };

  const rating = product.rating || getRating(product.name);

  return (
    <div className={`product-card ${!available ? "product-unavailable" : ""}`}>

      {/* Product Image */}
      <div className="product-image-box">

        <img
          src={product.image || "/food-placeholder.jpg"}
          alt={product.name}
          className="product-image"
        />

        {/* Bestseller */}
        {!available && <span className="product-badge">{store.isOpen ? "⏸ Unavailable" : "🔒 Closed"}</span>}
        {isBestseller && available && (
          <span className="product-badge">
            ⭐ Bestseller
          </span>
        )}

        {/* Wishlist */}
        <button className="wishlist-btn">
          <FaHeart />
        </button>

      </div>

      {/* Product Information */}
      <div className="product-info">

        <div className="product-title">

          <h3>{product.name}</h3>

          <div className="rating">
            <FaStar />
            <span>{rating}</span>
          </div>

        </div>

        <p>
          {product.description || "Delicious and freshly prepared."}
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

          <button
            className="add-btn"
            disabled={!available}
            onClick={() => available && addToCart(product)}
          >
            <FaPlus />
            <span>{available ? "Add" : "Unavailable"}</span>
          </button>

        </div>

      </div>

    </div>
  );
}

export default ProductCard;