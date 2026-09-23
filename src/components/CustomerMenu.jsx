import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserCircle,
  FaUtensils,
  FaMapMarkerAlt,
  FaHistory,
  FaUsers,
  FaPhoneAlt,
  FaChevronRight,
  FaIdCard,
} from "react-icons/fa";

import "./CustomerMenu.css";

function CustomerMenu({ onClose }) {
  const navigate = useNavigate();

  let profile = {};

  try {
    profile =
      JSON.parse(
        localStorage.getItem("sugarCafeUser")
      ) || {};
  } catch {
    profile = {};
  }

  const customerId =
    profile.customerId ||
    localStorage.getItem(
      "sugarCafeCustomerId"
    ) ||
    "Not available";

  const customerName =
    profile.name || "Customer";

  const phone =
    profile.phone?.replace("+91", "") ||
    "Not available";

  const go = (path) => {
    if (onClose) onClose();
    navigate(path);
  };

  const callNumber = (number) => {
    window.location.href = `tel:${number}`;
  };

  return (
    <div className="customer-menu-overlay">

      <div className="customer-menu">

        {/* CLOSE */}

        <button
          className="customer-menu-close"
          onClick={onClose}
          aria-label="Close menu"
        >
          ×
        </button>

        {/* CUSTOMER */}

        <div className="customer-header">

          <div className="customer-avatar">
            {customerName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="customer-header-info">
            <h2>
              {customerName}
            </h2>

            <p>
              <FaPhoneAlt />
              {phone}
            </p>
          </div>

        </div>

        {/* PERMANENT ID */}

        <div className="customer-id-box">

          <FaIdCard />

          <div>
            <span>
              Customer ID
              <small>
                {" "} (Permanent)
              </small>
            </span>

            <strong>
              {customerId}
            </strong>
          </div>

        </div>

        {/* OPTIONS */}

        <div className="customer-menu-options">

          {/* MENU */}

          <button
            className="customer-menu-item"
            onClick={() => go("/")}
          >
            <div className="customer-menu-icon">
              <FaUtensils />
            </div>

            <div className="customer-menu-text">
              <strong>Menu</strong>
              <span>
                Explore our full menu
              </span>
            </div>

            <FaChevronRight className="customer-arrow" />
          </button>

          {/* TRACK ORDER */}

          <button
            className="customer-menu-item"
            onClick={() =>
              go("/orders?type=current")
            }
          >
            <div className="customer-menu-icon">
              <FaMapMarkerAlt />
            </div>

            <div className="customer-menu-text">
              <strong>
                Track Order
              </strong>
              <span>
                Check your current order
              </span>
            </div>

            <FaChevronRight className="customer-arrow" />
          </button>

          {/* ORDER HISTORY */}

          <button
            className="customer-menu-item"
            onClick={() =>
              go("/orders?type=history")
            }
          >
            <div className="customer-menu-icon">
              <FaHistory />
            </div>

            <div className="customer-menu-text">
              <strong>
                Order History
              </strong>
              <span>
                View all past orders
              </span>
            </div>

            <FaChevronRight className="customer-arrow" />
          </button>

          {/* BULK ORDER */}

          <button
            className="customer-menu-item"
            onClick={() => go("/bulk-order")}
          >
            <div className="customer-menu-icon">
              <FaUsers />
            </div>

            <div className="customer-menu-text">
              <strong>
                Bulk Order
              </strong>
              <span>
                Full menu for bulk orders
              </span>
            </div>

            <FaChevronRight className="customer-arrow" />
          </button>

          {/* CONTACT */}

          <button
            className="customer-menu-item"
            onClick={() =>
              go("/contact")
            }
          >
            <div className="customer-menu-icon">
              <FaPhoneAlt />
            </div>

            <div className="customer-menu-text">
              <strong>
                Contact Us
              </strong>
              <span>
                Address, phone & support
              </span>
            </div>

            <FaChevronRight className="customer-arrow" />
          </button>

        </div>

        {/* CONTACT CARD */}

        <div className="customer-contact-card">

          <div className="contact-card-title">
            <FaMapMarkerAlt />
            <strong>
              Sugar Café
            </strong>
          </div>

          <p>
            Sada Colony, Near Hotel Green
            Park, Korba, Chhattisgarh -
            495677
          </p>

          <button
            onClick={() =>
              callNumber("6262620201")
            }
          >
            <FaPhoneAlt />
            6262620201
          </button>

        </div>

      </div>

      {/* OUTSIDE */}

      <button
        className="customer-menu-backdrop"
        onClick={onClose}
        aria-label="Close"
      />

    </div>
  );
}

export default CustomerMenu;
