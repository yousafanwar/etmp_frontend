import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import Icon from "../../components/common/Icon";
import TopbarUser from "../../components/layout/TopbarUser";
import { ApiError } from "../../api/client";
import {
  addProjectUser,
  getProjects,
  getProjectUsers,
  removeProjectUser,
} from "../../services/projectService";
import { getTasks } from "../../services/TaskService";
import { getSkills } from "../../services/skillService";
import { adminResetPassword } from "../../services/authService";
import {
  addUserSkill,
  createUser,
  deleteUser,
  getRoles,
  getUsers,
  getUserSkills,
  removeUserSkill,
  updateUser,
} from "../../services/userService";
import type { Project, ProjectUser } from "../../types/project";
import type { Skill, UserSkill } from "../../types/skill";
import type { Role, User } from "../../types/user";
import "./Team.css";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const AVATAR_TONES = ["tone-indigo", "tone-teal", "tone-amber", "tone-rose", "tone-slate"] as const;
const PRIVILEGED_ROLE = /admin|lead|manager/i;
const MIN_PASSWORD_LENGTH = 10;

type Tab = "members" | "teams";
type RoleFilter = "all" | number;
type TeamFilter = "all" | "unassigned" | number;
type StatusFilter = "all" | "assigned" | "unassigned";
type Banner = { kind: "success" | "error"; text: string } | null;

interface MemberForm {
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
  password: string;
}

const emptyForm = (roleId: number): MemberForm => ({
  firstName: "",
  lastName: "",
  email: "",
  roleId,
  password: "",
});

const fullName = (u: Pick<User, "firstName" | "lastName" | "email">) =>
  `${u.firstName} ${u.lastName}`.trim() || u.email;

