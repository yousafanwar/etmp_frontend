import { useAuth } from "../../auth/AuthContext";
import "./TopbarUser.css";

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const TopbarUser = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="topbar-user" aria-busy="true">
        <div className="topbar-user-avatar" aria-hidden="true">
          …
        </div>
        <div className="topbar-user-meta">
          <span className="topbar-user-name">Loading…</span>
          <span className="topbar-user-role"> </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="topbar-user">
      <div className="topbar-user-avatar" aria-hidden="true">
        {getInitials(user.displayName)}
      </div>
      <div className="topbar-user-meta">
        <span className="topbar-user-name">{user.displayName}</span>
        <span className="topbar-user-role">{user.roleName || user.email}</span>
      </div>
    </div>
  );
};

export default TopbarUser;
