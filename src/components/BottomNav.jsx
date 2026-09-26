import "./BottomNav.css";
import {
  FaHome,
  FaUtensils,
  FaShoppingCart,
  FaUser,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();

  const isHome =
    location.pathname === "/" ||
    location.pathname === "/home";

  const isMenu =
    location.pathname === "/menu";

  const isCart =
    location.pathname === "/cart";

  const isProfile =
    location.pathname === "/profile";

  return (
    <nav className="bottom-nav">

      {/* HOME */}
      <div
        className={`nav-item ${isHome ? "active" : ""}`}
        onClick={() => navigate("/")}
        style={{ cursor: "pointer" }}
      >
        <FaHome />
        <span>Home</span>
      </div>

      {/* MENU */}
      <div
        className={`nav-item ${isMenu ? "active" : ""}`}
        onClick={() => navigate("/menu")}
        style={{ cursor: "pointer" }}
      >
        <FaUtensils />
        <span>Menu</span>
      </div>

      {/* CART */}
      <div
        className={`nav-item ${isCart ? "active" : ""}`}
        style={{
          position: "relative",
          cursor: "pointer",
        }}
        onClick={() => navigate("/cart")}
      >
        <FaShoppingCart />

        {totalItems > 0 && (
          <span className="cart-badge">
            {totalItems}
          </span>
        )}

        <span>Cart</span>
      </div>

      {/* PROFILE */}
      <div
        className={`nav-item ${isProfile ? "active" : ""}`}
        onClick={() => navigate("/profile")}
        style={{ cursor: "pointer" }}
      >
        <FaUser />
        <span>Profile</span>
      </div>

    </nav>
  );
}

export default BottomNav;
