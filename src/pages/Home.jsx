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
import AppLayout from "../components/AppLayout";

function Home() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All");

  useEffect(() => {
    const user =
      localStorage.getItem("sugarCafeUser");

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

      {/* NAVBAR */}

      <Navbar
        onSearch={setSearch}
      />


      {/* HERO */}

      <Hero />


      {/* SEARCH */}

      <SearchBar
        search={search}
        setSearch={setSearch}
      />


      {/* CATEGORIES */}

      <Categories
        selectedCategory={selectedCategory}
        setSelectedCategory={
          setSelectedCategory
        }
      />


      {/* POPULAR ITEMS */}

      <PopularItems
        search={search}
        selectedCategory={
          selectedCategory
        }
      />


      {/* OFFER */}

      <OfferBanner />


      {/* REVIEWS */}

      <ApprovedReviews />


      {/* BOTTOM NAV */}

      <BottomNav />


      {/* ADMIN */}

      <AdminButton />

    </AppLayout>
  );
}

export default Home;
