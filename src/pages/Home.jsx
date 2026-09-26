import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminButton from "../components/AdminButton";

import Hero from "../components/Hero";
import SearchBar from "../components/SearchBar";
import Categories from "../components/Categories";
import PopularItems from "../components/PopularItems";
import OfferBanner from "../components/OfferBanner";
import ApprovedReviews from "../components/ApprovedReviews";
import BottomNav from "../components/BottomNav";
import CategoryPopup from "../components/CategoryPopup";
import AppLayout from "../components/AppLayout";

/* =========================================================
   DAILY SCRATCH HOME OFFER
========================================================= */

function DailyScratchHomeCard({ onOrderNow }) {
  return (
    <section
      style={{
        padding: "8px 16px 18px",
        background: "#fff",
      }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          padding: "20px 18px",
          background:
            "linear-gradient(135deg, #111827 0%, #24140c 48%, #7c2d12 100%)",
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.16)",
          color: "#fff",
        }}
      >

        {/* Decorative circles */}

        <div
          style={{
            position: "absolute",
            width: 130,
            height: 130,
            borderRadius: "50%",
            right: -55,
            top: -55,
            background:
              "rgba(251,146,60,0.18)",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 90,
            height: 90,
            borderRadius: "50%",
            left: -45,
            bottom: -45,
            background:
              "rgba(255,255,255,0.06)",
          }}
        />

        {/* Top line */}

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 12,
          }}
        >

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "6px 10px",
              borderRadius: 999,
              background:
                "rgba(255,255,255,0.12)",
              border:
                "1px solid rgba(255,255,255,0.16)",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            🎁 DAILY REWARD
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#fed7aa",
            }}
          >
            EVERY DAY
          </span>

        </div>

        {/* Main content */}

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >

          {/* Gift */}

          <div
            style={{
              width: 62,
              height: 62,
              minWidth: 62,
              borderRadius: 18,
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(145deg,#fff7ed,#fed7aa)",
              boxShadow:
                "0 8px 20px rgba(0,0,0,0.18)",
              fontSize: 34,
            }}
          >
            🎁
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
            }}
          >

            <h2
              style={{
                margin: 0,
                fontSize: 21,
                lineHeight: 1.1,
                fontWeight: 900,
                letterSpacing: "-0.02em",
              }}
            >
              Daily Scratch & Win
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                lineHeight: 1.45,
                color: "#fed7aa",
                fontWeight: 600,
              }}
            >
              Shop for ₹499+ and unlock
              your scratch card.
            </p>

          </div>

        </div>

        {/* Reward teaser */}

        <div
          style={{
            position: "relative",
            marginTop: 16,
            padding: "11px 12px",
            borderRadius: 14,
            background:
              "rgba(255,255,255,0.09)",
            border:
              "1px solid rgba(255,255,255,0.12)",
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                fontSize: 17,
              }}
            >
              ✨
            </span>

            <span>
              Scratch to reveal your surprise reward
            </span>
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 11,
              color: "rgba(255,255,255,0.68)",
            }}
          >
            Reward is revealed only after eligible
            checkout.
          </div>

        </div>

        {/* Button */}

        <button
          type="button"
          onClick={onOrderNow}
          style={{
            position: "relative",
            width: "100%",
            marginTop: 14,
            border: 0,
            borderRadius: 14,
            padding: "13px 16px",
            background:
              "linear-gradient(135deg,#fb923c,#ea580c)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 900,
            cursor: "pointer",
            boxShadow:
              "0 7px 18px rgba(234,88,12,0.28)",
          }}
        >
          ORDER NOW & SCRATCH 🎁
        </button>

      </div>
    </section>
  );
}

/* =========================================================
   HOME
========================================================= */

function Home() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const [showPopup, setShowPopup] =
    useState(false);

  /* =========================
     CHECK CUSTOMER LOGIN
  ========================= */

  useEffect(() => {
    const user =
      localStorage.getItem(
        "sugarCafeUser"
      );

    if (!user) {
      navigate("/login", {
        state: {
          from: "/",
        },
        replace: true,
      });
    }
  }, [navigate]);

  return (
    <AppLayout>

      {/* =================================================
          NAVBAR
      ================================================= */}

      <Navbar
        onSearch={setSearch}
      />

      {/* =================================================
          HERO + LOCATION
      ================================================= */}

      <Hero />

      {/* =================================================
          DAILY SCRATCH & WIN
          
          Customer sees this every day.
          Actual reward stays hidden.
      ================================================= */}

      <DailyScratchHomeCard
        onOrderNow={() =>
          navigate("/menu")
        }
      />

      {/* =================================================
          SEARCH BAR
      ================================================= */}

      <SearchBar
        search={search}
        setSearch={setSearch}
      />

      {/* =================================================
          CATEGORIES
      ================================================= */}

      <Categories
        selectedCategory={
          selectedCategory
        }
        setSelectedCategory={
          setSelectedCategory
        }
      />

      {/* =================================================
          POPULAR ITEMS
      ================================================= */}

      <PopularItems
        search={search}
        selectedCategory={
          selectedCategory
        }
      />

      {/* =================================================
          OFFER
      ================================================= */}

      <OfferBanner />

      {/* =================================================
          APPROVED CUSTOMER REVIEWS
      ================================================= */}

      <ApprovedReviews />

      {/* =================================================
          BOTTOM NAV
      ================================================= */}

      <BottomNav
        onMenuClick={() =>
          setShowPopup(true)
        }
      />

      {/* =================================================
          CATEGORY POPUP
      ================================================= */}

      <CategoryPopup
        open={showPopup}
        onClose={() =>
          setShowPopup(false)
        }
        setSelectedCategory={
          setSelectedCategory
        }
      />

      {/* =================================================
          ADMIN
      ================================================= */}

      <AdminButton />

    </AppLayout>
  );
}

export default Home;
