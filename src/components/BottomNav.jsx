import "./BottomNav.css";
import { FaHome, FaUtensils, FaShoppingCart, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

function BottomNav({ onMenuClick }) {
  const navigate = useNavigate();
  const { totalItems } = useCart();

  return (
    <nav className="bottom-nav">
      <div className="nav-item active">
        <FaHome />
        <span>Home</span>
      </div>

      <div
        className="nav-item"
        onClick={onMenuClick}
        style={{ cursor: "pointer" }}
      >
        <FaUtensils />
        <span>Menu</span>
      </div>

      <div
        className="nav-item"
        style={{ position: "relative", cursor: "pointer" }}
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

      <div className="nav-item">
        <FaUser />
        <span>Profile</span>
      </div>
    </nav>
  );
}

export default BottomNav;
