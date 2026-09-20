import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        navigate("/login", { replace: true, state: { from: "/profile" } });
        return;
      }

      try {
        const saved = localStorage.getItem("sugarCafeUser");
        const localProfile = saved ? JSON.parse(saved) : {};
        const userSnapshot = await getDoc(doc(db, "users", firebaseUser.uid));
        const firestoreProfile = userSnapshot.exists() ? userSnapshot.data() : {};
        const customerId =
          firestoreProfile.customerId ||
          localProfile.customerId ||
          `SC-CUST-${firebaseUser.uid.slice(-8).toUpperCase()}`;

        const ordersSnapshot = await getDocs(
          query(collection(db, "orders"), where("userId", "==", firebaseUser.uid))
        );

        const profile = {
          ...localProfile,
          ...firestoreProfile,
          uid: firebaseUser.uid,
          customerId,
          name: firestoreProfile.name || localProfile.name || "Sugar Customer",
          phone: firebaseUser.phoneNumber || firestoreProfile.phone || localProfile.phone || "",
          email: firebaseUser.email || firestoreProfile.email || localProfile.email || "",
          addresses: firestoreProfile.addresses || localProfile.addresses || [],
        };

        if (firebaseUser.isAnonymous && (!profile.name || profile.name === "Sugar Customer" || !profile.phone)) {
          navigate("/login", { replace: true, state: { from: "/profile" } });
          return;
        }

        setUser(profile);
        setOrdersCount(ordersSnapshot.size);
        localStorage.setItem("sugarCafeUser", JSON.stringify(profile));
      } catch (error) {
        console.error("Profile loading error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("sugarCafeUser");
    navigate("/");
  };

  if (loading) {
    return <div style={styles.page}><div style={styles.card}>Loading profile...</div></div>;
  }

  if (!user) return null;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.avatar}>👤</div>
        <h2>{user.name}</h2>
        <div style={styles.customerId}>{user.customerId}</div>

        {user.phone && <p style={styles.info}>📱 {user.phone}</p>}
        <p style={styles.verify}>
          {user.phoneVerified ? "✓ Mobile verified" : "• Mobile saved (not OTP-verified)"}
        </p>
        {user.email && <p style={styles.info}>✉️ {user.email}</p>}

        <div style={styles.stats}>
          <div><strong>{ordersCount}</strong><span>Orders</span></div>
          <div><strong>{(user.addresses || []).length}</strong><span>Saved Addresses</span></div>
        </div>

        <button style={styles.orders} onClick={() => navigate("/orders")}>My Orders</button>
        <button style={styles.back} onClick={() => navigate("/")}>Back to Home</button>
        <button style={styles.logout} onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f8f8f8", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", boxSizing: "border-box" },
  card: { width: "100%", maxWidth: "420px", background: "#fff", borderRadius: "20px", padding: "35px 25px", textAlign: "center", boxShadow: "0 5px 25px rgba(0,0,0,0.10)" },
  avatar: { width: "80px", height: "80px", margin: "0 auto 15px", borderRadius: "50%", background: "#ffe5e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "38px" },
  customerId: { display: "inline-block", padding: "6px 10px", borderRadius: "8px", background: "#fff7ed", color: "#9a3412", fontSize: "13px", fontWeight: "700" },
  info: { color: "#666", margin: "8px 0" },
  verify: { color: "#777", fontSize: "13px", margin: "6px 0" },
  stats: { display: "flex", gap: "10px", marginTop: "22px" },
  orders: { width: "100%", padding: "14px", marginTop: "22px", border: "none", borderRadius: "12px", background: "#ff6b35", color: "#fff", fontSize: "16px", fontWeight: "600", cursor: "pointer" },
  back: { width: "100%", padding: "14px", marginTop: "10px", border: "1px solid #ddd", borderRadius: "12px", background: "#fff", fontSize: "16px", cursor: "pointer" },
  logout: { width: "100%", padding: "14px", marginTop: "10px", border: "none", borderRadius: "12px", background: "#e53935", color: "#fff", fontSize: "16px", fontWeight: "600", cursor: "pointer" },
};

// Stats children styling is kept inline to avoid changing the existing global CSS.
const originalStats = styles.stats;
styles.stats = { ...originalStats, justifyContent: "space-between" };

export default Profile;
