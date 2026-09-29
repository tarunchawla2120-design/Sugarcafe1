import { useState } from "react";
import SplashScreen from "./SplashScreen";
import "./App.css";
import { StoreProvider } from "./context/StoreContext";
import StoreStatusBanner from "./components/StoreStatusBanner";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

// CUSTOMER PAGES
import Profile from "./pages/Profile";
import Home from "./pages/Home";
import Cart from "./pages/Cart";
import Login from "./pages/Login";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import Categories from "./pages/Categories";
import Menu from "./pages/Menu";
import Orders from "./pages/Orders";

// ADMIN
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import StoreSettings from "./pages/StoreSettings";
import AdminOrders from "./pages/AdminOrders";
import AdminOffers from "./pages/AdminOffers";
import AdminMenu from "./pages/AdminMenu";
import AdminCategories from "./pages/AdminCategories";
import AdminReviews from "./pages/AdminReviews";


/* =========================================================
   STORE STATUS BANNER CONTROLLER

   Checkout.jsx already contains its own status bar,
   so the global StoreStatusBanner must be hidden there.
========================================================= */

function StoreBannerController() {
  const location = useLocation();

  if (location.pathname === "/checkout") {
    return null;
  }

  return <StoreStatusBanner />;
}


/* =========================================================
   APP
========================================================= */

function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return (
      <SplashScreen
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  return (
    <StoreProvider>
      <BrowserRouter>

        <StoreBannerController />

        <Routes>

          {/* CUSTOMER WEBSITE */}

          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/success" element={<OrderSuccess />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />

          {/* ADMIN */}

          <Route
            path="/admin-login"
            element={<AdminLogin />}
          />

          <Route
            path="/admin"
            element={<Dashboard />}
          />

          <Route
            path="/admin/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/admin/menu"
            element={<AdminMenu />}
          />

          <Route
            path="/admin/categories"
            element={<AdminCategories />}
          />

          <Route
            path="/admin/orders"
            element={<AdminOrders />}
          />

          <Route
            path="/admin/offers"
            element={<AdminOffers />}
          />

          <Route
            path="/admin/reviews"
            element={<AdminReviews />}
          />

          <Route
            path="/admin/settings"
            element={<StoreSettings />}
          />

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/settings"
            element={<StoreSettings />}
          />

          {/* UNKNOWN URL */}

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>

      </BrowserRouter>
    </StoreProvider>
  );
}

export default App;
