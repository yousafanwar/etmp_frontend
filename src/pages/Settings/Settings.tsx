import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import Icon from "../../components/common/Icon";
import TopbarUser from "../../components/layout/TopbarUser";
import { resetPassword } from "../../services/authService";
import { createSkill, getSkills } from "../../services/skillService";
import {
  addUserSkill,
  getRoles,
  getUsers,
  getUserSkills,
  removeUserSkill,
  updateMyProfile,
  updateUser,
} from "../../services/userService";
import type { Skill, UserSkill } from "../../types/skill";
import type { Role, User } from "../../types/user";
import "./Settings.css";

const MIN_PASSWORD_LENGTH = 10;

type SettingsSection =
  | "profile"
  | "security"
  | "preferences"
  | "skills-catalog"
  | "roles";

const officeKey = (userId: number) => `etmp.officeHub.${userId}`;

const readOffice = (userId: number) => {
  try {
    return localStorage.getItem(officeKey(userId)) ?? "";
  } catch {
    return "";
  }
};

const writeOffice = (userId: number, value: string) => {
  try {
    if (value.trim()) localStorage.setItem(officeKey(userId), value.trim());
    else localStorage.removeItem(officeKey(userId));
  } catch {
    /* ignore quota / private mode */
  }
};

const initials = (first: string, last: string, fallback: string) => {
  const value = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return value.trim() || fallback.slice(0, 2).toUpperCase() || "?";
};

const formatUid = (id: number) => `ETMP-USR-${String(id).padStart(5, "0")}`;

const skillIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("kuber") || n.includes("cloud") || n.includes("aws")) return "cloud";
  if (n.includes("kafka") || n.includes("stream") || n.includes("queue")) return "hub";
  if (n.includes("postgres") || n.includes("sql") || n.includes("data")) return "database";
  if (n.includes("go") || n.includes("c#") || n.includes("java") || n.includes("micro"))
    return "terminal";
  if (n.includes("react") || n.includes("front") || n.includes("ui")) return "web";
  if (n.includes("security") || n.includes("auth")) return "shield";
  if (n.includes("distrib") || n.includes("system") || n.includes("network")) return "device_hub";
  return "psychology";
};

const isAdminRole = (roleName?: string | null) =>
  (roleName ?? "").trim().toLowerCase() === "admin";

