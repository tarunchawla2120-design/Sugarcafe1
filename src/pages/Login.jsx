import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaPhoneAlt, FaCoffee, FaUser } from "react-icons/fa";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || "/profile";

  const handleContinue = (e) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanName.length < 2) {
      alert("Please enter your name.");
      return;
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      alert("Please enter a valid 10 digit mobile number.");
      return;
    }

    try {
      setLoading(true);

      const profile = {
        name: cleanName,
        phone: `+91${cleanPhone}`,
        customerId: "",
        uid: "",
        email: "",
        phoneVerified: false,
        rewards: 0,
        favourites: [],
        addresses: [],
        guest: true,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(
        "sugarCafeUser",
        JSON.stringify(profile)
      );

      navigate(from, { replace: true });

    } catch (error) {
      console.error("Guest profile error:", error);
      alert("Unable to continue. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">

        <div className="login-icon">
          <FaUser />
        </div>

        <FaCoffee className="login-logo" />

        <h2>Welcome to Sugar Café</h2>

        <p className="login-subtitle">
          Enter your details to continue with your order.
        </p>

        <form onSubmit={handleContinue}>

          <div className="input-box">
            <FaUser className="icon" />

            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="input-box">
            <FaPhoneAlt className="icon" />

            <span className="country-code">+91</span>

            <input
              type="tel"
              placeholder="10 digit mobile number"
              value={phone}
              maxLength={10}
              onChange={(e) =>
                setPhone(
                  e.target.value.replace(/\D/g, "")
                )
              }
              autoComplete="tel"
            />
          </div>

          <button
            className="login-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? "Continuing…" : "Continue"}
          </button>

        </form>

        <div className="login-note">
          <strong>Guest Checkout</strong>
          <br />
          No OTP, customer account or Customer ID is required.
        </div>

        <button
          className="change-number"
          type="button"
          onClick={() => navigate("/")}
        >
          Back to Home
        </button>

      </div>
    </div>
  );
}

export default Login;