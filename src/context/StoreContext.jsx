import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const DEFAULT_STORE = {
  isOpen: true,
  acceptingOrders: true,
  maxDeliveryDistanceKm: 10,
  deliveryPerKm: 20,
  minDeliveryCharge: 20,
  maxDeliveryCharge: 300,
  preparationMinutes: 15,
  extraPreparationMinutes: 10,
  acceptanceSeconds: 60,
  orderStartTime: "12:00",
  orderEndTime: "21:30",
  upiEnabled: true,
  codEnabled: true,
  buzzerEnabled: true,
  announcement: "",
};

function timeToMinutes(value) {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function getOrderTiming(settings) {
  const start = timeToMinutes(settings.orderStartTime);
  const end = timeToMinutes(settings.orderEndTime);
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const inHours = start <= end ? current >= start && current <= end : current >= start || current <= end;
  return { start, end, current, inHours };
}

const StoreContext = createContext(DEFAULT_STORE);

export function StoreProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_STORE);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "store"), (snap) => {
      setSettings({ ...DEFAULT_STORE, ...(snap.exists() ? snap.data() : {}) });
    }, (error) => {
      console.error("Store settings listener error:", error);
      setSettings(DEFAULT_STORE);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(() => {
    // Recalculate the delivery window as the clock moves, even when Firebase settings do not change.
    void clock;
    const timing = getOrderTiming(settings);
    return {
      ...settings,
      ...timing,
      deliveryAvailable: Boolean(settings.isOpen && settings.acceptingOrders && timing.inHours),
      orderTimingLabel: `${formatTime(settings.orderStartTime)} – ${formatTime(settings.orderEndTime)}`,
    };
  }, [settings, clock]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function formatTime(value) {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export const useStoreSettings = () => useContext(StoreContext);
export default StoreContext;
