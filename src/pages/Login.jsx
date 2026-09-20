import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { FaPhoneAlt, FaCoffee, FaUser } from "react-icons/fa";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);

  const from = location.state?.from || "/profile";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        let user = firebaseUser;

        if (!user) {
          const result = await signInAnonymously(auth);
          user = result.user;
        }

        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name && data.name !== "Sugar Customer" ? data.name : "");
          setPhone(data.phone || "");
        }
      } catch (error) {
        console.error("Customer login setup error:", error);
        alert("Unable to open customer account. Please try again.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleContinue = async (e) => {
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

      let user = auth.currentUser;
      if (!user) {
        const result = await signInAnonymously(auth);
        user = result.user;
      }

      const userRef = doc(db, "users", user.uid);
      const existingSnap = await getDoc(userRef);
      const existing = existingSnap.exists() ? existingSnap.data() : {};
      const customerId =
        existing.customerId ||
        `SC-CUST-${user.uid.slice(-8).toUpperCase()}`;

      const profile = {
        uid: user.uid,
        customerId,
        name: cleanName,
        phone: `+91${cleanPhone}`,
        email: user.email || existing.email || "",
        phoneVerified: Boolean(user.phoneNumber),
        rewards: existing.rewards ?? 0,
        favourites: existing.favourites || [],
        addresses: existing.addresses || [],
        createdAt: existing.createdAt || new Date(),
        updatedAt: new Date(),
      };

      await setDoc(userRef, profile, { merge: true });
      localStorage.setItem("sugarCafeUser", JSON.stringify(profile));

      alert("Customer account ready! 🎉");
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Customer profile error:", error);
      alert(error.message || "Unable to create customer account.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-box">
          <FaCoffee className="login-logo" />
          <h2>Opening your Sugar Café account…</h2>
          <p>Please wait a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-icon"><FaUser /></div>
        <FaCoffee className="login-logo" />

        <h2>Welcome to Sugar Café</h2>
        <p className="login-subtitle">
          Create your customer profile — no OTP and no payment required.
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
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              autoComplete="tel"
            />
          </div>

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>

        <div className="login-note">
          <strong>Secure customer ID</strong>
          <br />
          Your account gets a unique Sugar Café Customer ID. Your mobile number is
          saved for order contact, but it is <strong>not OTP-verified</strong>.
        </div>

        <button className="change-number" type="button" onClick={() => navigate("/")}>Back to Home</button>
      </div>
    </div>
  );
}

export default Login;
