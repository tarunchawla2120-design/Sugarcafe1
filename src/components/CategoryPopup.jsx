import React, { useState } from "react";
import "./CategoryPopup.css";

/* =========================================================
   SUGAR CAFE — CATEGORY POPUP

   IMPORTANT:
   Display name "French Fries"
   Firebase category value "Fries"

   This keeps the UI name as French Fries while matching
   the existing Firebase menu category "Fries".
========================================================= */

const categories = [
  {
    name: "Pizza",
    count: 12,
    image: "/categories/pizza.jpg",
    value: "Pizza",
  },
  {
    name: "Burger",
    count: 3,
    image: "/categories/burger.jpg",
    value: "Burger",
  },
  {
    name: "Sandwich",
    count: 6,
    image: "/categories/sandwich.jpg",
    value: "Sandwich",
  },
  {
    name: "Pasta",
    count: 3,
    image: "/categories/pasta.jpg",
    value: "Pasta",
  },
  {
    name: "French Fries",
    count: 3,
    image: "/categories/fries.jpg",
    value: "Fries",
  },
  {
    name: "Shakes",
    count: 9,
    image: "/categories/shakes.jpg",
    value: "Shakes",
  },
  {
    name: "Cheese Puff",
    count: 0,
    image: "/categories/cheese-puff.jpg",
    value: "Cheese Puff",
  },
  {
    name: "Beverages",
    count: 4,
    image: "/categories/beverage.jpg",
    value: "Beverage",
  },
  {
    name: "Dessert",
    count: 4,
    image: "/categories/dessert.jpg",
    value: "Dessert",
  },
  {
    name: "Maggie",
    count: 4,
    image: "/categories/maggie.jpg",
    value: "Maggie",
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
    item.name
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div
      className="category-overlay"
      onClick={onClose}
    >
      <div
        className="category-popup"
        onClick={(e) => e.stopPropagation()}
      >

        {/* =================================================
            BACKGROUND LOGO
        ================================================= */}

        <img
          src="/cafe.jpeg"
          alt=""
          className="category-watermark"
        />

        {/* =================================================
            HEADER
        ================================================= */}

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
            type="button"
          >
            ×
          </button>

        </div>

        {/* =================================================
            SEARCH
        ================================================= */}

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
              type="button"
              aria-label="Clear search"
            >
              ×
            </button>
          )}

        </div>

        {/* =================================================
            CATEGORIES
        ================================================= */}

        <div className="category-scroll">

          {filteredCategories.map(
            (category, index) => (

              <button
                className="category-card"
                key={category.name}
                type="button"

                /* =========================================
                   IMPORTANT FIX

                   UI:
                   French Fries

                   Firebase:
                   Fries

                   So PopularItems.jsx can correctly
                   match the Firebase menu products.
                ========================================= */

                onClick={() => {
                  setSelectedCategory(
                    category.value
                  );

                  setSearch("");

                  onClose();
                }}
              >

                {/* NUMBER */}

                <div className="category-index">
                  {String(index + 1).padStart(
                    2,
                    "0"
                  )}
                </div>

                {/* FOOD IMAGE */}

                <div className="category-food-image">

                  <img
                    src={category.image}
                    alt={category.name}
                  />

                </div>

                {/* CATEGORY NAME */}

                <div className="category-info">

                  <h3>
                    {category.name}
                  </h3>

                  <p>
                    Freshly prepared
                  </p>

                </div>

                {/* ITEM COUNT */}

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

                {/* ARROW */}

                <div className="category-next">
                  ›
                </div>

              </button>

            )
          )}

          {/* NO RESULT */}

          {filteredCategories.length === 0 && (
            <div className="category-empty">
              <h3>
                No category found 😔
              </h3>

              <p>
                Try another search.
              </p>
            </div>
          )}

        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

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
            type="button"
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
