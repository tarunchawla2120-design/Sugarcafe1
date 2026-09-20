import React from "react";
import { Link } from "react-router-dom";
import { FaCog } from "react-icons/fa";


function AdminButton() {
  const isAdmin =
    localStorage.getItem("adminLoggedIn") === "true";

  // Customer ke liye kuch bhi render nahi hoga
  if (!isAdmin) {
    return null;
  }

  return (
    <Link
      to="/dashboard"
      className="admin-btn"
      title="Admin Dashboard"
    >
      <FaCog />
    </Link>
  );
}

export default AdminButton;