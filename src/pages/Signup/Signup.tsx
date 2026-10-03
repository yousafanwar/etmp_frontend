import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Icon from "../../components/common/Icon";
import { ApiError, tokenStore } from "../../api/client";
import { signup } from "../../services/authService";
import { getRoles } from "../../services/userService";
import type { Role } from "../../types/user";
import "../Login/Login.css";
import "./Signup.css";

const MIN_PASSWORD_LENGTH = 10;

const Signup = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<number | "">("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getRoles(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        const normalized = Array.isArray(list) ? list : [];
        setRoles(normalized);
        if (normalized.length > 0) {
          setRoleId((current) => (current === "" ? normalized[0].id : current));
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Unable to load roles. Please try again.";
        setRolesError(message);
      });

    return () => controller.abort();
  }, []);

  if (tokenStore.getAccess()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (roleId === "") {
      setError("Please select a role.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        roleId,
        password,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to create account. Please try again.";
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
        <section className="login-card signup-card">
          <h1 className="login-title">Create your ETMP account</h1>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="signup-name-row">
              <div className="login-field">
                <label htmlFor="signup-first-name" className="login-label">
                  First name
                </label>
                <div className="login-input-wrap">
                  <Icon name="person" size={20} className="login-input-icon" />
                  <input
                    id="signup-first-name"
                    type="text"
                    autoComplete="given-name"
                    placeholder="Alex"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={50}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="signup-last-name" className="login-label">
                  Last name
                </label>
                <div className="login-input-wrap">
                  <Icon name="person" size={20} className="login-input-icon" />
                  <input
                    id="signup-last-name"
                    type="text"
                    autoComplete="family-name"
                    placeholder="Morgan"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={50}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="signup-email" className="login-label">
                Work Email
              </label>
              <div className="login-input-wrap">
                <Icon name="mail" size={20} className="login-input-icon" />
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="alex.morgan@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={150}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="signup-role" className="login-label">
                Role
              </label>
              <div className="login-input-wrap signup-select-wrap">
                <Icon name="badge" size={20} className="login-input-icon" />
                <select
                  id="signup-role"
                  className="signup-select"
                  value={roleId === "" ? "" : String(roleId)}
                  onChange={(e) =>
                    setRoleId(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  required
                  disabled={submitting || roles.length === 0}
                >
                  {roles.length === 0 ? (
                    <option value="">Loading roles…</option>
                  ) : (
                    roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))
                  )}
                </select>
                <Icon name="expand_more" size={20} className="signup-select-chevron" />
              </div>
              {rolesError && (
                <p className="signup-field-hint" role="alert">
                  {rolesError}
                </p>
              )}
            </div>

            <div className="login-field">
              <label htmlFor="signup-password" className="login-label">
                Password
              </label>
              <div className="login-input-wrap">
                <Icon name="key" size={20} className="login-input-icon" />
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  maxLength={100}
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

            <div className="login-field">
              <label htmlFor="signup-confirm-password" className="login-label">
                Confirm password
              </label>
              <div className="login-input-wrap">
                <Icon name="key" size={20} className="login-input-icon" />
                <input
                  id="signup-confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  maxLength={100}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={submitting || roles.length === 0}
            >
              {submitting ? "Creating account…" : "Create account"}
              {!submitting && <Icon name="arrow_forward" size={18} />}
            </button>
          </form>

          <div className="login-card-footer">
            <span>Already have an ETMP account?</span>{" "}
            <Link to="/login" className="login-create-link">
              Sign in
              <Icon name="arrow_forward" size={14} />
            </Link>
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

export default Signup;
