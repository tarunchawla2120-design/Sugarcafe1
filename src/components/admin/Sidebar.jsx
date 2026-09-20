import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import "../../css/Sidebar.css";

function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const menus = [
    { name: "Dashboard", icon: "🏠", path: "/admin" },
    { name: "Menu", icon: "🍔", path: "/admin/menu" },
    { name: "Categories", icon: "📂", path: "/admin/categories" },
    { name: "Orders", icon: "📦", path: "/admin/orders" },
    { name: "Offers", icon: "🎁", path: "/admin/offers" },
    { name: "Reviews", icon: "⭐", path: "/admin/reviews" },
    { name: "Settings", icon: "⚙️", path: "/admin/settings" },
  ];
  return <>
    <button className="menu-btn" onClick={() => setCollapsed(!collapsed)}>☰</button>
    <aside className={`admin-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="logo">☕ {!collapsed && <span>Sugar Cafe</span>}</div>
      <nav>
        {menus.map((item) => {
          const active = item.path === "/admin"
            ? location.pathname === "/admin" || location.pathname === "/admin/dashboard"
            : location.pathname === item.path;
          return <Link key={item.path} to={item.path} className={active ? "active" : ""}>
            <span>{item.icon}</span>{!collapsed && <span>{item.name}</span>}
          </Link>;
        })}
      </nav>
    </aside>
  </>;
}
export default Sidebar;
