import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import "./ApprovedReviews.css";

export default function ApprovedReviews(){
  const [reviews,setReviews]=useState([]);
  useEffect(()=>onSnapshot(query(collection(db,"reviews"),where("approved","==",true),orderBy("createdAt","desc"),limit(8)),s=>setReviews(s.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error("Reviews:",e)),[]);
  if(!reviews.length) return null;
  const avg=(reviews.reduce((a,r)=>a+Number(r.rating||0),0)/reviews.length).toFixed(1);
  return <section className="approved-reviews"><div className="approved-reviews-head"><div><span>SUGARCAFE CUSTOMERS</span><h2>What our customers say</h2><p>Real feedback from recent delivered orders.</p></div><div className="approved-average"><strong>★ {avg}</strong><small>Customer rating</small></div></div><div className="approved-review-grid">{reviews.map(r=><article key={r.id} className="approved-review-card"><div className="approved-review-stars">{"★".repeat(Number(r.rating||0))}{"☆".repeat(Math.max(0,5-Number(r.rating||0)))}</div><p>{r.comment || "Loved the SugarCafe experience!"}</p><strong>{r.customerName || "Customer"}</strong><small>Verified order</small></article>)}</div></section>;
}
