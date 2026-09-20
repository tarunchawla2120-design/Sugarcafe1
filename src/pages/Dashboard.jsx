import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/admin/Sidebar";
import DashboardHeader from "../components/admin/DashboardHeader";
import StatsCards from "../components/admin/StatsCards";
import MenuManager from "../components/admin/MenuManager";
import KOT from "../components/admin/KOT";
import "../css/dashboard.css";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const ms = (v) => v?.toMillis?.() ?? (typeof v?.seconds === "number" ? v.seconds * 1000 : new Date(v || 0).getTime());

export default function Dashboard() {
  const [menuCount,setMenuCount]=useState(0), [categoryCount,setCategoryCount]=useState(0), [orderCount,setOrderCount]=useState(0), [revenue,setRevenue]=useState(0);
  const [showModal,setShowModal]=useState(false), [newOrder,setNewOrder]=useState(null), [recent,setRecent]=useState([]);
  const first=useRef(true), known=useRef(new Set()), audio=useRef(null);

  const playBell=()=>{try{if(!audio.current)audio.current=new Audio("/alarm_bell.mp3");audio.current.currentTime=0;audio.current.volume=1;audio.current.play().catch(()=>{});}catch(_){}};
  const load=async()=>{try{const [m,c,o]=await Promise.all([getDocs(collection(db,"menu")),getDocs(collection(db,"categories")),getDocs(collection(db,"orders"))]);setMenuCount(m.size);setCategoryCount(c.size);setOrderCount(o.size);let r=0;o.forEach(d=>r+=Number(d.data().total||0));setRevenue(r);}catch(e){console.error(e)}};
  useEffect(()=>{load();const unsub=onSnapshot(collection(db,"orders"),snap=>{const list=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>ms(b.createdAt)-ms(a.createdAt));setRecent(list.slice(0,6));if(!first.current){snap.docChanges().forEach(ch=>{if(ch.type==="added"&&!known.current.has(ch.doc.id)){const o={id:ch.doc.id,...ch.doc.data()};if((o.status||"New")==="New"){setNewOrder(o);playBell();if("Notification" in window&&Notification.permission==="granted")new Notification("SugarCafe — New Order",{body:`Order #${o.orderNumber||o.id.slice(-6).toUpperCase()} received`});}}known.current.add(ch.doc.id);});}else snap.docs.forEach(d=>known.current.add(d.id));first.current=false;load();},e=>console.error(e));return()=>unsub()},[]);
  const counts=useMemo(()=>recent.reduce((a,o)=>{const s=o.status||"New";a[s]=(a[s]||0)+1;return a},{}),[recent]);
  return <div className="dashboard dashboard-v2"><Sidebar/><main className="main admin-main"><DashboardHeader onAdd={()=>setShowModal(true)}/>
    <div className="welcome-row"><div><span className="dashboard-kicker">SUGAR CAFE · CONTROL CENTER</span><h2>Today at a glance</h2><p>Monitor orders, kitchen progress and your store in one place.</p></div><button className="sound-test" onClick={playBell}>🔔 Test Buzzer</button></div>
    <StatsCards menuCount={menuCount} categoryCount={categoryCount} orderCount={orderCount} revenue={revenue}/>
    <section className="overview-grid"><div className="panel quick-panel"><div className="panel-head"><div><h3>Order Pipeline</h3><span>Live status overview</span></div><a href="/admin/orders">View Orders →</a></div><div className="pipeline">{[["New","🔴"],["Preparing","🍳"],["Food Ready","🟢"],["Dispatched","🛵"],["Delivered","✓"]].map(([s,i])=><div key={s}><b>{i}</b><strong>{s}</strong><span>{s==="New"?counts.New||0:"—"}</span></div>)}</div></div><div className="panel store-panel"><div className="panel-head"><div><h3>Store Status</h3><span>Live controls</span></div><span className="live-dot">● LIVE</span></div><div className="store-lines"><div><span>Website / Store</span><b>Open</b></div><div><span>Accepting Orders</span><b>ON</b></div><div><span>Kitchen Timer</span><b>15 min</b></div><div><span>Extra Time</span><b>+10 min</b></div></div></div></section>
    <section className="panel recent-panel"><div className="panel-head"><div><h3>Recent Orders</h3><span>Latest activity from Firebase</span></div><a href="/admin/orders">Open full orders →</a></div>{recent.length===0?<div className="no-recent">No orders yet.</div>:<div className="recent-table"><div className="recent-row recent-head"><span>Order</span><span>Customer</span><span>Status</span><span>Total</span></div>{recent.map(o=><div className="recent-row" key={o.id}><b>#{o.orderNumber||o.id.slice(-6).toUpperCase()}</b><span>{o.customerName||o.name||"Customer"}</span><span className={`mini-status ${String(o.status||"New").toLowerCase().replace(/\s+/g,"-")}`}>{o.status||"New"}</span><strong>{money(o.total)}</strong></div>)}</div>}</section>
    <div className="dashboard-menu-section"><div className="section-title"><div><h3>Menu Management</h3><span>Add, edit, remove and control menu items without leaving the dashboard.</span></div><button onClick={()=>setShowModal(true)}>+ Add Menu Item</button></div><MenuManager showModal={showModal} setShowModal={setShowModal}/></div>
  </main>{newOrder&&<KOT order={newOrder} onClose={()=>setNewOrder(null)}/>}</div>;
}
