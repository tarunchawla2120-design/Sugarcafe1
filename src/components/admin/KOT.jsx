import { useEffect, useRef, useState } from "react";
import { doc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import "./KOT.css";

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const n = new Date(value).getTime();
  return Number.isNaN(n) ? null : n;
};

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const itemsFor = (order) => order?.items || order?.cart || [];
const label = (order) => order?.orderNumber || order?.id?.slice(-8)?.toUpperCase() || "—";

export default function KOT({ order, onClose }) {
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const alarmRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!order) return null;

  const status = order.status || "New";
  const items = itemsFor(order);
  const end = toMillis(order.preparationEndAt);
  const remainingSeconds = end ? Math.max(0, Math.floor((end - now) / 1000)) : 0;
  const timeLeft = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  const created = toMillis(order.createdAt);
  const orderDate = created ? new Date(created) : new Date();
  const paymentMethod = String(order.paymentMethod || order.paymentStatus || "Cash on Delivery");
  const isPrepaid = /prepaid|online|upi|paid/i.test(paymentMethod) || order.paymentStatus === "Paid";
  const paymentLabel = isPrepaid ? "PREPAID / ONLINE PAID" : "CASH ON DELIVERY";
  const address = typeof order.address === "string" ? order.address : order.address?.fullAddress || order.address?.address || "—";

  const playBell = () => {
    try {
      if (!alarmRef.current) alarmRef.current = new Audio("/alarm_bell.mp3");
      alarmRef.current.currentTime = 0;
      alarmRef.current.play().catch(() => {});
    } catch (_) {}
  };

  const updateOrder = async (updates) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "orders", order.id), updates);
      return true;
    } catch (error) {
      console.error("KOT order update failed:", error);
      alert("Order update nahi ho paya.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const printKOT = async (printableOrder = order) => {
    if (!window.electronAPI?.printKOT) {
      alert("Automatic KOT printing ke liye SugarCafe Dashboard app open karein. Chrome browser se silent printing possible nahi hai.");
      return false;
    }
    try {
      const result = await window.electronAPI.printKOT(printableOrder);
      if (!result?.success) {
        console.error("KOT print failed:", result?.failureReason);
        alert(`KOT print nahi hua. ${result?.failureReason || "Printer check karein."}`);
      }
      return Boolean(result?.success);
    } catch (error) {
      console.error("KOT print error:", error);
      alert("KOT print nahi hua. Printer check karein.");
      return false;
    }
  };

  const acceptOrder = async () => {
    const minutes = Math.max(1, Number(order.preparationMinutes ?? 15));
    const started = Date.now();
    const finish = started + minutes * 60000;
    const ok = await updateOrder({
      status: "Preparing",
      acceptedAt: Timestamp.fromMillis(started),
      preparationStartedAt: Timestamp.fromMillis(started),
      preparationEndAt: Timestamp.fromMillis(finish),
      preparationMinutes: minutes,
      rejectedAt: null,
    });
    if (ok) {
      await printKOT({
        ...order,
        status: "Preparing",
        acceptedAt: { seconds: Math.floor(started / 1000) },
        preparationStartedAt: { seconds: Math.floor(started / 1000) },
        preparationEndAt: { seconds: Math.floor(finish / 1000) },
        preparationMinutes: minutes,
      });
      onClose?.();
    }
  };

  const rejectOrder = async () => {
    const reason = window.prompt("Reject reason (optional):", "Unable to accept this order");
    const ok = await updateOrder({
      status: "Rejected",
      rejectionReason: reason || "Order rejected by staff",
      rejectedAt: Timestamp.now(),
    });
    if (ok) onClose?.();
  };

  const addExtraTime = () => {
    const mins = Math.max(1, Number(order.extraPreparationMinutes ?? 10));
    const base = toMillis(order.preparationEndAt) || now;
    return updateOrder({ preparationEndAt: Timestamp.fromMillis(base + mins * 60000), extraTimeAdded: mins });
  };

  const markFoodReady = () => updateOrder({ status: "Food Ready", foodReadyAt: Timestamp.now() });
  const dispatchOrder = () => updateOrder({ status: "Dispatched", dispatchedAt: Timestamp.now() });
  const markDelivered = () => updateOrder({ status: "Delivered", deliveredAt: Timestamp.now() });

  return (
    <div className="kot-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="kot-box">
        {status === "New" && (
          <div className="kot-response">
            <strong>⏱️ NEW ORDER</strong>
            <button onClick={acceptOrder} disabled={saving}>✅ ACCEPT ORDER</button>
            <button onClick={rejectOrder} disabled={saving}>❌ REJECT</button>
          </div>
        )}

        {status === "Preparing" && (
          <button className="extra-time-btn" onClick={addExtraTime} disabled={saving}>➕ +10 MIN EXTRA</button>
        )}

        <section className="print-slip kitchen-slip">
          <div className="kot-header"><h2>SUGAR CAFE</h2><p>KITCHEN ORDER TICKET</p></div>
          <div className="kot-line" />
          <div className="kot-info">
            <p><strong>Order:</strong> #{label(order)}</p>
            <p><strong>Date:</strong> {orderDate.toLocaleDateString("en-IN")}</p>
            <p><strong>Time:</strong> {orderDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
            <p><strong>Type:</strong> {order.orderType || "Delivery"}</p>
          </div>
          <div className="kot-line" />
          <h3>ORDER ITEMS</h3>
          <div className="kot-items">
            {items.length ? items.map((item, index) => (
              <div className="kot-item" key={item.id || index}>
                <div className="kot-item-name"><strong>{item.name || "Food Item"}</strong>{item.variant && <small>{item.variant}</small>}</div>
                <div className="kot-item-qty">× {item.qty || item.quantity || 1}</div>
              </div>
            )) : <p>No items found.</p>}
          </div>
          {(order.instructions || order.customerNotes || order.notes) && <><div className="kot-line" /><h3>CUSTOMER NOTES</h3><p className="kot-instructions">{order.instructions || order.customerNotes || order.notes}</p></>}
          <div className="kot-line" />
          <p><strong>Payment:</strong> {paymentLabel}</p>
          <p><strong>Total:</strong> {money(order.total)}</p>
          <p><strong>Prepare By:</strong> {end ? new Date(end).toLocaleString("en-IN") : "After acceptance"}</p>
          <div className="kot-line" />
          <span className={`kot-status status-${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
        </section>

        <section className="print-slip delivery-slip">
          <div className="kot-header"><h2>SUGAR CAFE</h2><p>DELIVERY PARTNER HANDOVER</p></div>
          <div className="kot-line" />
          <div className="handover-order-id"><span>ORDER / KOT</span><strong>#{label(order)}</strong></div>
          <div className={`payment-highlight ${isPrepaid ? "payment-prepaid" : "payment-cod"}`}><span>PAYMENT</span><strong>{paymentLabel}</strong><b>₹{order.total || 0}</b></div>
          <div className="kot-line" />
          <h3>CUSTOMER DETAILS</h3>
          <p><strong>Name:</strong> {order.customerName || order.name || "Customer"}</p>
          <p><strong>Phone:</strong> {order.phone || order.mobile || "—"}</p>
          <p><strong>Address:</strong> {address}</p>
          {order.landmark && <p><strong>Landmark:</strong> {order.landmark}</p>}
          <div className="kot-line" />
          <p><strong>Delivery Type:</strong> {order.orderType || "Delivery"}</p>
          <p><strong>OTP:</strong> <span className="delivery-otp">{order.deliveryOtp || order.otp || "—"}</span></p>
          <p><strong>Total:</strong> ₹{order.total || 0}</p>
          <div className="handover-warning">{isPrepaid ? "✓ PAYMENT RECEIVED — DO NOT COLLECT CASH" : "⚠ COLLECT CASH FROM CUSTOMER — CASH ON DELIVERY"}</div>
          <div className="kot-line" /><p className="handover-sign">Delivery Partner Signature: __________________</p>
        </section>

        <div className="screen-actions">
          <div className="kot-preparation">
            <h3>⏱ PREPARATION</h3>
            {status === "Preparing" && <><div className="kot-timer">{timeLeft}</div><p className="kot-timer-label">{remainingSeconds > 0 ? "Preparation time remaining" : "⚠️ Preparation time completed"}</p><button className="food-ready-btn" onClick={markFoodReady} disabled={saving}>🍽️ FOOD READY</button></>}
            {status === "Food Ready" && <button className="dispatch-btn" onClick={dispatchOrder} disabled={saving}>🚴 DISPATCH ORDER</button>}
            {status === "Dispatched" && <button className="delivered-btn" onClick={markDelivered} disabled={saving}>✅ MARK DELIVERED</button>}
            {status === "Delivered" && <div className="kot-delivered-message">✅ Order Delivered</div>}
          </div>
          <div className="kot-buttons"><button onClick={() => printKOT()} disabled={saving}>🖨️ PRINT 2 SLIPS</button><button onClick={onClose}>Close</button></div>
        </div>
      </div>
    </div>
  );
}
