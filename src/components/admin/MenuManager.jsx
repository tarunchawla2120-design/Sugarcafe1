import { useEffect, useState } from "react";

import {
  collection,
  getDocs,
  deleteDoc,
  addDoc,
  updateDoc,
  Timestamp,
  doc,
} from "firebase/firestore";

import { db } from "../../firebase";

import MenuTable from "./MenuTable";
import AddMenuModal from "./AddMenuModal";

function MenuManager({ showModal, setShowModal }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");

  // =========================
  // DEFAULT CATEGORIES
  // =========================

  const defaultCategories = [
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
      name: "Wrap Roll",
      image: "/categories/wraproll.jpg",
    },
    {
      name: "Pasta",
      image: "/categories/pasta.jpg",
    },
    {
      name: "Fries",
      image: "/categories/fries.jpg",
    },
    {
      name: "Shakes",
      image: "/categories/shakes.jpg",
    },
    {
      name: "Cheese Puff",
      image: "/categories/cheesepuff.jpg",
    },
    {
      name: "Maggie",
      image: "/categories/maggie.jpg",
    },
    {
      name: "Dessert",
      image: "/categories/dessert.jpg",
    },
    {
      name: "Beverage",
      image: "/categories/beverage.jpg",
    },
  ];

  // =========================
  // LOAD PRODUCTS
  // =========================

  const loadProducts = async () => {
    try {
      const snap = await getDocs(collection(db, "menu"));

      const data = snap.docs.map((menuDoc) => ({
        id: menuDoc.id,
        ...menuDoc.data(),
      }));

      console.log("MENU DATA:", data);

      setProducts(data);
    } catch (error) {
      console.error("MENU LOAD ERROR:", error);
    }
  };

  // =========================
  // LOAD + CREATE CATEGORIES
  // =========================

  const loadCategories = async () => {
    try {
      const categoryRef = collection(db, "categories");

      const snap = await getDocs(categoryRef);

      const existingCategories = snap.docs.map((categoryDoc) => ({
        id: categoryDoc.id,
        ...categoryDoc.data(),
      }));

      console.log(
        "EXISTING CATEGORIES:",
        existingCategories
      );

      // Create missing categories
      for (const defaultCategory of defaultCategories) {
        const exists = existingCategories.some(
          (cat) =>
            (
              cat.name ||
              cat.category ||
              cat.title ||
              ""
            )
              .toLowerCase()
              .trim() ===
            defaultCategory.name.toLowerCase()
        );

        if (!exists) {
          await addDoc(categoryRef, {
            name: defaultCategory.name,
            image: defaultCategory.image,
            createdAt: Timestamp.now(),
          });

          console.log(
            "CATEGORY CREATED:",
            defaultCategory.name
          );
        }
      }

      // Load again after creating missing categories
      const updatedSnap = await getDocs(categoryRef);

      const data = updatedSnap.docs
        .map((categoryDoc) => {
          const categoryData = categoryDoc.data();

          return {
            id: categoryDoc.id,
            name:
              categoryData.name ||
              categoryData.category ||
              categoryData.title ||
              "",
            image: categoryData.image || "",
          };
        })
        .filter(
          (cat) =>
            cat.name &&
            cat.name.trim() !== ""
        );

      console.log("ALL CATEGORIES:", data);

      setCategories(data);
    } catch (error) {
      console.error(
        "CATEGORY LOAD ERROR:",
        error
      );
    }
  };

  // =========================
  // TOGGLE MENU AVAILABILITY
  // =========================

  const toggleAvailability = async (id, available) => {
    if (!id) {
      console.error(
        "Availability update failed: No menu ID"
      );
      return;
    }

    try {
      // Current status:
      // true  = ON
      // false = OFF
      //
      // Toggle it:
      // ON  -> OFF
      // OFF -> ON

      const newAvailability = !available;

      console.log(
        "Updating menu availability:",
        id,
        "Old:",
        available,
        "New:",
        newAvailability
      );

      await updateDoc(
        doc(db, "menu", id),
        {
          available: newAvailability,
          updatedAt: Timestamp.now(),
        }
      );

      // Update UI immediately
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === id
            ? {
                ...product,
                available: newAvailability,
              }
            : product
        )
      );

      console.log(
        "MENU AVAILABILITY UPDATED:",
        newAvailability
      );
    } catch (error) {
      console.error(
        "MENU AVAILABILITY UPDATE ERROR:",
        error
      );

      alert(
        "Menu availability update nahi hua. Please try again."
      );

      // Reload from Firestore in case update failed
      loadProducts();
    }
  };

  // =========================
  // DELETE ITEM
  // =========================

  const deleteItem = async (id) => {
    try {
      if (!id) {
        console.error(
          "Delete failed: No item ID"
        );
        return;
      }

      const confirmDelete = window.confirm(
        "Are you sure you want to delete this menu item?"
      );

      if (!confirmDelete) {
        return;
      }

      await deleteDoc(
        doc(db, "menu", id)
      );

      alert(
        "Menu Item Deleted Successfully"
      );

      loadProducts();
    } catch (error) {
      console.error(
        "DELETE ERROR:",
        error
      );

      alert(
        "Failed to delete menu item"
      );
    }
  };

  // =========================
  // SAVE / UPDATE ITEM
  // =========================

  const saveItem = async () => {
    try {
      if (
        !itemName ||
        !price ||
        !category
      ) {
        alert(
          "Please fill all required fields"
        );
        return;
      }

      if (editingId) {
        await updateDoc(
          doc(db, "menu", editingId),
          {
            name: itemName.trim(),
            price: Number(price),
            category: category.trim(),
            description:
              description.trim(),
            image: image,
            updatedAt: Timestamp.now(),
          }
        );

        alert(
          "Menu Item Updated Successfully"
        );
      } else {
        await addDoc(
          collection(db, "menu"),
          {
            name: itemName.trim(),
            price: Number(price),
            category: category.trim(),
            description:
              description.trim(),
            image: image,

            // New menu items ON by default
            available: true,

            createdAt:
              Timestamp.now(),
            updatedAt:
              Timestamp.now(),
          }
        );

        alert(
          "Menu Item Added Successfully"
        );
      }

      // Reset form
      setEditingId(null);
      setItemName("");
      setPrice("");
      setCategory("");
      setDescription("");
      setImage("");

      setShowModal(false);

      loadProducts();
    } catch (error) {
      console.error(
        "SAVE ERROR:",
        error
      );

      alert(
        "Failed to save item"
      );
    }
  };

  // =========================
  // INITIAL LOAD
  // =========================

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  // =========================
  // UI
  // =========================

  return (
    <>
      <MenuTable
        products={products}
        onDelete={deleteItem}

        // IMPORTANT:
        // This connects the ON/OFF button
        // inside MenuTable to Firestore.
        onToggleAvailability={
          toggleAvailability
        }

        onEdit={(item) => {
          setEditingId(item.id);

          setItemName(
            item.name || ""
          );

          setPrice(
            item.price || ""
          );

          setCategory(
            item.category || ""
          );

          setDescription(
            item.description || ""
          );

          setImage(
            item.image || ""
          );

          setShowModal(true);
        }}
      />

      <AddMenuModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingId(null);
        }}
        onSave={saveItem}
        itemName={itemName}
        setItemName={setItemName}
        price={price}
        setPrice={setPrice}
        category={category}
        setCategory={setCategory}
        description={description}
        setDescription={setDescription}
        image={image}
        setImage={setImage}
        categories={categories}
        editingId={editingId}
      />
    </>
  );
}

export default MenuManager;
