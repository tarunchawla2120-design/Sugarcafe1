import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import ProductCard from "../components/ProductCard";
import BottomNav from "../components/BottomNav";
import "../css/menu.css";

function Menu() {
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
     FIRESTORE MENU
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
     CATEGORY COUNT
  ===================================================== */

  const getCategoryCount = (categoryName) => {
    const target = categoryName
      .trim()
      .toLowerCase();

    return products.filter((product) => {
      const productCategory = String(
        product.category || ""
      )
        .trim()
        .toLowerCase();

      return productCategory === target;
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

    window.setTimeout(() => {
      document
        .getElementById("menu-flavours")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  };

  /* =====================================================
     ALL CATEGORIES
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

      <div className="menu-title-row">

        <div>
          <h2>
            {selectedCategory === "All"
              ? "All Categories"
              : selectedCategory}
          </h2>

          <p>
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

      <div className="menu-search-wrapper">

        <div className="menu-search-box">

          <span className="menu-search-icon">
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
          />

          {search && (
            <button
              type="button"
              className="menu-search-clear"
              onClick={() => setSearch("")}
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

        <div className="category-list">

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
                >

                  {/* IMAGE */}

                  <div className="category-image">

                    <img
                      src={category.image}
                      alt={category.name}
                      onError={(e) => {
                        e.currentTarget.style.display =
                          "none";
                      }}
                    />

                  </div>


                  {/* NUMBER */}

                  <div className="category-number">
                    {String(index + 1).padStart(
                      2,
                      "0"
                    )}
                  </div>


                  {/* NAME */}

                  <div className="category-name">
                    {category.name}
                  </div>


                  {/* COUNT */}

                  <div className="category-count">
                    <strong>
                      {count}
                    </strong>

                    <span>
                      Items
                    </span>
                  </div>


                  {/* ARROW */}

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
          className="menu-flavours"
        >

          {/* HEADER */}

          <div className="flavours-header">

            <div>
              <h2>
                {selectedCategory}
              </h2>

              <p>
                {filteredProducts.length}{" "}
                flavours available
              </p>
            </div>

            <button
              type="button"
              className="back-category-btn"
              onClick={showAllCategories}
            >
              ← Categories
            </button>

          </div>


          {/* PRODUCTS */}

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

            <div className="empty-state">

              <div className="empty-icon">
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
                className="browse-category-btn"
                onClick={showAllCategories}
              >
                Browse Categories
              </button>

            </div>

          )}

        </section>

      )}


      {/* =================================================
          BOTTOM NAVIGATION
      ================================================= */}

      <BottomNav />

    </section>
  );
}

export default Menu;
