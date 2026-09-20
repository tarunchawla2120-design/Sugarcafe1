import { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/admin/Sidebar";

export default function AdminOffers(){
 const [offers,setOffers]=useState([]); const [name,setName]=useState(""); const [discount,setDiscount]=useState(""); const [saving,setSaving]=useState(false);
 useEffect(()=>onSnapshot(collection(db,"offers"),s=>setOffers(s.docs.map(d=>({id:d.id,...d.data()})))),[]);
 const add=async()=>{if(!name.trim()) return alert("Offer name required"); setSaving(true); try{await addDoc(collection(db,"offers"),{name:name.trim(),discount:Number(discount)||0,active:true,createdAt:Timestamp.now()});setName("");setDiscount("");}catch(e){alert(e.message)}finally{setSaving(false)}};
 return <div className="dashboard"><Sidebar/><main className="main" style={{padding:24}}><h1>🎁 Offers</h1><p>Manage customer offers from the admin dashboard.</p><div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"20px 0"}}><input placeholder="Offer name" value={name} onChange={e=>setName(e.target.value)} style={{padding:12}}/><input type="number" placeholder="Discount %" value={discount} onChange={e=>setDiscount(e.target.value)} style={{padding:12,width:140}}/><button onClick={add} disabled={saving} style={{padding:"12px 18px"}}>{saving?"Saving…":"Add Offer"}</button></div><div style={{display:"grid",gap:12}}>{offers.map(o=><div key={o.id} style={{background:"#fff",padding:16,borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span><b>{o.name}</b> — {o.discount||0}% off</span><button onClick={()=>deleteDoc(doc(db,"offers",o.id))}>Delete</button></div>)}</div></main></div>;}
