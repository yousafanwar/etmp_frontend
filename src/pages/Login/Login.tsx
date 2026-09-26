import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Icon from "../../components/common/Icon";
import { ApiError, tokenStore } from "../../api/client";
import { login } from "../../services/authService";
import "./Login.css";

const GoogleIcon = () => (
  <svg className="login-google-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (tokenStore.getAccess()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to sign in. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

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

        <div className="login-topbar-actions">
          <button type="button" className="login-lang-btn">
            <Icon name="language" size={18} />
            <span>EN (US)</span>
            <Icon name="expand_more" size={18} />
          </button>
          <a href="#support" className="login-support-link">
            <Icon name="help" size={18} />
            Support
          </a>
        </div>
      </header>

      <main className="login-main">
        <section className="login-card">
          <h1 className="login-title">Sign in to ETMP</h1>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">
                Work Email
              </label>
              <div className="login-input-wrap">
                <Icon name="mail" size={20} className="login-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="alex.morgan@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="login-password" className="login-label">
                  Password
                </label>
                <a href="#forgot" className="login-forgot">
                  Forgot password?
                </a>
              </div>
              <div className="login-input-wrap">
                <Icon name="key" size={20} className="login-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="login-visibility-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon name={showPassword ? "visibility" : "visibility_off"} size={20} />
                </button>
              </div>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
              {!submitting && <Icon name="arrow_forward" size={18} />}
            </button>
          </form>

          <button type="button" className="login-google" disabled={submitting}>
            <GoogleIcon />
            Sign in with Google
          </button>

          <div className="login-card-footer">
            <span>Don&apos;t have an ETMP account?</span>{" "}
            <a href="#register" className="login-create-link">
              Create an account
              <Icon name="arrow_forward" size={14} />
            </a>
          </div>
        </section>
      </main>

      <footer className="login-footer">
        <p className="login-copyright">
          © 2025 ETMP Technologies Inc. All rights reserved.
        </p>
        <nav className="login-footer-links" aria-label="Legal">
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms of Service</a>
          <a href="#security">Security Whitepaper</a>
          <a href="#contact">Contact Support</a>
        </nav>
      </footer>
    </div>
  );
};

export default Login;
