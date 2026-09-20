import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useStoreSettings } from "../context/StoreContext";
import Sidebar from "../components/admin/Sidebar";
import "./AdminOrders.css";

const STATUS = ["All", "New", "Preparing", "Food Ready", "Dispatched", "Delivered", "Rejected"];

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}
function money(value) { return `₹${Number(value || 0).toLocaleString("en-IN")}`; }
function label(order) { return order.orderNumber || order.id?.slice(-8).toUpperCase() || "—"; }
function itemsFor(order) { return order.items || order.cart || []; }
function addressFor(order) { return typeof order.address === "string" ? order.address : order.address?.fullAddress || order.address?.address || "Address not available"; }

function KOTModal({ order, onClose, onPrint }) {
  if (!order) return null;
  const items = itemsFor(order);
  const created = toMillis(order.createdAt);
  const date = created ? new Date(created) : new Date();
  return <div className="sc-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="sc-kot-modal">
      <div className="sc-kot-head"><div><b>☕ SUGAR CAFE</b><span>KITCHEN ORDER TICKET</span></div><button onClick={onClose}>×</button></div>
      <div className="sc-kot-meta"><b>#{label(order)}</b><span>{date.toLocaleDateString("en-IN")} · {date.toLocaleTimeString("en-IN", {hour:"2-digit", minute:"2-digit"})}</span><em>{order.orderType || "Delivery"}</em></div>
      <section><small>CUSTOMER</small><strong>{order.customerName || order.name || "Customer"}</strong><div>{order.phone || order.mobile || "—"}</div><div>{addressFor(order)}</div></section>
      <section><small>ORDER ITEMS</small>{items.length ? items.map((item, i) => { const qty = Number(item.qty || item.quantity || 1); return <div className="kot-item" key={item.id || i}><span>{item.name || "Food Item"} ×{qty}</span><b>{money(Number(item.price || 0) * qty)}</b></div>; }) : <div>No items found.</div>}</section>
      {order.instructions && <div className="kot-note"><b>Note:</b> {order.instructions}</div>}
      <div className="kot-total"><span>Total</span><b>{money(order.total)}</b></div>
      <div className="kot-actions"><button onClick={() => onPrint(order)}>🖨 Print KOT</button><button className="dark" onClick={onClose}>Close</button></div>
    </div>
  </div>;
}

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newOrder, setNewOrder] = useState(null);
  const [kotOrder, setKotOrder] = useState(null);
  const [now, setNow] = useState(Date.now());
  const store = useStoreSettings();
  const buzzedPreparation = useRef(new Set());
  const knownIds = useRef(new Set());
  const firstSnapshot = useRef(true);
  const alarmRef = useRef(null);

  const playBell = () => {
    if (store.buzzerEnabled === false) return;
    try {
      if (!alarmRef.current) alarmRef.current = new Audio("/alarm_bell.mp3");
      alarmRef.current.currentTime = 0;
      alarmRef.current.volume = 1;
      const p = alarmRef.current.play();
      if (p?.catch) p.catch(() => {});
    } catch (_) {}
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "orders"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a,b) => (toMillis(b.createdAt)||0) - (toMillis(a.createdAt)||0));
      setOrders(data); setLoading(false);
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !firstSnapshot.current && !knownIds.current.has(change.doc.id)) {
          const incoming = { id: change.doc.id, ...change.doc.data() };
          if ((incoming.status || "New") === "New") { setNewOrder(incoming); playBell(); }
        }
        knownIds.current.add(change.doc.id);
      });
      firstSnapshot.current = false;
    }, (err) => { console.error(err); setError("Orders load nahi ho paaye. Firebase connection/rules check karein."); setLoading(false); });
    return () => unsub();
  }, []);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (store.buzzerEnabled === false) return;
    orders.forEach((order) => {
      if ((order.status || "New") !== "Preparing") return;
      const end = toMillis(order.preparationEndAt);
      if (!end || end > now || buzzedPreparation.current.has(order.id)) return;
      buzzedPreparation.current.add(order.id);
      playBell();
    });
  }, [now, orders, store.buzzerEnabled]);
  useEffect(() => () => { if (alarmRef.current) { alarmRef.current.pause(); alarmRef.current = null; } }, []);

  const updateOrder = async (order, updates) => {
    try {
      await updateDoc(doc(db, "orders", order.id), updates);
      if (newOrder?.id === order.id) setNewOrder(null);
      return true;
    } catch (e) { console.error(e); alert("Order update nahi ho paya."); return false; }
  };

  const printKOT = async (order) => {
    try {
      if (window.electronAPI?.printKOT) {
        const result = await window.electronAPI.printKOT(order);
        if (!result?.success) console.error("KOT print failed:", result?.failureReason);
        return result?.success;
      }
      alert("Automatic KOT printing ke liye SugarCafe Dashboard app open karein. Chrome browser se silent printing possible nahi hai.");
      return false;
    } catch (e) {
      console.error("KOT print error:", e);
      return false;
    }
  };

  const accept = async (order) => {
    const minutes = Number(order.preparationMinutes ?? 15);
    const started = Date.now();
    const end = started + minutes * 60000;
    const accepted = await updateOrder(order, {status:"Preparing", acceptedAt:Timestamp.fromMillis(started), preparationStartedAt:Timestamp.fromMillis(started), preparationEndAt:Timestamp.fromMillis(end), preparationMinutes:minutes, rejectedAt:null});
    if (accepted) {
      const printPayload = { ...order, status: "Preparing", acceptedAt: { seconds: Math.floor(started/1000) }, preparationStartedAt: { seconds: Math.floor(started/1000) }, preparationEndAt: { seconds: Math.floor(end/1000) }, preparationMinutes: minutes };
      let printed = false;
      for (let attempt = 1; attempt <= 3 && !printed; attempt += 1) {
        printed = await printKOT(printPayload);
        if (!printed && attempt < 3) await new Promise((resolve) => setTimeout(resolve, 900));
      }
      if (!printed) alert("Order accepted, but KOT print failed. Check that TVS-E RP 3230 is connected and the SugarCafe Dashboard app is running.");
    }
  };
  const reject = (order) => { const reason = window.prompt("Reject reason (optional):", "Unable to accept this order"); return updateOrder(order, {status:"Rejected", rejectionReason:reason || "Order rejected by staff", rejectedAt:Timestamp.now()}); };
  const extra = (order) => { const mins = Number(order.extraPreparationMinutes ?? 10); const base = toMillis(order.preparationEndAt) || now; return updateOrder(order, {preparationEndAt:Timestamp.fromMillis(base + mins*60000), extraTimeAdded:mins}); };
  const ready = (order) => updateOrder(order, {status:"Food Ready", foodReadyAt:Timestamp.now()});
  const dispatch = (order) => updateOrder(order, {status:"Dispatched", dispatchedAt:Timestamp.now()});
  const delivered = (order) => updateOrder(order, {status:"Delivered", deliveredAt:Timestamp.now()});
  const verifyUpi = (order) => updateOrder(order, {paymentStatus:"Paid", paymentVerifiedAt:Timestamp.now()});

  const counts = useMemo(() => STATUS.reduce((a,s) => { a[s] = s === "All" ? orders.length : orders.filter(o => (o.status || "New") === s).length; return a; }, {}), [orders]);
  const filtered = useMemo(() => orders.filter(o => { const q=query.trim().toLowerCase(); const status=o.status||"New"; return (filter==="All"||status===filter) && (!q || [label(o),o.customerName,o.phone,addressFor(o),o.orderType].join(" ").toLowerCase().includes(q)); }), [orders,filter,query]);
  const remaining = (order) => { const end=toMillis(order.preparationEndAt); if(!end) return "15:00"; const sec=Math.max(0,Math.floor((end-now)/1000)); return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; };
  const acceptRemaining = (order) => { const end=(toMillis(order.createdAt)||now)+Number(order.acceptanceSeconds||60)*1000; const sec=Math.max(0,Math.floor((end-now)/1000)); return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; };

  return <div className="sc-orders-shell"><Sidebar/><main className="sc-orders-main">
    <header className="orders-top"><div><div className="brand-kicker">SUGAR CAFE · LIVE CONTROL</div><h1>Orders</h1><p>Every order, status and kitchen action in one place.</p></div><div className="top-actions"><div className="store-status"><i className={(store.isOpen && store.acceptingOrders && store.inHours)?"on":"off"}></i>{(store.isOpen && store.acceptingOrders && store.inHours)?"Delivery Open":"Delivery Closed"}<small>{store.orderTimingLabel}</small></div><button className="notification-button" onClick={playBell}>🔔<b>{counts.New||0}</b></button></div></header>
    <section className="order-toolbar"><div className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search order, customer, phone or address"/></div><button className="today">Today ▾</button></section>
    <section className="status-tabs">{STATUS.map(s=><button key={s} className={filter===s?`active ${s.toLowerCase().replace(" ","-")}`:""} onClick={()=>setFilter(s)}>{s==="All"?"All Orders":s}<b>{counts[s]||0}</b></button>)}</section>
    {error && <div className="error-banner">⚠️ {error}</div>}
    {loading ? <div className="empty-card">Loading live orders…</div> : filtered.length===0 ? <div className="empty-card"><div>📦</div><h2>No orders found</h2><p>New customer orders will appear here automatically.</p></div> : <div className="orders-grid">{filtered.map(order=>{ const status=order.status||"New"; const items=itemsFor(order); const created=toMillis(order.createdAt); const expired=toMillis(order.preparationEndAt)!=null && toMillis(order.preparationEndAt)<=now; return <article className={`order-card ${status.toLowerCase().replace(/\s+/g,"-")}`} key={order.id}>
      <div className="order-main"><div className="order-head"><div><span className="order-no">#{label(order)}</span><span className={`status-badge ${status.toLowerCase().replace(/\s+/g,"-")}`}>{status}</span></div><span className="order-time">{created?new Date(created).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"—"}</span></div><div className="customer-block"><strong>{order.customerName||order.name||"Customer"}</strong><span>☎ {order.phone||order.mobile||"—"}</span><span>📍 {order.orderType||"Delivery"} · {addressFor(order)}</span></div></div>
      <div className="items-block">{items.slice(0,5).map((item,i)=>{const qty=Number(item.qty||item.quantity||1);return <div className="item-row" key={item.id||i}><span>{item.name||"Food Item"} <small>×{qty}</small></span><strong>{money(Number(item.price||0)*qty)}</strong></div>})}{items.length>5&&<span className="more">+{items.length-5} more items</span>}<div className="total-row"><span>Total</span><strong>{money(order.total)}</strong></div><div className="payment">{order.paymentMethod||"Cash on Delivery"} · <b className={order.paymentStatus==="Paid"?"paid":"pending"}>{order.paymentStatus||"Pending"}</b></div></div>
      <div className="action-block">{status==="New"&&<><div className="timer acceptance"><span>Accept within</span><strong>{acceptRemaining(order)}</strong></div><button className="action accept" onClick={()=>accept(order)}>✓ Accept Order</button><button className="action reject" onClick={()=>reject(order)}>✕ Reject</button></>}{status==="Preparing"&&<><div className={`timer preparation ${expired?"expired":""}`}><span>{expired?"Time completed":"Kitchen Timer"}</span><strong>{remaining(order)}</strong></div><div className="action-row"><button className="action extra" onClick={()=>extra(order)}>+10 Min</button><button className="action ready" onClick={()=>ready(order)}>Mark Ready</button></div></>}{status==="Food Ready"&&<><button className="action dispatch" onClick={()=>dispatch(order)}>🛵 Dispatch</button><button className="action outline" onClick={()=>setKotOrder(order)}>🧾 View KOT</button></>}{status==="Dispatched"&&<button className="action ready" onClick={()=>delivered(order)}>✓ Mark Delivered</button>}{status==="Delivered"&&<button className="action outline" onClick={()=>setKotOrder(order)}>🧾 View KOT</button>}{status==="Rejected"&&<div className="rejected">Rejected · {order.rejectionReason||"Staff rejected"}</div>}{order.paymentMethod==="UPI Payment"&&order.paymentStatus!=="Paid"&&status!=="Rejected"&&<button className="action payment-btn" onClick={()=>verifyUpi(order)}>💳 Mark UPI Paid</button>}</div>
    </article>})}</div>}
  </main>
  {newOrder&&<div className="new-order-overlay"><div className="new-order-alert"><button className="alert-close" onClick={()=>setNewOrder(null)}>×</button><div className="new-icon">🔔</div><div><span>NEW ORDER RECEIVED</span><h2>Order #{label(newOrder)}</h2><p>{newOrder.customerName||newOrder.name||"Customer"} · {money(newOrder.total)}</p></div><div className="alert-actions"><button className="action accept big" onClick={()=>accept(newOrder)}>✓ ACCEPT ORDER</button><button className="action reject big" onClick={()=>reject(newOrder)}>✕ REJECT</button><button className="action outline big" onClick={()=>{setKotOrder(newOrder);setNewOrder(null)}}>🧾 VIEW KOT</button></div></div></div>}
  <KOTModal order={kotOrder} onClose={()=>setKotOrder(null)} onPrint={printKOT}/>
  </div>;
}
export default AdminOrders;
