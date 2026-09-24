import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
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
    const savedCustomerId = localStorage.getItem(
      "sugarCafeCustomerId"
    );

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

      const customersRef = collection(db, "customers");

      const customerQuery = query(
        customersRef,
        where("phone", "==", cleanPhone)
      );

      const customerSnapshot = await getDocs(customerQuery);

      let customerId;
      let customerData;

      // ============================================
      // EXISTING CUSTOMER
      // ============================================

      if (!customerSnapshot.empty) {
        const customerDoc = customerSnapshot.docs[0];

        customerData = {
          id: customerDoc.id,
          ...customerDoc.data(),
        };

        customerId = customerData.customerId;

        // Old customer without ID
        // Create it and save permanently.
        if (!customerId) {
          customerId = generateCustomerId();

          await updateDoc(customerDoc.ref, {
            customerId,
            updatedAt: serverTimestamp(),
          });

          customerData.customerId = customerId;
        }

        // Keep customer's latest name
        if (
          cleanName &&
          cleanName !== customerData.name
        ) {
          await updateDoc(customerDoc.ref, {
            name: cleanName,
            updatedAt: serverTimestamp(),
          });

          customerData.name = cleanName;
        }
      }

      // ============================================
      // NEW CUSTOMER
      // ============================================

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

      // ============================================
      // SAVE PERMANENT SESSION
      // ============================================

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

        {/* LOGO */}
        <div className="login-brand">

          <div className="login-logo">
            🍰
          </div>

          <div className="login-brand-name">
            SUGAR CAFÉ
          </div>

        </div>

        {/* HEADING */}
        <div className="login-heading">

          <div className="login-eyebrow">
              WELCOME 
          </div>

          <h1>
  First Online Café
</h1>

<p className="login-main-tagline">
  Delicious food now just a click away
</p>

<p>
  Login to view your orders,
  track deliveries and manage
  your Sugar Café account.
</p>

        </div>

        {/* FORM */}
        <form
          onSubmit={handleLogin}
          className="login-form"
        >

          {/* NAME */}
          <div className="login-field">

            <label htmlFor="customer-name">
              Your Name
            </label>

            <input
              id="customer-name"
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

          {/* PHONE */}
          <div className="login-field">

            <label htmlFor="customer-phone">
              Mobile Number
            </label>

            <div className="phone-input">

              <div className="country-code">
                <span>🇮🇳</span>
                <strong>+91</strong>
              </div>

              <input
                id="customer-phone"
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

            <div className="phone-hint">
              Same number = same Sugar Café account
            </div>

          </div>

          {/* BUTTON */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >

            <span>
              {loading
                ? "Checking Account..."
                : "Continue"}
            </span>

            {!loading && (
              <span className="login-arrow">
                →
              </span>
            )}

          </button>

        </form>

        {/* SECURITY NOTE */}
        <div className="login-note">

          <div className="login-note-icon">
            🔒
          </div>

          <div>
            <strong>Your account stays connected</strong>

            <p>
              Your mobile number keeps your
              Sugar Café customer account
              connected across devices.
            </p>
          </div>

        </div>

        <div className="login-footer">
          Sugar Café • Good food, sweet moments
        </div>

      </div>

    </div>
  );
}

export default Login;
