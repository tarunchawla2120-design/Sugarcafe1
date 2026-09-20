import React from "react";
import "./Categories.css";

const categories = [
  { name: "All", image: "/categories/all.jpg" },
  { name: "Pizza", image: "/categories/pizza.jpg" },
  { name: "Burger", image: "/categories/burger.jpg" },
  { name: "Sandwich", image: "/categories/sandwich.jpg" },

  { name: "Wrap Roll", image: "/categories/wraproll.jpg" },
  { name: "Pasta", image: "/categories/pasta.jpg" },
  { name: "Fries", image: "/categories/fries.jpg" },
  { name: "Beverage", image: "/categories/beverage.jpg" },

  { name: "Dessert", image: "/categories/dessert.jpg" },
  { name: "Maggie", image: "/categories/maggie.jpg" },
  { name: "Shakes", image: "/categories/shakes.jpg" },
];

function Categories({
  selectedCategory,
  setSelectedCategory,
}) {
  return (
    <section className="explore-menu">

      <h2 className="section-title">
        What are you craving for?
      </h2>

      <div className="menu-grid">

        {categories.map((item) => (
          <div
            key={item.name}
            className={`menu-item ${
              selectedCategory === item.name
                ? "active"
                : ""
            }`}
            onClick={() =>
              setSelectedCategory(item.name)
            }
          >

            <div className="menu-image">
              <img
                src={item.image}
                alt={item.name}
              />
            </div>

            <p>{item.name}</p>

          </div>
        ))}

      </div>

    </section>
  );
}

export default Categories;