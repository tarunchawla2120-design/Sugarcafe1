import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase";
import "./Login.css";

function generateCustomerId() {
  return `SC-${Math.floor(100000 + Math.random() * 900000)}`;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedCustomerId = localStorage.getItem("sugarCafeCustomerId");

    if (savedCustomerId) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanPhone = normalizePhone(phone);

    if (!cleanName) {
      alert("Please enter your name.");
      return;
    }

    if (cleanPhone.length !== 10) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setLoading(true);

      /*
       * =====================================================
       * STEP 1
       * Find customer by PHONE NUMBER
       *
       * This is the important part.
       * Same phone = same customer forever.
       * =====================================================
       */

      const customersRef = collection(db, "customers");

      const customerQuery = query(
        customersRef,
        where("phone", "==", cleanPhone)
      );

      const customerSnapshot = await getDocs(customerQuery);

      let customerId;
      let customerData;

      /*
       * =====================================================
       * EXISTING CUSTOMER
       * =====================================================
       */

      if (!customerSnapshot.empty) {
        const customerDoc = customerSnapshot.docs[0];

        customerId = customerDoc.data().customerId;
        customerData = {
          id: customerDoc.id,
          ...customerDoc.data(),
        };

        /*
         * Safety:
         * If old customer document somehow doesn't have
         * customerId, generate one only once.
         */

        if (!customerId) {
          customerId = generateCustomerId();
        }
      }

      /*
       * =====================================================
       * NEW CUSTOMER
       * =====================================================
       */

      else {
        customerId = generateCustomerId();

        const newCustomer = {
          customerId,
          name: cleanName,
          phone: cleanPhone,
          addresses: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const newCustomerRef = await addDoc(
          customersRef,
          newCustomer
        );

        customerData = {
          id: newCustomerRef.id,
          ...newCustomer,
        };
      }

      /*
       * =====================================================
       * SAVE PERMANENT CUSTOMER SESSION
       * =====================================================
       */

      localStorage.setItem(
        "sugarCafeCustomerId",
        customerId
      );

      localStorage.setItem(
        "sugarCafeUser",
        JSON.stringify({
          customerId,
          name: customerData?.name || cleanName,
          phone: cleanPhone,
        })
      );

      /*
       * Keep the existing redirect location if available.
       */

      const redirectTo =
        location.state?.from || "/home";

      navigate(redirectTo, {
        replace: true,
      });

    } catch (error) {
      console.error("Customer login error:", error);

      alert(
        "Unable to login right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-logo">
          🍰
        </div>

        <div className="login-heading">
          <span>SUGAR CAFÉ</span>

          <h1>Welcome Back</h1>

          <p>
            Login to view your orders and track
            your Sugar Café account.
          </p>
        </div>

        <form onSubmit={handleLogin}>

          <div className="login-field">
            <label>Your Name</label>

            <input
              type="text"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Enter your name"
              autoComplete="name"
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label>Mobile Number</label>

            <div className="phone-input">
              <span>+91</span>

              <input
                type="tel"
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10)
                  )
                }
                placeholder="10-digit mobile number"
                inputMode="numeric"
                autoComplete="tel"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading
              ? "Checking Account..."
              : "Continue"}
          </button>

        </form>

        <div className="login-note">
          Your mobile number is used to keep
          your Sugar Café customer account
          connected across devices.
        </div>

      </div>
    </div>
  );
}

export default Login;
