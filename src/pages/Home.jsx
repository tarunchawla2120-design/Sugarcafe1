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

function Home() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("sugarCafeUser");

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
      <Navbar onSearch={setSearch} />

      <Hero />

      <SearchBar
        search={search}
        setSearch={setSearch}
      />

      <Categories
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />

      <PopularItems
        search={search}
        selectedCategory={selectedCategory}
      />

      <OfferBanner />

      <ApprovedReviews />

      <BottomNav
        onMenuClick={() => setShowPopup(true)}
      />

      <CategoryPopup
        open={showPopup}
        onClose={() => setShowPopup(false)}
        setSelectedCategory={setSelectedCategory}
      />

      <AdminButton />
    </AppLayout>
  );
}

export default Home;
