import { Link, Navigate } from "react-router-dom";
import Icon from "../../components/common/Icon";
import { tokenStore } from "../../api/client";
import "../Login/Login.css";

const ForgotPassword = () => {
  if (tokenStore.getAccess()) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="login-page">
      <header className="login-topbar">
        <div className="login-brand">
          <div className="login-brand-mark" aria-hidden="true">
            <Icon name="check" size={18} />
          </div>
          <div className="login-brand-text">
            <span className="login-brand-name">ETMP</span>
            <span className="login-brand-tagline">Enterprise Identity</span>
          </div>
        </div>
      </header>

      <main className="login-main">
        <section className="login-card">
          <h1 className="login-title">Forgot your password?</h1>
          <p className="login-forgot-copy">
            Password resets are handled by a workspace administrator. Contact your Admin and ask
            them to set a temporary password from the Team page. After you sign in, change it under
            Settings → Security.
          </p>
          <div className="login-card-footer">
            <Link to="/login" className="login-create-link">
              <Icon name="arrow_back" size={14} />
              Back to sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="login-footer">
        <p className="login-copyright">© 2025 ETMP Technologies Inc. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default ForgotPassword;
