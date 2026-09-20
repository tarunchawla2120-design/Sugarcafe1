import { useState } from "react";
import Sidebar from "../components/admin/Sidebar";
import MenuManager from "../components/admin/MenuManager";
import "./AdminWorkspace.css";
export default function AdminMenu(){const [show,setShow]=useState(false);return <div className="admin-workspace"><Sidebar/><main><div className="workspace-head"><div><span>SUGAR CAFE · CATALOG</span><h1>Menu Management</h1><p>Manage every menu item from inside the dashboard.</p></div><button onClick={()=>setShow(true)}>+ Add Menu Item</button></div><MenuManager showModal={show} setShowModal={setShow}/></main></div>}
