import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import "../css/login.css";

export default function AdminLogin(){
 const navigate=useNavigate(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [loading,setLoading]=useState(false);
 const submit=async(e)=>{e.preventDefault(); setLoading(true); try{await signInWithEmailAndPassword(auth,email.trim(),password); navigate("/admin");}catch(err){alert(err.code||"Admin login failed");}finally{setLoading(false)}};
 return <div className="login-page"><div className="login-box"><h1>☕ Sugar Cafe</h1><p>Professional Dashboard</p><form onSubmit={submit}><input type="email" placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="login-btn" disabled={loading}>{loading?"Signing in…":"Login"}</button></form></div></div>;
}
