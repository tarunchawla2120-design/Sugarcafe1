import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

import { db } from "../firebase";

function AdminDashboard() {
  // =========================
  // STATES
  // =========================

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  const [categoryName, setCategoryName] = useState("");

  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");

  const [editingId, setEditingId] = useState(null);

  // =========================
  // LOAD CATEGORIES
  // =========================

  const loadCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, "categories"));
console.log(
  "CATEGORY DATA:",
  snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
);
      const data = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data(),
        }))
        // Empty / invalid categories remove
        .filter(
          (item) =>
            item.name &&
            typeof item.name === "string" &&
            item.name.trim() !== ""
        );

      setCategories(data);

      console.log("Categories:", data);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  // =========================
  // LOAD MENU
  // =========================

  const loadMenuItems = async () => {
    try {
      const snapshot = await getDocs(collection(db, "menu"));

      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      setMenuItems(data);

      console.log("Menu:", data);
    } catch (error) {
      console.error("Error loading menu:", error);
    }
  };

  // =========================
  // LOAD DATA
  // =========================

  useEffect(() => {
    loadCategories();
    loadMenuItems();
  }, []);

  // =========================
  // ADD CATEGORY
  // =========================

  const handleAddCategory = async (e) => {
    e.preventDefault();

    if (!categoryName.trim()) {
      alert("Please enter category name");
      return;
    }

    try {
      await addDoc(collection(db, "categories"), {
        name: categoryName.trim(),
        createdAt: Timestamp.now(),
      });

      alert("Category added successfully!");

      setCategoryName("");

      loadCategories();
    } catch (error) {
      console.error("Error adding category:", error);
      alert("Category add nahi hui");
    }
  };

  // =========================
  // ADD / UPDATE MENU ITEM
  // =========================

  const handleSaveMenu = async (e) => {
    e.preventDefault();

    if (!itemName.trim()) {
      alert("Please enter item name");
      return;
    }

    if (!price) {
      alert("Please enter price");
      return;
    }

    if (!category) {
      alert("Please select category");
      return;
    }

    try {
      const menuData = {
        name: itemName.trim(),
        price: Number(price),
        category: category,
        description: description.trim(),
        image: image.trim(),
        updatedAt: Timestamp.now(),
      };

      // UPDATE
      if (editingId) {
        await updateDoc(doc(db, "menu", editingId), menuData);

        alert("Menu item updated!");

        setEditingId(null);
      }

      // ADD
      else {
        await addDoc(collection(db, "menu"), {
          ...menuData,
          createdAt: Timestamp.now(),
        });

        alert("Menu item added!");
      }

      clearForm();
      loadMenuItems();
    } catch (error) {
      console.error("Error saving menu:", error);
      alert("Menu item save nahi hua");
    }
  };

  // =========================
  // EDIT MENU
  // =========================

  const handleEdit = (item) => {
    setEditingId(item.id);

    setItemName(item.name || "");
    setPrice(item.price || "");
    setCategory(item.category || "");
    setDescription(item.description || "");
    setImage(item.image || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================
  // DELETE MENU
  // =========================

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this menu item?"
    );

    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "menu", id));

      alert("Menu item deleted!");

      loadMenuItems();
    } catch (error) {
      console.error("Error deleting menu:", error);
      alert("Delete nahi hua");
    }
  };

  // =========================
  // CLEAR FORM
  // =========================

  const clearForm = () => {
    setItemName("");
    setPrice("");
    setCategory("");
    setDescription("");
    setImage("");
    setEditingId(null);
  };

  // =========================
  // UI
  // =========================

  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "auto" }}>
      <h1>Sugar Cafe Admin Dashboard</h1>

      {/* ================= CATEGORY ================= */}

      <div
        style={{
          border: "1px solid #ddd",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "25px",
          marginBottom: "30px",
        }}
      >
        <h2>Add Category</h2>

        <form onSubmit={handleAddCategory}>
          <input
            type="text"
            placeholder="Category Name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "10px",
            }}
          />

          <button type="submit">Add Category</button>
        </form>

        <h3 style={{ marginTop: "20px" }}>
          Categories ({categories.length})
        </h3>

        {categories.length === 0 ? (
          <p>No categories found.</p>
        ) : (
          <ul>
            {categories.map((item) => (
              <li key={item.id}>
                {item.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ================= MENU FORM ================= */}

      <div
        style={{
          border: "1px solid #ddd",
          padding: "20px",
          borderRadius: "12px",
          marginBottom: "30px",
        }}
      >
        <h2>
          {editingId ? "Edit Menu Item" : "Add Menu Item"}
        </h2>

        <form onSubmit={handleSaveMenu}>
          {/* NAME */}

          <input
            type="text"
            placeholder="Item Name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "10px",
            }}
          />

          {/* PRICE */}

          <input
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "10px",
            }}
          />

          {/* CATEGORY */}

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "10px",
            }}
          >
            <option value="">Select Category</option>

            {categories.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>

          {/* DESCRIPTION */}

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "10px",
              minHeight: "100px",
            }}
          />

          {/* IMAGE URL */}

          <input
            type="text"
            placeholder="Image URL"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "10px",
            }}
          />

          <button type="submit">
            {editingId ? "Update Menu" : "Save Menu"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={clearForm}
              style={{ marginLeft: "10px" }}
            >
              Cancel
            </button>
          )}
        </form>
      </div>

      {/* ================= MENU LIST ================= */}

      <div>
        <h2>Menu Items ({menuItems.length})</h2>

        {menuItems.length === 0 ? (
          <p>No menu items found.</p>
        ) : (
          menuItems.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #ddd",
                padding: "15px",
                borderRadius: "10px",
                marginBottom: "10px",
              }}
            >
              <h3>{item.name}</h3>

              <p>
                <strong>Price:</strong> ₹{item.price}
              </p>

              <p>
                <strong>Category:</strong> {item.category}
              </p>

              <p>{item.description}</p>

              <button onClick={() => handleEdit(item)}>
                Edit
              </button>

              <button
                onClick={() => handleDelete(item.id)}
                style={{ marginLeft: "10px" }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;