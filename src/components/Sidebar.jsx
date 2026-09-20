import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import "../../css/Sidebar.css";

function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menus = [
    {
      name: "Dashboard",
      icon: "🏠",
      path: "/admin",
    },

    {
      name: "Menu",
      icon: "🍔",
      path: "/admin",
    },

    {
      name: "Categories",
      icon: "📂",
      path: "/admin",
    },

    {
      name: "Orders",
      icon: "📦",
      path: "/admin",
    },

    {
      name: "Offers",
      icon: "🎁",
      path: "/admin",
    },

    {
      name: "Settings",
      icon: "⚙️",
      path: "/admin",
    },
  ];

  return (
    <>
      {/* MOBILE MENU BUTTON */}

      <button
        className="menu-btn"
        onClick={() =>
          setCollapsed(!collapsed)
        }
      >
        ☰
      </button>

      {/* SIDEBAR */}

      <aside
        className={`admin-sidebar ${
          collapsed ? "collapsed" : ""
        }`}
      >

        {/* LOGO */}

        <div className="logo">
          ☕{" "}
          {!collapsed && (
            <span>Sugar Cafe</span>
          )}
        </div>

        {/* NAVIGATION */}

        <nav>
          {menus.map((item) => {

            const isActive =
              item.path === "/admin"
                ? location.pathname === "/admin"
                : false;

            return (
              <Link
                key={item.name}
                to={item.path}
                className={
                  isActive
                    ? "active"
                    : ""
                }
              >
                <span>
                  {item.icon}
                </span>

                {!collapsed && (
                  <span>
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

      </aside>
    </>
  );
}

export default Sidebar;