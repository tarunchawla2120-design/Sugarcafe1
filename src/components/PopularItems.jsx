import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

import ProductCard from "./ProductCard";
import "./PopularItems.css";

function PopularItems({ search, selectedCategory }) {
  const [products, setProducts] = useState([]);

  // =========================================================
  // LOAD MENU FROM FIRESTORE
  // =========================================================

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

  // =========================================================
  // NORMALIZE CATEGORY
  // =========================================================

  const normalizeCategory = (category) => {
    const value = (category || "")
      .trim()
      .toLowerCase();

    // Fries / French Fries
    if (
      value === "fries" ||
      value === "french fries"
    ) {
      return "fries";
    }

    // Shake / Shakes
    if (
      value === "shake" ||
      value === "shakes"
    ) {
      return "shakes";
    }

    // Beverage / Beverages
    if (
      value === "beverage" ||
      value === "beverages"
    ) {
      return "beverages";
    }

    // Dessert / Desserts
    if (
      value === "dessert" ||
      value === "desserts"
    ) {
      return "desserts";
    }

    // Maggie / Maggi
    if (
      value === "maggie" ||
      value === "maggi"
    ) {
      return "maggie";
    }

    return value;
  };

  // =========================================================
  // FILTER PRODUCTS
  // =========================================================

  const filteredProducts = products.filter((product) => {
    const productCategory = normalizeCategory(
      product.category
    );

    const currentCategory = normalizeCategory(
      selectedCategory
    );

    const categoryMatch =
      currentCategory === "all" ||
      productCategory === currentCategory;

    const searchMatch = (
      product.name || ""
    )
      .toLowerCase()
      .includes(
        (search || "").toLowerCase()
      );

    return categoryMatch && searchMatch;
  });

  // =========================================================
  // UI
  // =========================================================

  return (
    <section className="popular-items">

      <div className="section-header">

        <h2>
          Popular Items
        </h2>

        <button className="see-all-btn">
          View All
        </button>

      </div>

      <div className="products-grid">

        {filteredProducts.length > 0 ? (

          filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))

        ) : (

          <div className="empty-state">

            <h3>
              No items found 😔
            </h3>

            <p>
              Add items from Admin Dashboard.
            </p>

          </div>

        )}

      </div>

    </section>
  );
}

export default PopularItems;
