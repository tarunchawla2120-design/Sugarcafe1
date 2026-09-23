import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { FaPhoneAlt, FaCoffee, FaUser } from "react-icons/fa";
import { db } from "../firebase";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || "/profile";

  const generateCustomerId = () => {
    const random = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    return `SC-${random}`;
  };

  const handleContinue = async (e) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = `+91${cleanPhone}`;

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

      // Find existing customer
      const customerQuery = query(
        collection(db, "customers"),
        where("phone", "==", fullPhone)
      );

      const snapshot = await getDocs(customerQuery);

      let customerId = "";
      let customerData = null;

      if (!snapshot.empty) {
        // Existing customer
        const customerDoc = snapshot.docs[0];

        customerId =
          customerDoc.data().customerId ||
          customerDoc.id;

        customerData = customerDoc.data();

        // Update latest name
        await updateDoc(
          doc(db, "customers", customerDoc.id),
          {
            name: cleanName,
            updatedAt: Timestamp.now(),
          }
        );
      } else {
        // New customer
        customerId = generateCustomerId();

        const newCustomer = {
          customerId,
          name: cleanName,
          phone: fullPhone,
          email: "",
          photoURL: "",
          rewards: 0,
          favourites: [],
          addresses: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        const newDoc = await addDoc(
          collection(db, "customers"),
          newCustomer
        );

        customerData = {
          ...newCustomer,
          firestoreId: newDoc.id,
        };
      }

      // Save customer profile locally
      const profile = {
        name: cleanName,
        phone: fullPhone,
        customerId,
        uid: "",
        email: customerData?.email || "",
        phoneVerified: false,
        rewards: customerData?.rewards || 0,
        favourites: customerData?.favourites || [],
        addresses: customerData?.addresses || [],
        guest: false,
        loggedIn: true,
      };

      localStorage.setItem(
        "sugarCafeUser",
        JSON.stringify(profile)
      );

      localStorage.setItem(
        "sugarCafeCustomerId",
        customerId
      );

      navigate(from, { replace: true });

    } catch (error) {
      console.error("Customer login error:", error);

      alert(
        "Unable to create/login customer account. Please try again."
      );
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
          Login or create your Sugar Café customer account.
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
            {loading ? "Please wait…" : "Continue"}
          </button>

        </form>

        <div className="login-note">
          <strong>Your Customer Account</strong>
          <br />
          Your details and order history will be saved
          with your Customer ID.
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
