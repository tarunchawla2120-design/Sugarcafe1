import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import "../css/menu.css";

function Menu() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");

  const categories = [
    {
      name: "Pizza",
      image: "/categories/pizza.jpg",
    },
    {
      name: "Burger",
      image: "/categories/burger.jpg",
    },
    {
      name: "Sandwich",
      image: "/categories/sandwich.jpg",
    },
    {
      name: "Pasta",
      image: "/categories/pasta.jpg",
    },
    {
      name: "French Fries",
      image: "/categories/fries.jpg",
    },
    {
      name: "Shakes",
      image: "/categories/shakes.jpg",
    },
    {
      name: "Cheese Puff",
      image: "/categories/cheese-puff.jpg",
    },
    {
      name: "Beverages",
      image: "/categories/beverage.jpg",
    },
    {
      name: "Dessert",
      image: "/categories/dessert.jpg",
    },
    {
      name: "Maggie",
      image: "/categories/maggie.jpg",
    },
  ];

  /* =====================================================
     LOAD MENU FROM FIRESTORE
  ===================================================== */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "menu"),
      (snapshot) => {
        const list = snapshot.docs.map((itemDoc) => ({
          id: itemDoc.id,
          ...itemDoc.data(),
        }));

        setProducts(list);
      },
      (error) => {
        console.error("Menu listener error:", error);
      }
    );

    return unsubscribe;
  }, []);

  /* =====================================================
     CATEGORY COUNTS
  ===================================================== */

  const getCategoryCount = (categoryName) => {
    return products.filter((product) => {
      const productCategory = String(
        product.category || ""
      )
        .trim()
        .toLowerCase();

      return (
        productCategory ===
        categoryName.trim().toLowerCase()
      );
    }).length;
  };

  /* =====================================================
     FILTER PRODUCTS
  ===================================================== */

  const filteredProducts = useMemo(() => {
    const currentCategory =
      selectedCategory.trim().toLowerCase();

    const currentSearch =
      search.trim().toLowerCase();

    return products.filter((product) => {
      const productCategory = String(
        product.category || ""
      )
        .trim()
        .toLowerCase();

      const productName = String(
        product.name || ""
      ).toLowerCase();

      const categoryMatch =
        currentCategory === "all" ||
        productCategory === currentCategory;

      const searchMatch =
        !currentSearch ||
        productName.includes(currentSearch);

      return categoryMatch && searchMatch;
    });
  }, [
    products,
    selectedCategory,
    search,
  ]);

  /* =====================================================
     CATEGORY CLICK
  ===================================================== */

  const handleCategoryClick = (categoryName) => {
    setSelectedCategory(categoryName);
    setSearch("");

    // Smoothly move to flavour section
    setTimeout(() => {
      document
        .getElementById("menu-flavours")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  };

  /* =====================================================
     BACK TO ALL CATEGORIES
  ===================================================== */

  const showAllCategories = () => {
    setSelectedCategory("All");
    setSearch("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <section className="menu-section">

      {/* =================================================
          HEADER
      ================================================= */}

      <div
        className="menu-title-row"
        style={{
          paddingTop: 20,
        }}
      >
        <div>
          <h2>
            {selectedCategory === "All"
              ? "All Categories"
              : selectedCategory}
          </h2>

          <p
            style={{
              marginTop: 5,
              color: "#777",
              fontSize: 13,
            }}
          >
            {selectedCategory === "All"
              ? "Explore your favourite flavours ❤️"
              : `Choose from our ${selectedCategory} flavours`}
          </p>
        </div>

        {selectedCategory !== "All" && (
          <button
            type="button"
            className="view-all-btn"
            onClick={showAllCategories}
          >
            All Categories
          </button>
        )}
      </div>

      {/* =================================================
          SEARCH
      ================================================= */}

      <div
        style={{
          padding: "0 16px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#f7f7f7",
            border: "1px solid #eee",
            borderRadius: 14,
            padding: "11px 14px",
          }}
        >
          <span style={{ fontSize: 18 }}>
            🔍
          </span>

          <input
            type="text"
            placeholder={
              selectedCategory === "All"
                ? "Search food..."
                : `Search ${selectedCategory}...`
            }
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={{
              width: "100%",
              border: 0,
              outline: "none",
              background: "transparent",
              fontSize: 14,
            }}
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{
                border: 0,
                background: "transparent",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* =================================================
          ALL CATEGORIES
      ================================================= */}

      {selectedCategory === "All" && (
        <div
          className="category-list"
          style={{
            padding: "0 14px 20px",
          }}
        >
          {categories.map(
            (category, index) => {
              const count =
                getCategoryCount(
                  category.name
                );

              return (
                <button
                  key={category.name}
                  type="button"
                  className="category-row"
                  onClick={() =>
                    handleCategoryClick(
                      category.name
                    )
                  }
                  style={{
                    width: "100%",
                    cursor:
                      count > 0
                        ? "pointer"
                        : "default",
                  }}
                >

                  {/* Image */}

                  <div className="category-image">
                    <img
                      src={category.image}
                      alt={category.name}
                    />
                  </div>

                  {/* Number */}

                  <div className="category-number">
                    {String(index + 1).padStart(
                      2,
                      "0"
                    )}
                  </div>

                  {/* Name */}

                  <div className="category-name">
                    {category.name}
                  </div>

                  {/* Count */}

                  <div className="category-count">
                    <strong>
                      {count}
                    </strong>

                    <span>
                      Items
                    </span>
                  </div>

                  {/* Arrow */}

                  <div className="category-arrow">
                    ›
                  </div>

                </button>
              );
            }
          )}
        </div>
      )}

      {/* =================================================
          FLAVOURS / PRODUCTS
      ================================================= */}

      {selectedCategory !== "All" && (
        <section
          id="menu-flavours"
          style={{
            padding: "0 14px 100px",
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 21,
                  fontWeight: 900,
                }}
              >
                {selectedCategory}
              </h2>

              <p
                style={{
                  margin: "4px 0 0",
                  color: "#777",
                  fontSize: 12,
                }}
              >
                {filteredProducts.length}{" "}
                flavours available
              </p>
            </div>

            <button
              type="button"
              onClick={showAllCategories}
              style={{
                border: "1px solid #eee",
                background: "#fff",
                borderRadius: 10,
                padding: "8px 11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ← Categories
            </button>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="products-grid">
              {filteredProducts.map(
                (product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                )
              )}
            </div>
          ) : (
            <div
              className="empty-state"
              style={{
                textAlign: "center",
                padding: "50px 20px",
              }}
            >
              <div
                style={{
                  fontSize: 45,
                  marginBottom: 10,
                }}
              >
                🍽️
              </div>

              <h3>
                No {selectedCategory} items found
              </h3>

              <p>
                This category doesn't have
                available items right now.
              </p>

              <button
                type="button"
                onClick={showAllCategories}
                style={{
                  marginTop: 12,
                  border: 0,
                  borderRadius: 12,
                  padding: "11px 18px",
                  background: "#f97316",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Browse Categories
              </button>
            </div>
          )}

        </section>
      )}

    </section>
  );
}

export default Menu;
