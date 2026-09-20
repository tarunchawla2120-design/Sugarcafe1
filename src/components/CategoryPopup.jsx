import React, { useState } from "react";
import "./CategoryPopup.css";

const categories = [
  {
    name: "Pizza",
    count: 12,
    image: "/categories/pizza.jpg",
  },
  {
    name: "Burger",
    count: 3,
    image: "/categories/burger.jpg",
  },
  {
    name: "Sandwich",
    count: 6,
    image: "/categories/sandwich.jpg",
  },
  {
    name: "Pasta",
    count: 3,
    image: "/categories/pasta.jpg",
  },
  {
    name: "French Fries",
    count: 3,
    image: "/categories/fries.jpg",
  },
  {
    name: "Shakes",
    count: 9,
    image: "/categories/shakes.jpg",
  },
  {
    name: "Cheese Puff",
    count: 0,
    image: "/categories/cheese-puff.jpg",
  },
  {
    name: "Beverages",
    count: 4,
    image: "/categories/beverage.jpg",
  },
  {
    name: "Dessert",
    count: 4,
    image: "/categories/dessert.jpg",
  },
  {
    name: "Maggie",
    count: 4,
    image: "/categories/maggie.jpg",
  },
];

function CategoryPopup({
  open,
  onClose,
  setSelectedCategory,
}) {
  const [search, setSearch] = useState("");

  if (!open) return null;

  const filteredCategories = categories.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="category-overlay" onClick={onClose}>
      <div
        className="category-popup"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Background Logo */}
        <img
          src="/cafe.jpeg"
          alt=""
          className="category-watermark"
        />

        {/* Header */}
        <div className="category-popup-header">

          <div className="category-heading">

            <span className="heading-small">
              SUGARCAFE
            </span>

            <h2>
              Explore <span>Categories</span>
            </h2>

            <p>
              Find something delicious for you
            </p>

          </div>

          <button
            className="top-close"
            onClick={onClose}
          >
            ×
          </button>

        </div>

        {/* Search */}
        <div className="category-search-box">

          <span className="search-icon">
            ⌕
          </span>

          <input
            type="text"
            placeholder="Search your favourite category..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          {search && (
            <button
              className="clear-search"
              onClick={() => setSearch("")}
            >
              ×
            </button>
          )}

        </div>

        {/* Categories */}
        <div className="category-scroll">

          {filteredCategories.map((category, index) => (

            <button
              className="category-card"
              key={category.name}
              onClick={() => {
                setSelectedCategory(category.name);
                setSearch("");
                onClose();
              }}
            >

              {/* Number */}
              <div className="category-index">
                {String(index + 1).padStart(2, "0")}
              </div>

              {/* REAL FOOD IMAGE */}
              <div className="category-food-image">
                <img
                  src={category.image}
                  alt={category.name}
                />
              </div>

              {/* Name */}
              <div className="category-info">
                <h3>
                  {category.name}
                </h3>

                <p>
                  Freshly prepared
                </p>
              </div>

              {/* Count */}
              <div className="category-items">

                {category.count > 0 ? (
                  <>
                    <strong>
                      {category.count}
                    </strong>

                    <span>
                      Items
                    </span>
                  </>
                ) : (
                  <span>
                    Menu
                  </span>
                )}

              </div>

              {/* Arrow */}
              <div className="category-next">
                ›
              </div>

            </button>

          ))}

        </div>

        {/* Footer */}
        <div className="category-footer">

          <div className="footer-brand">

            <img
              src="/cafe.jpeg"
              alt="SugarCafe"
            />

            <span>
              Good Food • Good Mood
            </span>

          </div>

          <button
            className="footer-close"
            onClick={onClose}
          >
            <span>×</span>
            Close
          </button>

        </div>

      </div>
    </div>
  );
}

export default CategoryPopup;