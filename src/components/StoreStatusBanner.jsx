import { useLocation } from "react-router-dom";
import { useStoreSettings } from "../context/StoreContext";
import "./StoreStatusBanner.css";

export default function StoreStatusBanner() {
  const store = useStoreSettings();
  const location = useLocation();
  if (location.pathname.startsWith("/admin") || location.pathname === "/dashboard" || location.pathname === "/settings") return null;

  if (!store.isOpen) {
    return <div className="store-status-banner closed"><strong>🔴 SugarCafe is currently closed</strong><span>Delivery orders are available {store.orderTimingLabel}.</span></div>;
  }

  if (!store.acceptingOrders) {
    return <div className="store-status-banner closed"><strong>⏸️ Orders are temporarily paused</strong><span>{store.announcement || `Delivery orders are available ${store.orderTimingLabel}.`}</span></div>;
  }

  if (!store.inHours) {
    return <div className="store-status-banner closed"><strong>🔴 Delivery is currently closed</strong><span>Delivery orders are available only from <b>{store.orderTimingLabel}</b>.</span></div>;
  }

  return <div className="store-status-banner notice"><strong>🟢 Delivery Available</strong><span>Today: <b>{store.orderTimingLabel}</b></span>{store.announcement && <span>• {store.announcement}</span>}</div>;
}
