import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./ReviewForm.css";

export default function ReviewForm({ order }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDocs(query(collection(db, "reviews"), where("orderId", "==", order.id), where("userId", "==", user.uid)));
        if (active && !snap.empty) setDone(true);
      } catch (_) {}
    };
    check();
    return () => { active = false; };
  }, [order.id]);

  const submit = async () => {
    if (rating < 3) return alert("Please select 3 to 5 stars.");
    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) return alert("Please login to submit a review.");
      await addDoc(collection(db, "reviews"), {
        orderId: order.id,
        orderNumber: order.orderNumber || order.id.slice(-6).toUpperCase(),
        userId: user.uid,
        customerName: order.customerName || user.displayName || "Customer",
        rating,
        approved: false,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      });
      setDone(true);
    } catch (e) {
      alert(e.message || "Review could not be submitted.");
    } finally {
      setSaving(false);
    }
  };

  if (done) return <div className="review-thanks">⭐ Thanks for your review!</div>;

  return <div className="review-box">
    <div className="review-title"><strong>How was your SugarCafe order?</strong><span>Rate your experience · 3–5 stars</span></div>
    <div className="review-stars" aria-label="Rating">
      {[3,4,5].map(n => <button type="button" key={n} className={n <= rating ? "selected" : ""} onClick={() => setRating(n)} aria-label={`${n} stars`}>★</button>)}
    </div>
    <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Tell us what you liked or what we can improve…" maxLength={500} />
    <button className="review-submit" onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit Review"}</button>
  </div>;
}
