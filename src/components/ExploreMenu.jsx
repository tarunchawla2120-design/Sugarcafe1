import React from "react";
import "./ExploreMenu.css";
import menuData from "../data/menuData";
import ProductCard from "./ProductCard";

function ExploreMenu() {
  return (
    <section className="explore-menu" id="menu">
      <div className="container">
        <div className="menu-heading">
          <h2>Explore Our Menu</h2>
          <p>Freshly prepared with love ❤️</p>
        </div>

        <div className="menu-grid">
          {menuData.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ExploreMenu;