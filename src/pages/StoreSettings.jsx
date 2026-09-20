import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/admin/Sidebar";
import "../css/dashboard.css";

const defaults={isOpen:true,acceptingOrders:true,upiEnabled:true,codEnabled:true,buzzerEnabled:true,maxDeliveryDistanceKm:10,deliveryPerKm:20,minDeliveryCharge:20,maxDeliveryCharge:300,preparationMinutes:15,extraPreparationMinutes:10,acceptanceSeconds:60,orderStartTime:"12:00",orderEndTime:"21:30",announcement:""};

export default function StoreSettings(){
  const [s,setS]=useState(defaults);
  const [saving,setSaving]=useState(false);
  useEffect(()=>onSnapshot(doc(db,"settings","store"),x=>setS({...defaults,...(x.exists()?x.data():{})})),[]);
  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"settings","store"),{...s,maxDeliveryDistanceKm:10,updatedAt:Timestamp.now()},{merge:true});
      alert("Live website settings updated.");
    }catch(e){alert(e.message)}finally{setSaving(false)}
  };
  const toggle=(k)=><button type="button" onClick={()=>setS({...s,[k]:!s[k]})} className={s[k]?"setting-on":"setting-off"}>{s[k]?"ON":"OFF"}</button>;
  return <div className="dashboard"><Sidebar/><main className="main" style={{padding:24}}>
    <h1>⚙️ Live Website Control</h1>
    <p>Website status, delivery timing and payment controls are synced to the customer website in realtime.</p>
    <div className="settings-grid">
      <div className="setting-card"><span>🌐 Website / Store</span>{toggle("isOpen")}</div>
      <div className="setting-card"><span>📦 Accept Orders</span>{toggle("acceptingOrders")}</div>
      <div className="setting-card"><span>💳 UPI Payments</span>{toggle("upiEnabled")}</div>
      <div className="setting-card"><span>💵 Cash on Delivery</span>{toggle("codEnabled")}</div>
      <div className="setting-card"><span>🔔 Dashboard Buzzer</span>{toggle("buzzerEnabled")}</div>
      <label className="setting-card"><span>🕛 Delivery Start Time</span><input type="time" value={s.orderStartTime} onChange={e=>setS({...s,orderStartTime:e.target.value})}/></label>
      <label className="setting-card"><span>🕤 Delivery End Time</span><input type="time" value={s.orderEndTime} onChange={e=>setS({...s,orderEndTime:e.target.value})}/></label>
      <div className="setting-card wide timing-preview"><strong>🚚 Customer Delivery Timing</strong><b>{formatTime(s.orderStartTime)} – {formatTime(s.orderEndTime)}</b><small>Outside this time the customer can browse, but delivery orders cannot be placed.</small></div>
      <label className="setting-card">Delivery radius (KM)<input type="number" value={10} readOnly/></label>
      <label className="setting-card">Delivery ₹ / KM<input type="number" value={s.deliveryPerKm} onChange={e=>setS({...s,deliveryPerKm:Number(e.target.value)})}/></label>
      <label className="setting-card">Min delivery charge<input type="number" value={s.minDeliveryCharge} onChange={e=>setS({...s,minDeliveryCharge:Number(e.target.value)})}/></label>
      <label className="setting-card">Max delivery charge<input type="number" value={s.maxDeliveryCharge} onChange={e=>setS({...s,maxDeliveryCharge:Number(e.target.value)})}/></label>
      <label className="setting-card">Kitchen minutes<input type="number" value={s.preparationMinutes} onChange={e=>setS({...s,preparationMinutes:Number(e.target.value)})}/></label>
      <label className="setting-card">Extra minutes<input type="number" value={s.extraPreparationMinutes} onChange={e=>setS({...s,extraPreparationMinutes:Number(e.target.value)})}/></label>
      <label className="setting-card">Accept/Reject seconds<input type="number" value={s.acceptanceSeconds} onChange={e=>setS({...s,acceptanceSeconds:Number(e.target.value)})}/></label>
      <label className="setting-card wide">Customer announcement<textarea value={s.announcement} onChange={e=>setS({...s,announcement:e.target.value})}/></label>
    </div>
    <button className="save-settings" onClick={save} disabled={saving}>{saving?"Saving…":"💾 Save Live Settings"}</button>
  </main></div>
}

function formatTime(value) {
  const [h,m]=String(value||"00:00").split(":").map(Number);
  const d=new Date(); d.setHours(Number.isFinite(h)?h:0,Number.isFinite(m)?m:0,0,0);
  return d.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"});
}
