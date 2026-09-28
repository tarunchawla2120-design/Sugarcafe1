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
  arrayUnion,
} from "firebase/firestore";

import { db } from "../firebase";
import { registerForNotifications } from "../notification";
import "./Login.css";

function generateCustomerId() {
  return `SC-${Math.floor(100000 + Math.random() * 900000)}`;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

/*
=========================================================
FIREBASE REQUEST TIMEOUT
=========================================================
Prevents "Checking Account..." from staying forever
if Firebase/network does not respond.
*/

function withTimeout(promise, timeout = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            "Firebase request timed out. Please check your internet connection."
          )
        );
      }, timeout);
    }),
  ]);
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  /*
  =========================================================
  CHECK EXISTING SESSION
  =========================================================
  */

  useEffect(() => {
    const savedCustomerId = localStorage.getItem(
      "sugarCafeCustomerId"
    );

    if (savedCustomerId) {
      navigate("/home", {
        replace: true,
      });
    }
  }, [navigate]);

  /*
  =========================================================
  LOGIN
  =========================================================
  */

  const handleLogin = async (e) => {
    e.preventDefault();

    if (loading) return;

    const cleanName = name.trim();
    const cleanPhone = normalizePhone(phone);

    /*
    -------------------------------------------------------
    VALIDATION
    -------------------------------------------------------
    */

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
      =====================================================
      FIND CUSTOMER
      =====================================================
      */

      const customersRef = collection(
        db,
        "customers"
      );

      const customerQuery = query(
        customersRef,
        where("phone", "==", cleanPhone)
      );

      /*
      IMPORTANT:
      Firebase cannot keep the button stuck forever.
      */

      const customerSnapshot = await withTimeout(
        getDocs(customerQuery),
        12000
      );

      let customerId;
      let customerData;
      let customerRef;

      /*
      =====================================================
      EXISTING CUSTOMER
      =====================================================
      */

      if (!customerSnapshot.empty) {
        const customerDoc =
          customerSnapshot.docs[0];

        customerRef = customerDoc.ref;

        customerData = {
          id: customerDoc.id,
          ...customerDoc.data(),
        };

        customerId = customerData.customerId;

        /*
        ---------------------------------------------------
        OLD CUSTOMER WITHOUT CUSTOMER ID
        ---------------------------------------------------
        */

        if (!customerId) {
          customerId = generateCustomerId();

          await withTimeout(
            updateDoc(customerRef, {
              customerId,
              updatedAt: serverTimestamp(),
            }),
            10000
          );

          customerData.customerId = customerId;
        }

        /*
        ---------------------------------------------------
        UPDATE CUSTOMER NAME
        ---------------------------------------------------
        */

        if (
          cleanName &&
          cleanName !== customerData.name
        ) {
          await withTimeout(
            updateDoc(customerRef, {
              name: cleanName,
              updatedAt: serverTimestamp(),
            }),
            10000
          );

          customerData.name = cleanName;
        }
      }

      /*
      =====================================================
      NEW CUSTOMER
      =====================================================
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

        customerRef = await withTimeout(
          addDoc(
            customersRef,
            newCustomer
          ),
          12000
        );

        customerData = {
          id: customerRef.id,
          ...newCustomer,
        };
      }

      /*
      =====================================================
      SAVE CUSTOMER SESSION
      =====================================================
      */

      localStorage.setItem(
        "sugarCafeCustomerId",
        customerId
      );

      localStorage.setItem(
        "sugarCafeUser",
        JSON.stringify({
          customerId,
          name:
            customerData?.name ||
            cleanName,
          phone: cleanPhone,
        })
      );

      /*
      =====================================================
      IMPORTANT:
      LOGIN DOES NOT WAIT FOR FCM
      =====================================================
      */

      const redirectTo =
        location.state?.from || "/home";

      /*
      -----------------------------------------------------
      GO TO HOME IMMEDIATELY
      -----------------------------------------------------
      */

      navigate(redirectTo, {
        replace: true,
      });

      /*
      =====================================================
      FCM / PUSH NOTIFICATION
      =====================================================
      Runs in background.

      If notification setup fails, customer login
      remains successful.
      =====================================================
      */

      Promise.resolve()
        .then(async () => {
          try {
            const fcmToken =
              await withTimeout(
                registerForNotifications(),
                10000
              );

            if (
              fcmToken &&
              customerRef
            ) {
              await withTimeout(
                updateDoc(
                  customerRef,
                  {
                    fcmToken,
                    fcmTokens:
                      arrayUnion(
                        fcmToken
                      ),
                    fcmTokenUpdatedAt:
                      serverTimestamp(),
                    notificationsEnabled:
                      true,
                    updatedAt:
                      serverTimestamp(),
                  }
                ),
                10000
              );

              console.log(
                "FCM token saved successfully."
              );
            }
          } catch (notificationError) {
            console.error(
              "Notification setup failed:",
              notificationError
            );
          }
        });
    } catch (error) {
      /*
      =====================================================
      LOGIN ERROR
      =====================================================
      */

      console.error(
        "Customer login error:",
        error
      );

      if (
        error?.message?.includes(
          "timed out"
        )
      ) {
        alert(
          "Connection is taking too long. Please check your internet connection and try again."
        );
      } else {
        alert(
          "Unable to login right now. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /*
  =========================================================
  UI
  =========================================================
  */

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

            <strong>
              Your account stays connected
            </strong>

            <p>
              Your mobile number keeps your
              Sugar Café customer account
              connected across devices.
            </p>

          </div>

        </div>

        {/* FOOTER */}

        <div className="login-footer">
          Sugar Café • Good food, sweet moments
        </div>

      </div>

    </div>
  );
}

export default Login;