const Settings = () => {
  const { user, loading: authLoading, setCurrentUser } = useAuth();
  const [section, setSection] = useState<SettingsSection>("profile");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [office, setOffice] = useState("");
  const [baseline, setBaseline] = useState({
    firstName: "",
    lastName: "",
    office: "",
    skillIds: [] as number[],
  });

  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [catalog, setCatalog] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "valid" | "error">("idle");
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const [newSkillName, setNewSkillName] = useState("");
  const [creatingSkill, setCreatingSkill] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [roleSavingId, setRoleSavingId] = useState<number | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const isAdmin = isAdminRole(user?.roleName);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      getUserSkills(user.id, controller.signal),
      getSkills(controller.signal).catch(() => [] as Skill[]),
    ])
      .then(([skills, allSkills]) => {
        if (controller.signal.aborted) return;
        const list = Array.isArray(skills) ? skills : [];
        const officeValue = readOffice(user.id);
        setUserSkills(list);
        setCatalog(Array.isArray(allSkills) ? allSkills : []);
        setFirstName(user.firstName);
        setLastName(user.lastName);
        setOffice(officeValue);
        setBaseline({
          firstName: user.firstName,
          lastName: user.lastName,
          office: officeValue,
          skillIds: list.map((s) => s.skillId),
        });
        setStatus("idle");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Unable to load settings. Please try again.";
        setError(message);
        setStatus("error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [user?.id]);

  useEffect(() => {
    if (!addOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!addRef.current?.contains(event.target as Node)) setAddOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [addOpen]);

  const availableSkills = useMemo(() => {
    const owned = new Set(userSkills.map((s) => s.skillId));
    return catalog.filter((s) => !owned.has(s.id));
  }, [catalog, userSkills]);

  const dirty = useMemo(() => {
    if (!user) return false;
    const skillIds = [...userSkills.map((s) => s.skillId)].sort((a, b) => a - b);
    const baseIds = [...baseline.skillIds].sort((a, b) => a - b);
    return (
      firstName.trim() !== baseline.firstName.trim() ||
      lastName.trim() !== baseline.lastName.trim() ||
      office.trim() !== baseline.office.trim() ||
      skillIds.length !== baseIds.length ||
      skillIds.some((id, i) => id !== baseIds[i])
    );
  }, [user, firstName, lastName, office, userSkills, baseline]);

  useEffect(() => {
    if (error) {
      setStatus("error");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setStatus("error");
      return;
    }
    setStatus(dirty ? "valid" : "idle");
  }, [dirty, firstName, lastName, error]);

  const discard = () => {
    setFirstName(baseline.firstName);
    setLastName(baseline.lastName);
    setOffice(baseline.office);
    setUserSkills((prev) => {
      const byId = new Map(prev.map((s) => [s.skillId, s]));
      return baseline.skillIds.map((id) => {
        const fromCatalog = catalog.find((s) => s.id === id);
        if (fromCatalog) return { skillId: fromCatalog.id, skillName: fromCatalog.name };
        return byId.get(id) ?? { skillId: id, skillName: `Skill #${id}` };
      });
    });
    setError(null);
  };

  const removeSkillLocal = (skillId: number) => {
    setUserSkills((prev) => prev.filter((s) => s.skillId !== skillId));
  };

  const addSkillLocal = (skill: Skill) => {
    setUserSkills((prev) =>
      prev.some((s) => s.skillId === skill.id)
        ? prev
        : [...prev, { skillId: skill.id, skillName: skill.name }],
    );
    setAddOpen(false);
  };

  useEffect(() => {
    if (section !== "roles" || !isAdmin) return;

    const controller = new AbortController();
    setRolesLoading(true);
    setRolesError(null);

    Promise.all([
      getUsers(controller.signal),
      getRoles(controller.signal),
    ])
      .then(([users, roleList]) => {
        if (controller.signal.aborted) return;
        setMembers(Array.isArray(users) ? users : []);
        setRoles(Array.isArray(roleList) ? roleList : []);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Unable to load team roles. Please try again.";
        setRolesError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRolesLoading(false);
      });

    return () => controller.abort();
  }, [section, isAdmin]);

  const clearPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswords(false);
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from the current password.");
      return;
    }

    setPasswordSaving(true);
    try {
      await resetPassword({ currentPassword, newPassword });
      clearPasswordForm();
      setPasswordSuccess("Password updated successfully.");
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to update password. Please try again.";
      setPasswordError(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleCreateSkill = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setCatalogError("Only workspace administrators can create skills.");
      return;
    }
    const name = newSkillName.trim();
    if (!name || creatingSkill) return;

    const duplicate = catalog.some(
      (s) => s.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0,
    );
    if (duplicate) {
      setCatalogError("A skill with this name already exists.");
      return;
    }

    setCreatingSkill(true);
    setCatalogError(null);

    try {
      const created = await createSkill({ name });
      setCatalog((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewSkillName("");
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to create skill. Please try again.";
      setCatalogError(message);
    } finally {
      setCreatingSkill(false);
    }
  };

  const handleMemberRoleChange = async (member: User, nextRoleId: number) => {
    if (!isAdmin || nextRoleId === member.roleId || roleSavingId !== null) return;

    setRoleSavingId(member.id);
    setRolesError(null);

    try {
      const updated = await updateUser(member.id, {
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        roleId: nextRoleId,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, ...updated } : m)),
      );
      if (user && member.id === user.id) {
        const roleName = roles.find((r) => r.id === updated.roleId)?.name ?? user.roleName;
        setCurrentUser(updated, roleName);
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to update role. Please try again.";
      setRolesError(message);
    } finally {
      setRoleSavingId(null);
    }
  };

  const roleNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const role of roles) map.set(role.id, role.name);
    return map;
  }, [roles]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;

    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();
    if (!nextFirst || !nextLast) {
      setError("First and last name are required.");
      setStatus("error");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateMyProfile({
        firstName: nextFirst,
        lastName: nextLast,
      });

      const desired = new Set(userSkills.map((s) => s.skillId));
      const current = new Set(baseline.skillIds);

      const toAdd = [...desired].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !desired.has(id));

      await Promise.all([
        ...toAdd.map((skillId) => addUserSkill(user.id, skillId)),
        ...toRemove.map((skillId) => removeUserSkill(user.id, skillId)),
      ]);

      writeOffice(user.id, office);

      const nextBaseline = {
        firstName: updated.firstName,
        lastName: updated.lastName,
        office: office.trim(),
        skillIds: userSkills.map((s) => s.skillId),
      };
      setBaseline(nextBaseline);
      setFirstName(updated.firstName);
      setLastName(updated.lastName);
      setCurrentUser(updated, user.roleName);
      setStatus("valid");
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to save changes. Please try again.";
      setError(message);
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="settings-page">
        <div className="settings-loading">Loading account settings…</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <header className="settings-topbar">
        <label className="settings-global-search">
          <Icon name="search" size={20} />
          <input
            type="search"
            placeholder="Search tasks, projects, UID, or members..."
            aria-label="Global search"
            readOnly
          />
        </label>
        <div className="settings-topbar-right">
          <span className="settings-org">
            Acme Global Engineering
            <Icon name="expand_more" size={18} />
          </span>
          <button type="button" className="settings-icon-btn" aria-label="Notifications">
            <Icon name="notifications" size={20} />
            <span className="settings-notif-badge" />
          </button>
          <TopbarUser />
        </div>
      </header>

      <nav className="settings-breadcrumbs" aria-label="Breadcrumb">
        <span>Administration & Workspace</span>
        <Icon name="chevron_right" size={14} />
        <span>Configuration</span>
      </nav>

      <div className="settings-title-row">
        <div className="settings-title-group">
          <h1>System & Account Settings</h1>
          <p>
            Manage your identity profile, endorsed technical capabilities, and
            workspace credentials across the ETMP fabric.
          </p>
        </div>
      </div>

      <div className="settings-shell">
        <aside className="settings-nav" aria-label="Settings sections">
          <button
            type="button"
            className={section === "profile" ? "settings-nav-item is-active" : "settings-nav-item"}
            onClick={() => setSection("profile")}
          >
            <span className="settings-nav-item-left">
              <Icon name="person" size={18} />
              My Profile
            </span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>General</span>
          </button>
          <button
            type="button"
            className={section === "security" ? "settings-nav-item is-active" : "settings-nav-item"}
            onClick={() => setSection("security")}
          >
            <span className="settings-nav-item-left">
              <Icon name="lock" size={18} />
              Security
            </span>
            <span className="settings-dot" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={
              section === "preferences" ? "settings-nav-item is-active" : "settings-nav-item"
            }
            onClick={() => setSection("preferences")}
          >
            <span className="settings-nav-item-left">
              <Icon name="tune" size={18} />
              Preferences
            </span>
          </button>

          <div className="settings-nav-section">Enterprise Ops</div>

          <button
            type="button"
            className={
              section === "skills-catalog" ? "settings-nav-item is-active" : "settings-nav-item"
            }
            onClick={() => setSection("skills-catalog")}
          >
            <span className="settings-nav-item-left">
              <Icon name="military_tech" size={18} />
              Skills Catalog
            </span>
            <span className="settings-nav-tags">
              <span className="settings-tag rbac">RBAC</span>
              <span className="settings-tag admin">Admin</span>
            </span>
          </button>
          <button
            type="button"
            className={section === "roles" ? "settings-nav-item is-active" : "settings-nav-item"}
            onClick={() => setSection("roles")}
          >
            <span className="settings-nav-item-left">
              <Icon name="admin_panel_settings" size={18} />
              Roles & Access
            </span>
            <span className="settings-tag admin">Admin</span>
          </button>
        </aside>

        <section className="settings-panel">
          {section === "profile" && (
            <form onSubmit={handleSave}>
              <div className="settings-panel-header">
                <div>
                  <h2>Personal Information</h2>
                  <p>Update identity data and managed organizational proficiencies.</p>
                </div>
                <div className="settings-role-card">
                  <span className="settings-role-card-label">Assigned System Role</span>
                  <strong>{user.roleName || "Workspace Member"}</strong>
                  <span>Role managed by Workspace Administrators.</span>
                </div>
              </div>

              <div className="settings-panel-body">
                {error && <div className="settings-error-banner">{error}</div>}

                {loading ? (
                  <div className="settings-loading">Loading profile…</div>
                ) : (
                  <>
                    <div className="settings-identity">
                      <div className="settings-identity-left">
                        <div className="settings-avatar-wrap">
                          <div className="settings-avatar" aria-hidden="true">
                            {initials(firstName, lastName, user.email)}
                          </div>
                          <span className="settings-avatar-badge" title="Active">
                            <Icon name="check" size={14} />
                          </span>
                        </div>
                        <div className="settings-identity-meta">
                          <h3>
                            {firstName || user.firstName} {lastName || user.lastName}
                          </h3>
                          <div className="title">{user.roleName || "Team Member"}</div>
                          <div className="uid">UID: {formatUid(user.id)}</div>
                        </div>
                      </div>
                      <div className="settings-avatar-actions">
                        <button
                          type="button"
                          className="settings-btn settings-btn-secondary"
                          disabled
                          title="Avatar upload is not available yet"
                        >
                          <Icon name="photo_camera" size={18} />
                          Change Avatar
                        </button>
                        <button
                          type="button"
                          className="settings-btn-danger-text"
                          disabled
                          title="Avatar upload is not available yet"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="settings-fields">
                      <div className="settings-field">
                        <label htmlFor="settings-first-name">First Name</label>
                        <input
                          id="settings-first-name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          autoComplete="given-name"
                          required
                        />
                      </div>
                      <div className="settings-field">
                        <label htmlFor="settings-last-name">Last Name</label>
                        <input
                          id="settings-last-name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          autoComplete="family-name"
                          required
                        />
                      </div>
                      <div className="settings-field full">
                        <div className="settings-email-label">
                          <label htmlFor="settings-email">Corporate Email</label>
                          <span className="settings-verified">
                            <Icon name="verified" size={14} />
                            Verified SSO
                          </span>
                        </div>
                        <div className="settings-input-locked">
                          <input
                            id="settings-email"
                            value={user.email}
                            readOnly
                            aria-readonly="true"
                          />
                          <Icon name="lock" size={18} className="lock-icon" />
                        </div>
                        <span className="settings-help">
                          Primary authentication handle linked with enterprise Active Directory.
                        </span>
                      </div>
                      <div className="settings-field full">
                        <label htmlFor="settings-office">Physical Office / Hub</label>
                        <input
                          id="settings-office"
                          value={office}
                          onChange={(e) => setOffice(e.target.value)}
                          placeholder="e.g. Zurich Innovation Center (Bldg 4G - Tech Floor)"
                        />
                        <span className="settings-help">
                          Default physical site for hardware inventory and seat allocation.
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="settings-skills-head">
                        <div>
                          <h3>Proficiencies & Technical Capabilities</h3>
                          <p>
                            Verified skills used for project staffing eligibility and skill-based
                            routing.
                          </p>
                        </div>
                        <span className="settings-count-pill">
                          {userSkills.length} Endorsed Proficienc
                          {userSkills.length === 1 ? "y" : "ies"}
                        </span>
                      </div>

                      <div className="settings-skill-list">
                        {userSkills.map((skill) => (
                          <span key={skill.skillId} className="settings-skill-chip">
                            <Icon name={skillIcon(skill.skillName)} size={16} />
                            {skill.skillName}
                            <button
                              type="button"
                              aria-label={`Remove ${skill.skillName}`}
                              onClick={() => removeSkillLocal(skill.skillId)}
                            >
                              <Icon name="close" size={14} />
                            </button>
                          </span>
                        ))}

                        <div className="settings-add-skill" ref={addRef}>
                          <button
                            type="button"
                            className="settings-btn settings-btn-secondary"
                            onClick={() => setAddOpen((open) => !open)}
                          >
                            <Icon name="add" size={18} />
                            Add Skill
                            <Icon name="expand_more" size={18} />
                          </button>
                          {addOpen && (
                            <div className="settings-add-menu" role="listbox">
                              {availableSkills.length === 0 ? (
                                <div className="settings-add-empty">
                                  No additional skills available in the catalog.
                                </div>
                              ) : (
                                availableSkills.map((skill) => (
                                  <button
                                    key={skill.id}
                                    type="button"
                                    role="option"
                                    onClick={() => addSkillLocal(skill)}
                                  >
                                    {skill.name}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="settings-panel-footer">
                <span
                  className={
                    status === "error"
                      ? "settings-status is-error"
                      : status === "valid"
                        ? "settings-status"
                        : "settings-status is-muted"
                  }
                >
                  <Icon
                    name={status === "error" ? "error" : status === "valid" ? "check_circle" : "info"}
                    size={16}
                  />
                  {status === "error"
                    ? error || "Fix validation issues before saving"
                    : status === "valid"
                      ? "All local changes validated"
                      : "No unsaved changes"}
                </span>
                <div className="settings-footer-actions">
                  <button
                    type="button"
                    className="settings-btn settings-btn-ghost"
                    onClick={discard}
                    disabled={saving || !dirty}
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    className="settings-btn settings-btn-primary"
                    disabled={saving || !dirty || !firstName.trim() || !lastName.trim()}
                  >
                    <Icon name="save" size={18} />
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {section === "security" && (
            <form onSubmit={handleChangePassword}>
              <div className="settings-panel-header">
                <div>
                  <h2>Security</h2>
                  <p>Change your password. Contact an administrator if you cannot sign in.</p>
                </div>
              </div>
              <div className="settings-panel-body">
                {passwordError && <div className="settings-error-banner">{passwordError}</div>}
                {passwordSuccess && (
                  <div className="settings-success-banner">{passwordSuccess}</div>
                )}

                <div className="settings-fields">
                  <div className="settings-field full">
                    <label htmlFor="settings-current-password">Current password</label>
                    <div className="settings-password-wrap">
                      <input
                        id="settings-current-password"
                        type={showPasswords ? "text" : "password"}
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          if (passwordError) setPasswordError(null);
                          if (passwordSuccess) setPasswordSuccess(null);
                        }}
                        disabled={passwordSaving}
                        required
                      />
                      <button
                        type="button"
                        className="settings-password-toggle"
                        onClick={() => setShowPasswords((v) => !v)}
                        aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                      >
                        <Icon name={showPasswords ? "visibility" : "visibility_off"} size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="settings-field">
                    <label htmlFor="settings-new-password">New password</label>
                    <input
                      id="settings-new-password"
                      type={showPasswords ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                        if (passwordSuccess) setPasswordSuccess(null);
                      }}
                      minLength={MIN_PASSWORD_LENGTH}
                      disabled={passwordSaving}
                      required
                    />
                    <span className="settings-help">
                      Must be at least {MIN_PASSWORD_LENGTH} characters and different from your
                      current password.
                    </span>
                  </div>
                  <div className="settings-field">
                    <label htmlFor="settings-confirm-password">Confirm new password</label>
                    <input
                      id="settings-confirm-password"
                      type={showPasswords ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                        if (passwordSuccess) setPasswordSuccess(null);
                      }}
                      minLength={MIN_PASSWORD_LENGTH}
                      disabled={passwordSaving}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="settings-panel-footer">
                <div className="settings-footer-actions">
                  <button
                    type="button"
                    className="settings-btn settings-btn-ghost"
                    onClick={clearPasswordForm}
                    disabled={passwordSaving || (!currentPassword && !newPassword && !confirmPassword)}
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    className="settings-btn settings-btn-primary"
                    disabled={
                      passwordSaving ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                  >
                    <Icon name="key" size={18} />
                    {passwordSaving ? "Updating…" : "Update Password"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {section === "preferences" && (
            <>
              <div className="settings-panel-header">
                <div>
                  <h2>Preferences</h2>
                  <p>Notification cadence and workspace defaults.</p>
                </div>
              </div>
              <div className="settings-panel-body">
                <p className="settings-placeholder">
                  Preference controls will appear here once notification and locale APIs are
                  available.
                </p>
              </div>
            </>
          )}

          {section === "skills-catalog" && (
            <>
              <div className="settings-panel-header">
                <div>
                  <h2>Skills Catalog</h2>
                  <p>Organization-wide proficiency definitions used for staffing rules.</p>
                </div>
              </div>
              <div className="settings-panel-body">
                {isAdmin ? (
                  <form className="settings-create-skill" onSubmit={handleCreateSkill}>
                    <div className="settings-field full">
                      <label htmlFor="settings-new-skill">Create New Skill</label>
                      <div className="settings-create-skill-row">
                        <input
                          id="settings-new-skill"
                          value={newSkillName}
                          onChange={(e) => {
                            setNewSkillName(e.target.value);
                            if (catalogError) setCatalogError(null);
                          }}
                          placeholder="e.g. Kubernetes Orchestration"
                          maxLength={100}
                          disabled={creatingSkill}
                          autoComplete="off"
                        />
                        <button
                          type="submit"
                          className="settings-btn settings-btn-primary"
                          disabled={creatingSkill || !newSkillName.trim()}
                        >
                          <Icon name="add" size={18} />
                          {creatingSkill ? "Creating…" : "Create Skill"}
                        </button>
                      </div>
                      <span className="settings-help">
                        New skills become available for profiles and project staffing.
                      </span>
                    </div>
                    {catalogError && (
                      <div className="settings-error-banner">{catalogError}</div>
                    )}
                  </form>
                ) : (
                  <p className="settings-help settings-catalog-readonly-note">
                    Catalog is read-only. Only workspace administrators can create new skills.
                  </p>
                )}

                {loading ? (
                  <div className="settings-loading">Loading catalog…</div>
                ) : catalog.length === 0 ? (
                  <p className="settings-placeholder">No skills have been published yet.</p>
                ) : (
                  <div className="settings-catalog-list">
                    {catalog.map((skill) => (
                      <div key={skill.id} className="settings-catalog-item">
                        <span className="settings-catalog-item-name">
                          <Icon name={skillIcon(skill.name)} size={18} /> {skill.name}
                        </span>
                        <span className="settings-tag admin">ID {skill.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {section === "roles" && (
            <>
              <div className="settings-panel-header">
                <div>
                  <h2>Roles & Access</h2>
                  <p>
                    {isAdmin
                      ? "Assign and reassign system roles for workspace members."
                      : "Your assigned system role and access boundaries."}
                  </p>
                </div>
              </div>
              <div className="settings-panel-body">
                <div className="settings-role-card" style={{ maxWidth: "100%" }}>
                  <span className="settings-role-card-label">Your Assigned System Role</span>
                  <strong>{user.roleName || "Workspace Member"}</strong>
                  <span>
                    {isAdmin
                      ? `You can manage member roles below. Your UID is ${formatUid(user.id)}.`
                      : `Role changes require a Workspace Administrator. Your UID is ${formatUid(user.id)}.`}
                  </span>
                </div>

                {isAdmin && (
                  <div className="settings-roles-admin">
                    <div className="settings-skills-head">
                      <div>
                        <h3>Team Role Assignments</h3>
                        <p>Select a role for each member. Changes save immediately.</p>
                      </div>
                      <span className="settings-count-pill">
                        {members.length} Member{members.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {rolesError && (
                      <div className="settings-error-banner">{rolesError}</div>
                    )}

                    {rolesLoading ? (
                      <div className="settings-loading">Loading members…</div>
                    ) : members.length === 0 ? (
                      <p className="settings-placeholder">No team members found.</p>
                    ) : (
                      <div className="settings-roles-table-wrap">
                        <table className="settings-roles-table">
                          <thead>
                            <tr>
                              <th>Member</th>
                              <th>Email</th>
                              <th>UID</th>
                              <th>Role</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members
                              .slice()
                              .sort((a, b) =>
                                `${a.firstName} ${a.lastName}`.localeCompare(
                                  `${b.firstName} ${b.lastName}`,
                                ),
                              )
                              .map((member) => (
                                <tr key={member.id}>
                                  <td>
                                    <div className="settings-member-cell">
                                      <span
                                        className="settings-member-avatar"
                                        aria-hidden="true"
                                      >
                                        {initials(
                                          member.firstName,
                                          member.lastName,
                                          member.email,
                                        )}
                                      </span>
                                      <span>
                                        {member.firstName} {member.lastName}
                                        {member.id === user.id ? " (you)" : ""}
                                      </span>
                                    </div>
                                  </td>
                                  <td>{member.email}</td>
                                  <td className="settings-mono">{formatUid(member.id)}</td>
                                  <td>
                                    <select
                                      className="settings-role-select"
                                      value={member.roleId}
                                      disabled={roleSavingId === member.id || roles.length === 0}
                                      aria-label={`Role for ${member.firstName} ${member.lastName}`}
                                      onChange={(e) =>
                                        handleMemberRoleChange(
                                          member,
                                          Number(e.target.value),
                                        )
                                      }
                                    >
                                      {!roles.some((r) => r.id === member.roleId) && (
                                        <option value={member.roleId}>
                                          {roleNameById.get(member.roleId) ||
                                            `Role #${member.roleId}`}
                                        </option>
                                      )}
                                      {roles.map((role) => (
                                        <option key={role.id} value={role.id}>
                                          {role.name}
                                        </option>
                                      ))}
                                    </select>
                                    {roleSavingId === member.id && (
                                      <span className="settings-role-saving">Saving…</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Settings;
