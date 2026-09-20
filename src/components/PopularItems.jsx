import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

import ProductCard from "./ProductCard";
import "./PopularItems.css";

function PopularItems({ search, selectedCategory }) {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "menu"), (snapshot) => {
      const list = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }));
      setProducts(list);
    }, (error) => console.error("Menu listener error:", error));
    return unsubscribe;
  }, []);

  const filteredProducts = products.filter((product) => {
    const productCategory = (product.category || "").trim().toLowerCase();
    const currentCategory = (selectedCategory || "").trim().toLowerCase();

    const categoryMatch =
      currentCategory === "all" ||
      productCategory === currentCategory;

    const searchMatch =
      (product.name || "")
        .toLowerCase()
        .includes((search || "").toLowerCase());

    return categoryMatch && searchMatch;
  });

  return (
    <section className="popular-items">
      <div className="section-header">
        <h2>Popular Items</h2>
        <button className="see-all-btn">View All</button>
      </div>

      <div className="products-grid">
        {filteredProducts.length ? (
          filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <div className="empty-state">
            <h3>No items found 😔</h3>
            <p>Add items from Admin Dashboard.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default PopularItems;