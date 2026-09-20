import React, { useState } from "react";
import "../css/menu.css";

function Menu({ searchText = "" }) {
  const [showCategories, setShowCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  const categories = [
    { name: "Pizza", count: 12, image: "/categories/pizza.jpg" },
    { name: "Burger", count: 3, image: "/categories/burger.jpg" },
    { name: "Sandwich", count: 6, image: "/categories/sandwich.jpg" },
    { name: "Pasta", count: 3, image: "/categories/pasta.jpg" },
    { name: "French Fries", count: 3, image: "/categories/fries.jpg" },
    { name: "Shakes", count: 9, emoji: "🥤" },
    { name: "Beverages", count: 4, image: "/categories/beverage.jpg" },
    { name: "Dessert", count: 4, emoji: "🍰" },
    { name: "Maggie", count: 4, emoji: "🍜" },
  ];

  /* =========================
     NAVBAR SEARCH
  ========================= */

  const navbarSearch = searchText.trim().toLowerCase();

  const searchedCategories = navbarSearch
    ? categories.filter((item) =>
        item.name.toLowerCase().includes(navbarSearch)
      )
    : categories;

  /* =========================
     CATEGORY MODAL SEARCH
  ========================= */

  const modalSearch = categorySearch.trim().toLowerCase();

  const filteredCategories = modalSearch
    ? categories.filter((item) =>
        item.name.toLowerCase().includes(modalSearch)
      )
    : searchedCategories;

  return (
    <section className="menu-section">

      {/* =========================
          TITLE
      ========================= */}

      <div className="menu-title-row">
        <div>
          <h2>Popular Items</h2>

          {navbarSearch && (
            <p className="search-result-text">
              Search results for "{searchText}"
            </p>
          )}
        </div>

        <button
          className="view-all-btn"
          onClick={() => setShowCategories(true)}
        >
          View All
        </button>
      </div>


      {/* =========================
          NAVBAR SEARCH RESULTS
      ========================= */}

      {navbarSearch && (

        <div className="search-category-results">

          {searchedCategories.length > 0 ? (

            searchedCategories.map((item) => (

              <button
                className="search-category-card"
                key={item.name}
                onClick={() => setShowCategories(true)}
              >

                <div className="search-category-image">

                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                    />
                  ) : (
                    <span>{item.emoji}</span>
                  )}

                </div>

                <div className="search-category-info">

                  <strong>
                    {item.name}
                  </strong>

                  <span>
                    {item.count} Items
                  </span>

                </div>

                <div className="search-category-arrow">
                  ›
                </div>

              </button>

            ))

          ) : (

            <div className="no-search-results">

              <div className="no-search-icon">
                🔍
              </div>

              <h3>
                No items found
              </h3>

              <p>
                Try searching for pizza, burger, pasta,
                shakes or another item.
              </p>

            </div>

          )}

        </div>

      )}


      {/* =========================
          CATEGORY MODAL
      ========================= */}

      {showCategories && (

        <div
          className="category-overlay"
          onClick={() => setShowCategories(false)}
        >

          <div
            className="category-modal"
            onClick={(e) => e.stopPropagation()}
          >

            {/* SugarCafe Logo */}

            <img
              className="sugar-logo"
              src="/cafe.jpeg"
              alt="SugarCafe"
            />


            {/* Faint Background Logo */}

            <img
              className="sugar-watermark"
              src="/cafe.jpeg"
              alt=""
            />


            {/* Header */}

            <div className="category-header">

              <div>

                <h2>
                  All <span>Categories</span>
                </h2>

                <p>
                  Explore your favourite flavours ❤️
                </p>

              </div>

            </div>


            {/* =========================
                CATEGORY SEARCH
            ========================= */}

            <div className="category-search">

              <span>
                🔍
              </span>

              <input
                type="text"
                placeholder="Search Category..."
                value={categorySearch}
                onChange={(e) =>
                  setCategorySearch(e.target.value)
                }
              />

              {categorySearch && (

                <button
                  className="category-search-clear"
                  onClick={() =>
                    setCategorySearch("")
                  }
                >
                  ×
                </button>

              )}

            </div>


            {/* =========================
                CATEGORY LIST
            ========================= */}

            <div className="category-list">

              {filteredCategories.length > 0 ? (

                filteredCategories.map((item, index) => (

                  <button
                    className="category-row"
                    key={item.name}
                  >

                    {/* Food Image */}

                    <div className="category-image">

                      {item.image ? (

                        <img
                          src={item.image}
                          alt={item.name}
                        />

                      ) : (

                        <span>
                          {item.emoji}
                        </span>

                      )}

                    </div>


                    {/* Number */}

                    <div className="category-number">
                      {index + 1}
                    </div>


                    {/* Name */}

                    <div className="category-name">
                      {item.name}
                    </div>


                    {/* Count */}

                    <div className="category-count">

                      {item.count}

                      <span>
                        Items
                      </span>

                    </div>


                    {/* Arrow */}

                    <div className="category-arrow">
                      ›
                    </div>

                  </button>

                ))

              ) : (

                <div className="category-no-results">

                  <div>
                    🔍
                  </div>

                  <h3>
                    No category found
                  </h3>

                  <p>
                    Try another category name.
                  </p>

                </div>

              )}

            </div>


            {/* Close */}

            <button
              className="category-close"
              onClick={() => {
                setShowCategories(false);
                setCategorySearch("");
              }}
            >

              <span>
                ×
              </span>

              Close

            </button>

          </div>

        </div>

      )}

    </section>
  );
}

export default Menu;