import { NavLink } from "react-router-dom";
import Icon from "../common/Icon";
import "./Sidebar.css";

interface NavItem {
  label: string;
  icon: string;
  to: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: "grid_view", to: "/dashboard" },
  { label: "Projects", icon: "view_kanban", to: "/projects" },
  { label: "Tasks", icon: "check_box", to: "/tasks" },
  { label: "Team & Users", icon: "group", to: "/team" },
  { label: "Settings", icon: "settings", to: "/settings" },
];

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <span className="sidebar-logo">
            <Icon name="done_all" size={20} />
          </span>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">ETMP</span>
          </div>
        </div>

        {/* Workspace switcher */}
        <button type="button" className="workspace-switcher">
          <span className="workspace-avatar">A</span>
          <span className="workspace-text">
            <span className="workspace-name">Omni Soft</span>
            <span className="workspace-plan">Enterprise Services</span>
          </span>
          <Icon name="unfold_more" size={18} className="workspace-chevron" />
        </button>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "is-active" : ""}`
              }
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="sidebar-bottom">
        <div className="usage-card">
          <div className="usage-row">
            <span className="usage-label">Workspace Storage</span>
            <span className="usage-value">84%</span>
          </div>
          <div className="usage-track">
            <div className="usage-fill" style={{ width: "84%" }} />
          </div>
          <div className="usage-row usage-row-seats">
            <span className="usage-label usage-label-sm">Seats Allocated</span>
            <span className="usage-value usage-value-sm">142 / 200</span>
          </div>
        </div>

        <div className="sidebar-footer-row">
          <a href="/help" className="help-link">
            <Icon name="help" size={16} />
            Help &amp; Docs
          </a>
          <span className="version-tag">v2.8.4</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;