const initials = (u: Pick<User, "firstName" | "lastName" | "email">) => {
  const value = `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();
  return value || u.email.charAt(0).toUpperCase() || "?";
};

const toneFor = (id: number) => AVATAR_TONES[Math.abs(id) % AVATAR_TONES.length];

const roleBadgeClass = (roleName: string) => {
  if (/admin/i.test(roleName)) return "is-admin";
  if (PRIVILEGED_ROLE.test(roleName)) return "is-lead";
  return "is-default";
};

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Open-ended";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Open-ended";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const buildPageList = (page: number, totalPages: number): (number | "…")[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
};

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const Team = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isAdmin = /admin/i.test(currentUser?.roleName ?? "");

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<number, ProjectUser[]>>({});
  const [taskCounts, setTaskCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState<Banner>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [tab, setTab] = useState<Tab>("members");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [menu, setMenu] = useState<{ userId: number; top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [formTarget, setFormTarget] = useState<User | "new" | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm(0));
  const [accessTarget, setAccessTarget] = useState<User | null>(null);
  const [accessSelection, setAccessSelection] = useState<Set<number>>(new Set());
  const [skillsTarget, setSkillsTarget] = useState<User | null>(null);
  const [skillsSelection, setSkillsSelection] = useState<UserSkill[]>([]);
  const [skillsBaseline, setSkillsBaseline] = useState<number[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsAddOpen, setSkillsAddOpen] = useState(false);
  const skillsAddRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);

    Promise.all([
      getUsers(signal),
      getRoles(signal).catch(() => [] as Role[]),
      getProjects(signal).catch(() => [] as Project[]),
    ])
      .then(async ([userList, roleList, projectList]) => {
        const safeProjects = Array.isArray(projectList) ? projectList : [];
        const memberEntries = await Promise.all(
          safeProjects.map(async (p): Promise<[number, ProjectUser[]]> => {
            try {
              const members = await getProjectUsers(p.id, signal);
              return [p.id, Array.isArray(members) ? members : []];
            } catch {
              return [p.id, []];
            }
          }),
        );
        if (signal.aborted) return;
        setUsers(Array.isArray(userList) ? userList.filter(Boolean) : []);
        setRoles(Array.isArray(roleList) ? roleList : []);
        setProjects(safeProjects);
        setMembersByProject(Object.fromEntries(memberEntries));
        setTaskCounts({});
        setError("");
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        console.error(err);
        setError(errorMessage(err, "Failed to load team members."));
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setSearch((prev) => {
        if (prev === next) return prev;
        setPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  useEffect(() => {
    if (!banner || banner.kind !== "success") return;
    const timer = window.setTimeout(() => setBanner(null), 3500);
    return () => window.clearTimeout(timer);
  }, [banner]);

  useEffect(() => {
    if (!skillsAddOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (skillsAddRef.current && !skillsAddRef.current.contains(e.target as Node)) {
        setSkillsAddOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [skillsAddOpen]);

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const roleName = useCallback(
    (roleId: number) => roleById.get(roleId)?.name ?? (roleId ? `Role #${roleId}` : "Unassigned"),
    [roleById],
  );

  const projectsByUser = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const project of projects) {
      for (const member of membersByProject[project.id] ?? []) {
        const list = map.get(member.userId) ?? [];
        list.push(project);
        map.set(member.userId, list);
      }
    }
    return map;
  }, [projects, membersByProject]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users
      .filter((u) => {
        const userProjects = projectsByUser.get(u.id) ?? [];
        if (roleFilter !== "all" && u.roleId !== roleFilter) return false;
        if (teamFilter === "unassigned" && userProjects.length > 0) return false;
        if (typeof teamFilter === "number" && !userProjects.some((p) => p.id === teamFilter)) {
          return false;
        }
        if (statusFilter === "assigned" && userProjects.length === 0) return false;
        if (statusFilter === "unassigned" && userProjects.length > 0) return false;
        if (!q) return true;
        return (
          fullName(u).toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          roleName(u.roleId).toLowerCase().includes(q) ||
          userProjects.some((p) => p.name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [users, projectsByUser, roleFilter, teamFilter, statusFilter, search, roleName]);

  const filteredTeams = useMemo(() => {
    const q = search.toLowerCase();
    return projects
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (membersByProject[p.id] ?? []).some((m) =>
            fullName(m).toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, membersByProject, search]);

  const totalCount = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const from = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalCount);
  const pageList = buildPageList(safePage, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageUserIds = pageItems.map((u) => u.id).join(",");

  useEffect(() => {
    const ids = pageUserIds ? pageUserIds.split(",").map(Number) : [];
    const missing = ids.filter((id) => !(id in taskCounts));
    if (missing.length === 0) return;

    const controller = new AbortController();
    Promise.all(
      missing.map(async (id): Promise<[number, number]> => {
        try {
          const result = await getTasks({ assigneeId: id, page: 1, pageSize: 1 }, controller.signal);
          return [id, result.totalCount];
        } catch {
          return [id, -1];
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      setTaskCounts((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });

    return () => controller.abort();
  }, [pageUserIds, taskCounts]);

  const stats = useMemo(() => {
    const total = users.length;
    const assigned = users.filter((u) => (projectsByUser.get(u.id) ?? []).length > 0).length;
    const privileged = users.filter((u) => PRIVILEGED_ROLE.test(roleName(u.roleId))).length;
    return {
      total,
      assigned,
      privileged,
      assignedPct: total ? Math.round((assigned / total) * 100) : 0,
      privilegedPct: total ? Math.round((privileged / total) * 100) : 0,
    };
  }, [users, projectsByUser, roleName]);

  const filtersActive =
    roleFilter !== "all" || teamFilter !== "all" || statusFilter !== "all" || searchInput !== "";

  const resetFilters = () => {
    setRoleFilter("all");
    setTeamFilter("all");
    setStatusFilter("all");
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const allOnPageSelected = pageItems.length > 0 && pageItems.every((u) => selected.has(u.id));

  const toggleSelectPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageItems.forEach((u) => next.delete(u.id));
      else pageItems.forEach((u) => next.add(u.id));
      return next;
    });
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const rows = selected.size > 0 ? users.filter((u) => selected.has(u.id)) : filteredUsers;
    const header = ["ID", "First Name", "Last Name", "Email", "Role", "Projects"];
    const lines = rows.map((u) =>
      [
        u.id,
        u.firstName,
        u.lastName,
        u.email,
        roleName(u.roleId),
        (projectsByUser.get(u.id) ?? []).map((p) => p.name).join("; "),
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `team-members-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, userId: number) => {
    e.stopPropagation();
    if (menu?.userId === userId) {
      setMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = isAdmin ? 310 : 100;
    const top =
      rect.bottom + menuHeight > window.innerHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
    setMenu({ userId, top: Math.max(8, top), left: rect.right - 220 });
  };

  const menuUser = menu ? users.find((u) => u.id === menu.userId) ?? null : null;

  const openCreate = () => {
    setModalError("");
    setForm(emptyForm(roles[roles.length - 1]?.id ?? roles[0]?.id ?? 0));
    setFormTarget("new");
  };

  const openEdit = (u: User) => {
    setMenu(null);
    setModalError("");
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, roleId: u.roleId, password: "" });
    setFormTarget(u);
  };

  const openAccess = (u: User) => {
    setMenu(null);
    setModalError("");
    setAccessSelection(new Set((projectsByUser.get(u.id) ?? []).map((p) => p.id)));
    setAccessTarget(u);
  };

  const openSkills = (u: User) => {
    setMenu(null);
    setModalError("");
    setSkillsAddOpen(false);
    setSkillsSelection([]);
    setSkillsBaseline([]);
    setSkillsTarget(u);
    setSkillsLoading(true);
    Promise.all([
      getUserSkills(u.id),
      getSkills().catch(() => [] as Skill[]),
    ])
      .then(([userSkills, catalog]) => {
        const list = Array.isArray(userSkills) ? userSkills : [];
        setSkillsSelection(list);
        setSkillsBaseline(list.map((s) => s.skillId));
        setSkillsCatalog(Array.isArray(catalog) ? catalog : []);
      })
      .catch((err: unknown) => {
        console.error(err);
        setModalError(errorMessage(err, "Failed to load member skills."));
      })
      .finally(() => setSkillsLoading(false));
  };

  const openDelete = (u: User) => {
    setMenu(null);
    setModalError("");
    setDeleteTarget(u);
  };

  const openResetPassword = (u: User) => {
    setMenu(null);
    setModalError("");
    setResetPassword("");
    setConfirmResetPassword("");
    setShowResetPassword(false);
    setPasswordTarget(u);
  };

  const copyEmail = async (u: User) => {
    setMenu(null);
    try {
      await navigator.clipboard.writeText(u.email);
      setBanner({ kind: "success", text: `Copied ${u.email} to clipboard.` });
    } catch {
      setBanner({ kind: "error", text: "Could not access the clipboard." });
    }
  };

  const closeModals = () => {
    if (submitting) return;
    setFormTarget(null);
    setAccessTarget(null);
    setSkillsTarget(null);
    setSkillsAddOpen(false);
    setDeleteTarget(null);
    setPasswordTarget(null);
    setResetPassword("");
    setConfirmResetPassword("");
    setShowResetPassword(false);
    setModalError("");
  };

  const availableSkillsForTarget = useMemo(() => {
    const owned = new Set(skillsSelection.map((s) => s.skillId));
    return skillsCatalog.filter((s) => !owned.has(s.id));
  }, [skillsCatalog, skillsSelection]);

  const addSkillLocal = (skill: Skill) => {
    setSkillsSelection((prev) =>
      prev.some((s) => s.skillId === skill.id)
        ? prev
        : [...prev, { skillId: skill.id, skillName: skill.name }],
    );
    setSkillsAddOpen(false);
  };

  const removeSkillLocal = (skillId: number) => {
    setSkillsSelection((prev) => prev.filter((s) => s.skillId !== skillId));
  };

  const handleSaveMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!formTarget) return;
    setSubmitting(true);
    setModalError("");
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      roleId: Number(form.roleId),
    };
    try {
      if (formTarget === "new") {
        await createUser({ ...payload, password: form.password });
        setBanner({ kind: "success", text: `${payload.firstName} ${payload.lastName} was added.` });
        refresh();
      } else {
        const updated = await updateUser(formTarget.id, payload);
        setUsers((prev) => prev.map((u) => (u.id === formTarget.id ? { ...u, ...updated } : u)));
        setBanner({ kind: "success", text: `${fullName(updated)} was updated.` });
      }
      setFormTarget(null);
    } catch (err: unknown) {
      console.error(err);
      setModalError(errorMessage(err, "Failed to save member."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAccess = async () => {
    if (!accessTarget) return;
    const current = new Set((projectsByUser.get(accessTarget.id) ?? []).map((p) => p.id));
    const toAdd = [...accessSelection].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !accessSelection.has(id));
    if (toAdd.length === 0 && toRemove.length === 0) {
      setAccessTarget(null);
      return;
    }

    setSubmitting(true);
    setModalError("");
    const results = await Promise.allSettled([
      ...toAdd.map((pid) => addProjectUser(pid, accessTarget.id)),
      ...toRemove.map((pid) => removeProjectUser(pid, accessTarget.id)),
    ]);
    const changed = [...toAdd, ...toRemove];
    const refreshed = await Promise.all(
      changed.map(async (pid): Promise<[number, ProjectUser[]]> => {
        try {
          return [pid, await getProjectUsers(pid)];
        } catch {
          return [pid, membersByProject[pid] ?? []];
        }
      }),
    );
    setMembersByProject((prev) => ({ ...prev, ...Object.fromEntries(refreshed) }));
    setSubmitting(false);

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      setModalError(`${failed} of ${results.length} project changes failed.`);
      return;
    }
    setBanner({ kind: "success", text: `Project access updated for ${fullName(accessTarget)}.` });
    setAccessTarget(null);
  };

  const handleSaveSkills = async () => {
    if (!skillsTarget) return;
    const desired = new Set(skillsSelection.map((s) => s.skillId));
    const current = new Set(skillsBaseline);
    const toAdd = [...desired].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !desired.has(id));
    if (toAdd.length === 0 && toRemove.length === 0) {
      setSkillsTarget(null);
      setSkillsAddOpen(false);
      return;
    }

    setSubmitting(true);
    setModalError("");
    const results = await Promise.allSettled([
      ...toAdd.map((skillId) => addUserSkill(skillsTarget.id, skillId)),
      ...toRemove.map((skillId) => removeUserSkill(skillsTarget.id, skillId)),
    ]);
    setSubmitting(false);

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      setModalError(`${failed} of ${results.length} skill changes failed.`);
      return;
    }
    setBanner({ kind: "success", text: `Skills updated for ${fullName(skillsTarget)}.` });
    setSkillsTarget(null);
    setSkillsAddOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    setModalError("");
    try {
      await deleteUser(deleteTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setMembersByProject((prev) => {
        const next: Record<number, ProjectUser[]> = {};
        for (const [pid, members] of Object.entries(prev)) {
          next[Number(pid)] = members.filter((m) => m.userId !== deleteTarget.id);
        }
        return next;
      });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      setBanner({ kind: "success", text: `${fullName(deleteTarget)} was removed.` });
      setDeleteTarget(null);
    } catch (err: unknown) {
      console.error(err);
      setModalError(errorMessage(err, "Failed to delete member."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;

    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      setModalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setModalError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setModalError("");
    try {
      await adminResetPassword(passwordTarget.id, { newPassword: resetPassword });
      setBanner({
        kind: "success",
        text: `Password reset for ${fullName(passwordTarget)}. Share the new password securely.`,
      });
      setPasswordTarget(null);
      setResetPassword("");
      setConfirmResetPassword("");
      setShowResetPassword(false);
    } catch (err: unknown) {
      console.error(err);
      setModalError(errorMessage(err, "Failed to reset password."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="team-page">
      <header className="team-topbar">
        <label className="team-global-search">
          <Icon name="search" size={20} />
          <input
            type="search"
            placeholder="Search tasks, projects, UID, or members..."
            aria-label="Global search"
            readOnly
          />
        </label>
        <div className="team-topbar-right">
          <button type="button" className="team-icon-btn" aria-label="Notifications">
            <Icon name="notifications" size={20} />
            <span className="team-notif-dot" />
          </button>
          <TopbarUser />
        </div>
      </header>

      <div className="team-title-row">
        <div>
          <nav className="team-breadcrumbs" aria-label="Breadcrumb">
            <span>Workspace</span>
            <Icon name="chevron_right" size={16} />
            <span className="is-current">Team &amp; Users</span>
          </nav>
          <div className="team-title-group">
            <h1>Team &amp; Users</h1>
            <span className="team-count-pill">{users.length} Members</span>
          </div>
        </div>
        <div className="team-title-actions">
          <button
            type="button"
            className="team-btn team-btn-secondary"
            onClick={exportCsv}
            disabled={loading || users.length === 0}
          >
            <Icon name="download" size={18} />
            {selected.size > 0 ? `Export ${selected.size} Selected` : "Export CSV"}
          </button>
          {isAdmin && (
            <button type="button" className="team-btn team-btn-primary" onClick={openCreate}>
              <Icon name="person_add" size={18} />
              Add Member
            </button>
          )}
        </div>
      </div>

      {banner && (
        <div className={`team-banner is-${banner.kind}`} role={banner.kind === "error" ? "alert" : "status"}>
          <Icon name={banner.kind === "error" ? "error" : "check_circle"} size={18} />
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <section className="team-kpi-grid" aria-label="Directory summary">
        <article className="team-kpi">
          <div className="team-kpi-top">
            <span className="team-kpi-label">Total Directory</span>
            <span className="team-kpi-icon">
              <Icon name="group" size={18} />
            </span>
          </div>
          <div className="team-kpi-body">
            <div className="team-kpi-value">
              {stats.total}
              <span>accounts</span>
            </div>
            <span className="team-kpi-chip is-success">
              <Icon name="trending_up" size={14} />
              {stats.assigned} on projects
            </span>
          </div>
          <div className="team-kpi-track">
            <div className="team-kpi-fill is-primary" style={{ width: `${stats.assignedPct}%` }} />
          </div>
        </article>

        <article className="team-kpi">
          <div className="team-kpi-top">
            <span className="team-kpi-label">Privileged Seats</span>
            <span className="team-kpi-icon">
              <Icon name="shield_person" size={18} />
            </span>
          </div>
          <div className="team-kpi-body">
            <div className="team-kpi-value">
              {stats.privileged}
              <span>Admins &amp; Leads</span>
            </div>
            <span className="team-kpi-chip is-info">Strict ACL</span>
          </div>
          <div className="team-kpi-track">
            <div className="team-kpi-fill is-info" style={{ width: `${stats.privilegedPct}%` }} />
          </div>
        </article>
      </section>

      <section className="team-panel">
        <div className="team-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "members"}
            className={tab === "members" ? "is-active" : ""}
            onClick={() => setTab("members")}
          >
            <Icon name="badge" size={18} />
            All Members
            <span className="team-tab-count">{users.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "teams"}
            className={tab === "teams" ? "is-active" : ""}
            onClick={() => setTab("teams")}
          >
            <Icon name="hub" size={18} />
            Teams &amp; Squads
            <span className="team-tab-count">{projects.length}</span>
          </button>
        </div>

        <div className="team-toolbar">
          <label className="team-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder={
                tab === "members"
                  ? "Search by name, email, role, or project..."
                  : "Search squads by name or member..."
              }
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search members"
            />
          </label>

          {tab === "members" && (
            <>
              <label className="team-select">
                <span>Role:</span>
                <select
                  value={roleFilter === "all" ? "all" : String(roleFilter)}
                  onChange={(e) => {
                    setRoleFilter(e.target.value === "all" ? "all" : Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value="all">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <Icon name="arrow_drop_down" size={18} />
              </label>

              <label className="team-select">
                <span>Team:</span>
                <select
                  value={typeof teamFilter === "number" ? String(teamFilter) : teamFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTeamFilter(v === "all" || v === "unassigned" ? v : Number(v));
                    setPage(1);
                  }}
                >
                  <option value="all">All Teams</option>
                  <option value="unassigned">Unassigned</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Icon name="arrow_drop_down" size={18} />
              </label>

              <label className="team-select">
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as StatusFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">All</option>
                  <option value="assigned">Staffed</option>
                  <option value="unassigned">On Bench</option>
                </select>
                <Icon name="arrow_drop_down" size={18} />
              </label>
            </>
          )}

          <button
            type="button"
            className={`team-icon-btn team-filter-reset ${filtersActive ? "is-active" : ""}`}
            onClick={resetFilters}
            disabled={!filtersActive}
            title="Reset filters"
            aria-label="Reset filters"
          >
            <Icon name="tune" size={20} />
          </button>
        </div>

        {loading && <p className="team-state">Loading team members…</p>}
        {error && !loading && (
          <div className="team-state is-error">
            {error}
            <button type="button" className="team-btn team-btn-secondary" onClick={refresh}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && tab === "members" && (
          <>
            {selected.size > 0 && (
              <div className="team-bulk-bar">
                <span>{selected.size} selected</span>
                <button type="button" onClick={exportCsv}>
                  <Icon name="download" size={16} />
                  Export selected
                </button>
                <button type="button" onClick={() => setSelected(new Set())}>
                  Clear selection
                </button>
              </div>
            )}

            <div className="team-table-wrap">
              <table className="team-table">
                <thead>
                  <tr>
                    <th className="col-check">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectPage}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th>Member</th>
                    <th>Assigned Role</th>
                    <th>Department &amp; Team</th>
                    <th>Workload</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="team-empty">
                        No members match the current filters.
                      </td>
                    </tr>
                  )}
                  {pageItems.map((u) => {
                    const userProjects = projectsByUser.get(u.id) ?? [];
                    const role = roleName(u.roleId);
                    const isSelf = currentUser?.id === u.id;
                    const tasks = taskCounts[u.id];
                    return (
                      <tr key={u.id} className={selected.has(u.id) ? "is-selected" : ""}>
                        <td className="col-check">
                          <input
                            type="checkbox"
                            checked={selected.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            aria-label={`Select ${fullName(u)}`}
                          />
                        </td>
                        <td>
                          <div className="team-member">
                            <span className={`team-avatar ${toneFor(u.id)}`}>{initials(u)}</span>
                            <div className="team-member-meta">
                              <span className="team-member-name">
                                {fullName(u)}
                                {isSelf && <span className="team-you-tag">You</span>}
                              </span>
                              <span className="team-member-email">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`team-role ${roleBadgeClass(role)}`}>
                            {/admin/i.test(role) && <Icon name="shield" size={12} />}
                            {role}
                          </span>
                        </td>
                        <td>
                          {userProjects.length > 0 ? (
                            <div className="team-dept">
                              <span className="team-dept-name">{userProjects[0].name}</span>
                              <span className="team-dept-sub">
                                {role}
                                {userProjects.length > 1 && ` • +${userProjects.length - 1} more projects`}
                              </span>
                            </div>
                          ) : (
                            <div className="team-dept">
                              <span className="team-dept-name is-muted">Unassigned</span>
                              <span className="team-dept-sub">On bench</span>
                            </div>
                          )}
                        </td>
                        <td className="team-workload">
                          {tasks === undefined
                            ? "…"
                            : tasks < 0
                              ? "—"
                              : `${tasks} ${tasks === 1 ? "task" : "tasks"}`}
                        </td>
                        <td className="col-actions">
                          <div className="team-actions">
                            <a
                              className="team-icon-btn team-action-mail"
                              href={`mailto:${u.email}`}
                              aria-label={`Email ${fullName(u)}`}
                              title="Send email"
                            >
                              <Icon name="forward_to_inbox" size={18} />
                            </a>
                            <button
                              type="button"
                              className={`team-icon-btn ${menu?.userId === u.id ? "is-open" : ""}`}
                              aria-label={`Actions for ${fullName(u)}`}
                              aria-haspopup="menu"
                              aria-expanded={menu?.userId === u.id}
                              onClick={(e) => openMenu(e, u.id)}
                            >
                              <Icon name="more_vert" size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <footer className="team-pagination">
              <div className="team-page-left">
                <span className="team-page-info">
                  Showing {from}–{to} of {totalCount} members
                </span>
                <label className="team-page-size">
                  Rows per page:
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="team-page-controls">
                <button
                  type="button"
                  className="team-page-nav"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Icon name="chevron_left" size={16} />
                  Previous
                </button>
                {pageList.map((item, idx) =>
                  item === "…" ? (
                    <span key={`e-${idx}`} className="team-page-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={`team-page-btn ${item === safePage ? "is-active" : ""}`}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="team-page-nav"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <Icon name="chevron_right" size={16} />
                </button>
              </div>
            </footer>
          </>
        )}

        {!loading && !error && tab === "teams" && (
          <div className="team-squads">
            {filteredTeams.length === 0 && <p className="team-state">No squads found.</p>}
            {filteredTeams.map((p) => {
              const members = membersByProject[p.id] ?? [];
              const shown = members.slice(0, 5);
              return (
                <article
                  key={p.id}
                  className="team-squad"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/projects/${p.id}`);
                    }
                  }}
                >
                  <div className="team-squad-head">
                    <span className="team-squad-icon">
                      <Icon name="hub" size={18} />
                    </span>
                    <div>
                      <h2>{p.name}</h2>
                      <span className="team-squad-dates">
                        {formatDate(p.startDate)} – {formatDate(p.endDate)}
                      </span>
                    </div>
                  </div>
                  <p className="team-squad-desc">{p.description}</p>
                  <footer className="team-squad-foot">
                    <div className="team-squad-avatars">
                      {shown.map((m) => (
                        <span
                          key={m.userId}
                          className={`team-avatar is-sm ${toneFor(m.userId)}`}
                          title={fullName(m)}
                        >
                          {initials(m)}
                        </span>
                      ))}
                      {members.length > shown.length && (
                        <span className="team-avatar is-sm tone-slate">
                          +{members.length - shown.length}
                        </span>
                      )}
                    </div>
                    <span className="team-squad-count">
                      {members.length} {members.length === 1 ? "member" : "members"}
                    </span>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {menu && menuUser && (
        <div
          ref={menuRef}
          className="team-menu"
          role="menu"
          style={{ top: menu.top, left: Math.max(8, menu.left) }}
        >
          {isAdmin && (
            <>
              <button type="button" role="menuitem" onClick={() => openEdit(menuUser)}>
                <Icon name="edit" size={18} />
                Edit details &amp; role
              </button>
              <button type="button" role="menuitem" onClick={() => openAccess(menuUser)}>
                <Icon name="folder_shared" size={18} />
                Manage project access
              </button>
              <button type="button" role="menuitem" onClick={() => openSkills(menuUser)}>
                <Icon name="psychology" size={18} />
                Manage skills
              </button>
              <button type="button" role="menuitem" onClick={() => openResetPassword(menuUser)}>
                <Icon name="key" size={18} />
                Reset password
              </button>
            </>
          )}
          <button type="button" role="menuitem" onClick={() => void copyEmail(menuUser)}>
            <Icon name="content_copy" size={18} />
            Copy email
          </button>
          <a role="menuitem" href={`mailto:${menuUser.email}`} onClick={() => setMenu(null)}>
            <Icon name="mail" size={18} />
            Send email
          </a>
          {isAdmin && (
            <>
              <div className="team-menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                disabled={currentUser?.id === menuUser.id}
                title={currentUser?.id === menuUser.id ? "You cannot delete your own account" : undefined}
                onClick={() => openDelete(menuUser)}
              >
                <Icon name="person_remove" size={18} />
                Delete member
              </button>
            </>
          )}
        </div>
      )}

      {formTarget && (
        <div className="team-modal-backdrop" role="presentation" onClick={closeModals}>
          <div
            className="team-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="team-modal-header">
              <h2 id="member-form-title">{formTarget === "new" ? "Add Member" : "Edit Member"}</h2>
              <button type="button" className="team-icon-btn" aria-label="Close" onClick={closeModals}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <form className="team-modal-form" onSubmit={(e) => void handleSaveMember(e)}>
              <div className="team-modal-row">
                <label>
                  First name
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    autoFocus
                  />
                </label>
                <label>
                  Last name
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </label>
              </div>
              <label>
                Email
                <input
                  type="email"
                  required
                  maxLength={150}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label>
                Role
                <select
                  required
                  value={form.roleId || ""}
                  onChange={(e) => setForm((f) => ({ ...f, roleId: Number(e.target.value) }))}
                >
                  <option value="" disabled>
                    Select a role
                  </option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              {formTarget === "new" && (
                <label>
                  Temporary password
                  <input
                    type="password"
                    required
                    minLength={10}
                    maxLength={100}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="At least 10 characters"
                  />
                </label>
              )}
              {modalError && <p className="team-modal-error">{modalError}</p>}
              <div className="team-modal-footer">
                <button type="button" className="team-btn team-btn-secondary" onClick={closeModals}>
                  Cancel
                </button>
                <button type="submit" className="team-btn team-btn-primary" disabled={submitting}>
                  {submitting ? "Saving…" : formTarget === "new" ? "Add Member" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accessTarget && (
        <div className="team-modal-backdrop" role="presentation" onClick={closeModals}>
          <div
            className="team-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="team-modal-header">
              <div>
                <h2 id="access-title">Project Access</h2>
                <span className="team-modal-sub">{fullName(accessTarget)}</span>
              </div>
              <button type="button" className="team-icon-btn" aria-label="Close" onClick={closeModals}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="team-modal-form">
              {projects.length === 0 ? (
                <p className="team-state">No projects exist yet.</p>
              ) : (
                <ul className="team-access-list">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={accessSelection.has(p.id)}
                          onChange={() =>
                            setAccessSelection((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            })
                          }
                        />
                        <span className="team-access-name">{p.name}</span>
                        <span className="team-access-count">
                          {(membersByProject[p.id] ?? []).length} members
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {modalError && <p className="team-modal-error">{modalError}</p>}
              <div className="team-modal-footer">
                <button type="button" className="team-btn team-btn-secondary" onClick={closeModals}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="team-btn team-btn-primary"
                  disabled={submitting}
                  onClick={() => void handleSaveAccess()}
                >
                  {submitting ? "Saving…" : "Save Access"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {skillsTarget && (
        <div className="team-modal-backdrop" role="presentation" onClick={closeModals}>
          <div
            className="team-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="skills-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="team-modal-header">
              <div>
                <h2 id="skills-title">Member Skills</h2>
                <span className="team-modal-sub">{fullName(skillsTarget)}</span>
              </div>
              <button type="button" className="team-icon-btn" aria-label="Close" onClick={closeModals}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="team-modal-form">
              <p className="team-modal-text">
                Assign catalog skills used for staffing eligibility and skill-based task routing.
              </p>
              {skillsLoading ? (
                <p className="team-state">Loading skills…</p>
              ) : (
                <div className="team-skill-list">
                  {skillsSelection.map((skill) => (
                    <span key={skill.skillId} className="team-skill-chip">
                      {skill.skillName}
                      <button
                        type="button"
                        aria-label={`Remove ${skill.skillName}`}
                        disabled={submitting}
                        onClick={() => removeSkillLocal(skill.skillId)}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </span>
                  ))}

                  <div className="team-add-skill" ref={skillsAddRef}>
                    <button
                      type="button"
                      className="team-btn team-btn-secondary"
                      disabled={submitting || skillsCatalog.length === 0}
                      onClick={() => setSkillsAddOpen((open) => !open)}
                    >
                      <Icon name="add" size={18} />
                      Add Skill
                      <Icon name="expand_more" size={18} />
                    </button>
                    {skillsAddOpen && (
                      <div className="team-add-skill-menu" role="listbox">
                        {availableSkillsForTarget.length === 0 ? (
                          <div className="team-add-skill-empty">
                            {skillsCatalog.length === 0
                              ? "No skills in the catalog yet."
                              : "All catalog skills are already assigned."}
                          </div>
                        ) : (
                          availableSkillsForTarget.map((skill) => (
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
              )}
              {modalError && <p className="team-modal-error">{modalError}</p>}
              <div className="team-modal-footer">
                <button type="button" className="team-btn team-btn-secondary" onClick={closeModals}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="team-btn team-btn-primary"
                  disabled={submitting || skillsLoading}
                  onClick={() => void handleSaveSkills()}
                >
                  {submitting ? "Saving…" : "Save Skills"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="team-modal-backdrop" role="presentation" onClick={closeModals}>
          <div
            className="team-modal is-narrow"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="team-modal-header">
              <h2 id="delete-title">Delete member?</h2>
              <button type="button" className="team-icon-btn" aria-label="Close" onClick={closeModals}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="team-modal-form">
              <p className="team-modal-text">
                <strong>{fullName(deleteTarget)}</strong> ({deleteTarget.email}) will lose access
                immediately. Their project memberships are removed and assigned tasks become
                unassigned. This cannot be undone.
              </p>
              {modalError && <p className="team-modal-error">{modalError}</p>}
              <div className="team-modal-footer">
                <button type="button" className="team-btn team-btn-secondary" onClick={closeModals}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="team-btn team-btn-danger"
                  disabled={submitting}
                  onClick={() => void handleDelete()}
                >
                  {submitting ? "Deleting…" : "Delete Member"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {passwordTarget && (
        <div className="team-modal-backdrop" role="presentation" onClick={closeModals}>
          <div
            className="team-modal is-narrow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="team-modal-header">
              <h2 id="reset-password-title">Reset password</h2>
              <button type="button" className="team-icon-btn" aria-label="Close" onClick={closeModals}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <form className="team-modal-form" onSubmit={handleAdminResetPassword}>
              <p className="team-modal-text">
                Set a temporary password for <strong>{fullName(passwordTarget)}</strong> (
                {passwordTarget.email}). Share it securely — they can change it later in Settings.
              </p>
              <label>
                New password
                <div className="team-password-wrap">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="team-password-toggle"
                    onClick={() => setShowResetPassword((v) => !v)}
                    aria-label={showResetPassword ? "Hide password" : "Show password"}
                  >
                    <Icon name={showResetPassword ? "visibility" : "visibility_off"} size={18} />
                  </button>
                </div>
              </label>
              <label>
                Confirm password
                <input
                  type={showResetPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  disabled={submitting}
                />
              </label>
              {modalError && <p className="team-modal-error">{modalError}</p>}
              <div className="team-modal-footer">
                <button type="button" className="team-btn team-btn-secondary" onClick={closeModals}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="team-btn team-btn-primary"
                  disabled={submitting || !resetPassword || !confirmResetPassword}
                >
                  {submitting ? "Resetting…" : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Team;
