import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/admin/Sidebar";
import "./AdminReviews.css";

const dateText = v => { const d = v?.toDate ? v.toDate() : new Date(v || 0); return d.getTime() ? d.toLocaleString("en-IN", {dateStyle:"medium", timeStyle:"short"}) : "—"; };

export default function AdminReviews(){
  const [reviews,setReviews]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>onSnapshot(query(collection(db,"reviews"),orderBy("createdAt","desc")),s=>{setReviews(s.docs.map(d=>({id:d.id,...d.data()})));setLoading(false)},e=>{console.error(e);setLoading(false)}),[]);
  const approved = reviews.filter(r => r.approved === true);
  const avg=useMemo(()=>approved.length?(approved.reduce((a,r)=>a+Number(r.rating||0),0)/approved.length).toFixed(1):"0.0",[approved]);
  const setApproval = async (id, value) => { try { await updateDoc(doc(db,"reviews",id), { approved:value }); } catch(e) { alert(e.message || "Could not update review."); } };
  return <div className="admin-workspace"><Sidebar/><main className="reviews-main"><header className="reviews-head"><div><span>SUGAR CAFE · CUSTOMER VOICE</span><h1>Reviews & Ratings</h1><p>Approve genuine 3–5 star feedback before it appears on the website.</p></div><div className="rating-summary"><b>★ {avg}</b><span>{approved.length} published · {reviews.length} total</span></div></header>
    {loading?<div className="review-empty">Loading reviews…</div>:reviews.length===0?<div className="review-empty"><div>⭐</div><h2>No reviews yet</h2><p>Reviews will appear here after customers rate delivered orders.</p></div>:<section className="review-admin-list">{reviews.map(r=><article className={`admin-review-card ${r.approved ? "is-approved" : "is-pending"}`} key={r.id}><div className="admin-review-top"><div><strong>{r.customerName||"Customer"}</strong><span>Order #{r.orderNumber||r.orderId?.slice(-6)||"—"}</span></div><div className="admin-stars">{"★".repeat(Number(r.rating||0))}{"☆".repeat(Math.max(0,5-Number(r.rating||0)))}</div></div><div className="review-state">{r.approved ? "✓ Published on website" : "● Pending approval"}</div>{r.comment&&<p>“{r.comment}”</p>}<footer><span>{dateText(r.createdAt)}</span><div className="review-actions">{r.approved ? <button className="hide-btn" onClick={()=>setApproval(r.id,false)}>Hide from Website</button> : <button className="approve-btn" onClick={()=>setApproval(r.id,true)}>Approve & Publish</button>}<button className="delete-btn" onClick={()=>deleteDoc(doc(db,"reviews",r.id))}>Delete</button></div></footer></article>)}</section>}
  </main></div>;
}
