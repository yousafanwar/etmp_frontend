import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/common/Icon";
import {
  createTask,
  getTasks,
  startTask,
  completeTask,
} from "../../services/TaskService";
import {
  getProject,
  getProjectSkills,
  getProjectUsers,
} from "../../services/projectService";
import { getRoles, getUsers } from "../../services/userService";
import type { Project, ProjectSkill, ProjectUser } from "../../types/project";
import type { Task } from "../../types/task";
import type { Role, User } from "../../types/user";
import "./ProjectDetails.css";

type BoardView = "board" | "list" | "gantt";

type BoardColumnId = "Pending" | "InProgress" | "Completed";

interface BoardColumn {
  id: BoardColumnId;
  title: string;
  accent: string;
}

interface Milestone {
  id: string;
  name: string;
  pct: number;
  status: "done" | "active" | "upcoming";
  detail: string;
  target: string;
}

const COLUMNS: BoardColumn[] = [
  { id: "Pending", title: "Backlog / Todo", accent: "col-todo" },
  { id: "InProgress", title: "In Progress", accent: "col-progress" },
  { id: "Completed", title: "Completed / Shipped", accent: "col-done" },
];

const AVATAR_TONES = ["tone-indigo", "tone-teal", "tone-amber", "tone-rose", "tone-slate", "tone-violet"] as const;

const PRIORITY_META = [
  { label: "P0 Critical", className: "prio-critical" },
  { label: "P1 High", className: "prio-high" },
  { label: "P2 Medium", className: "prio-medium" },
  { label: "P3 Low", className: "prio-low" },
] as const;

const toDate = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDate = (value: string | null | undefined, fallback = "—") => {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatShortDate = (value: string | Date | null | undefined, fallback = "—") => {
  const d = value instanceof Date ? value : toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const initials = (first: string, last: string) =>
  `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";

const projectKey = (project: Project) => {
  const slug = project.name
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12)
    .toUpperCase();
  return slug ? `PRJ-${slug}` : `PRJ-${project.id}`;
};

const taskCode = (project: Project, task: Task) => {
  const prefix = project.name
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 6)
    .toUpperCase() || "TASK";
  return `${prefix}-${task.id}`;
};

const derivePriority = (task: Task) => PRIORITY_META[Math.abs(task.id) % PRIORITY_META.length];

const derivePoints = (task: Task) => 2 + (Math.abs(task.id) % 7);

const deriveCompletion = (project: Project, tasks: Task[]) => {
  if (tasks.length > 0) {
    const done = tasks.filter((t) => t.status === "Completed").length;
    return Math.round((done / tasks.length) * 100);
  }
  const start = toDate(project.startDate);
  const end = toDate(project.endDate);
  if (!start || !end || end <= start) return 42;
  const ratio = (Date.now() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.max(5, Math.min(98, Math.round(ratio * 100)));
};

const deriveStatusLabel = (completion: number, project: Project) => {
  const end = toDate(project.endDate);
  if (end && end.getTime() < Date.now() && completion < 100) {
    return { label: `At Risk (${completion}% Complete)`, tone: "warn" as const };
  }
  if (completion >= 100) {
    return { label: "Completed (100%)", tone: "success" as const };
  }
  if (completion >= 60) {
    return { label: `On Track (${completion}% Complete)`, tone: "success" as const };
  }
  return { label: `In Progress (${completion}% Complete)`, tone: "info" as const };
};

const buildMilestones = (project: Project, completion: number, openTasks: number): Milestone[] => {
  const start = toDate(project.startDate) ?? new Date();
  const end = toDate(project.endDate) ?? new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000);
  const span = Math.max(1, end.getTime() - start.getTime());
  const mid = new Date(start.getTime() + span * 0.5);
  const late = new Date(start.getTime() + span * 0.78);

  const phase1Pct = Math.min(100, Math.round(completion * 1.35));
  const phase2Pct = Math.min(100, completion);
  const phase3Pct = completion >= 95 ? Math.min(100, completion - 90 + 10) : 0;

  return [
    {
      id: "m1",
      name: "Phase 1: Foundation & Setup",
      pct: phase1Pct >= 100 ? 100 : phase1Pct,
      status: phase1Pct >= 100 ? "done" : phase1Pct > 0 ? "active" : "upcoming",
      detail: phase1Pct >= 100 ? `Completed ${formatShortDate(start)}` : "In progress",
      target: formatShortDate(mid),
    },
    {
      id: "m2",
      name: "Phase 2: Core Delivery",
      pct: phase2Pct,
      status: phase1Pct >= 100 ? (phase2Pct >= 100 ? "done" : "active") : "upcoming",
      detail:
        phase2Pct >= 100
          ? `Completed ${formatShortDate(late)}`
          : phase1Pct >= 100
            ? `Active — ${openTasks} tasks remaining`
            : `Starts ${formatShortDate(mid)}`,
      target: formatShortDate(late),
    },
    {
      id: "m3",
      name: "Phase 3: Launch & Switchover",
      pct: phase3Pct,
      status: phase2Pct >= 100 ? (phase3Pct >= 100 ? "done" : "active") : "upcoming",
      detail:
        phase3Pct >= 100
          ? `Completed ${formatShortDate(end)}`
          : phase2Pct >= 100
            ? "Active"
            : `Starts ${formatShortDate(late)}`,
      target: formatShortDate(end),
    },
  ];
};

const buildBurndown = (tasks: Task[], project: Project) => {
  const totalPts = tasks.reduce((sum, t) => sum + derivePoints(t), 0) || 42;
  const donePts = tasks
    .filter((t) => t.status === "Completed")
    .reduce((sum, t) => sum + derivePoints(t), 0);
  const remaining = Math.max(0, totalPts - donePts);

  const start = toDate(project.startDate) ?? new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const end = toDate(project.endDate) ?? new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  const totalDays = Math.max(5, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const elapsed = Math.max(
    1,
    Math.min(totalDays, Math.ceil((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000))),
  );
  const daysLeft = Math.max(0, totalDays - elapsed);
  const pace = daysLeft > 0 ? remaining / daysLeft : remaining;

  const ideal: { x: number; y: number }[] = [];
  const actual: { x: number; y: number }[] = [];
  for (let d = 0; d <= totalDays; d++) {
    const x = d / totalDays;
    ideal.push({ x, y: 1 - x });
    if (d <= elapsed) {
      const progress = elapsed === 0 ? 0 : Math.min(1, donePts / totalPts);
      const curved = progress * (d / elapsed);
      actual.push({ x, y: Math.max(0, 1 - curved) });
    }
  }

  return {
    sprintLabel: `Sprint ${40 + (Math.abs(project.id) % 20)}`,
    remaining,
    daysLeft,
    pace: pace.toFixed(1),
    totalDays,
    elapsed,
    totalPts,
    ideal,
    actual,
    healthy: pace <= (totalPts / totalDays) * 1.25,
  };
};

const toPolyline = (points: { x: number; y: number }[], w: number, h: number, pad = 8) =>
  points
    .map((p) => {
      const x = pad + p.x * (w - pad * 2);
      const y = pad + p.y * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

const ProjectDetailsPage = () => {
  const { id } = useParams();
  return <ProjectDetails key={id ?? "invalid"} />;
};

const ProjectDetails = () => {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const projectId = Number(idParam);
  const invalidId = !Number.isInteger(projectId) || projectId <= 0;

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectUser[]>([]);
  const [skills, setSkills] = useState<ProjectSkill[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [loading, setLoading] = useState(!invalidId);
  const [error, setError] = useState(invalidId ? "Invalid project id." : "");
  const [actionError, setActionError] = useState("");
  const [boardView, setBoardView] = useState<BoardView>("board");
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const rolesById = useMemo(() => {
    const map = new Map<number, string>();
    roles.forEach((r) => map.set(r.id, r.name));
    return map;
  }, [roles]);

  const usersById = useMemo(() => {
    const map = new Map<number, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  const boardTasks = useMemo(() => {
    if (memberIds.size === 0) return tasks;
    const scoped = tasks.filter(
      (t) => t.assignee == null || memberIds.has(t.assignee.id),
    );
    return scoped.length > 0 ? scoped : tasks;
  }, [tasks, memberIds]);

  const tasksByStatus = useMemo(() => {
    const map: Record<BoardColumnId, Task[]> = {
      Pending: [],
      InProgress: [],
      Completed: [],
    };
    for (const task of boardTasks) {
      map[task.status]?.push(task);
    }
    return map;
  }, [boardTasks]);

  const completion = project ? deriveCompletion(project, boardTasks) : 0;
  const statusMeta = project
    ? deriveStatusLabel(completion, project)
    : { label: "", tone: "info" as const };
  const milestones = project
    ? buildMilestones(
        project,
        completion,
        boardTasks.filter((t) => t.status !== "Completed").length,
      )
    : [];
  const burndown = project
    ? buildBurndown(boardTasks, project)
    : null;

  const lead = members[0] ?? null;
  const key = project ? projectKey(project) : "";

  const teamWithCounts = useMemo(() => {
    return members.map((m) => {
      const user = usersById.get(m.userId);
      const roleName = user ? rolesById.get(user.roleId) ?? "Contributor" : "Contributor";
      const count = boardTasks.filter((t) => t.assignee?.id === m.userId).length;
      return { member: m, roleName, count };
    });
  }, [members, usersById, rolesById, boardTasks]);

  const reload = () => {
    setError("");
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    if (invalidId) return;
    const controller = new AbortController();
    setLoading(true);

    Promise.all([
      getProject(projectId, controller.signal),
      getProjectUsers(projectId, controller.signal),
      getProjectSkills(projectId, controller.signal),
      getTasks({ page: 1, pageSize: 100, projectId }, controller.signal),
      getUsers(controller.signal).catch(() => [] as User[]),
      getRoles(controller.signal).catch(() => [] as Role[]),
    ])
      .then(([proj, projectUsers, projectSkills, taskPage, allUsers, allRoles]) => {
        if (controller.signal.aborted) return;
        setProject(proj);
        setMembers(Array.isArray(projectUsers) ? projectUsers : []);
        setSkills(Array.isArray(projectSkills) ? projectSkills : []);
        setTasks(Array.isArray(taskPage?.items) ? taskPage.items : []);
        setUsers(Array.isArray(allUsers) ? allUsers : []);
        setRoles(Array.isArray(allRoles) ? allRoles : []);
        setError("");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setError("Failed to load project details.");
        setProject(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [projectId, invalidId, reloadKey]);

  const refreshTasks = async () => {
    try {
      const page = await getTasks({ page: 1, pageSize: 100, projectId });
      setTasks(Array.isArray(page?.items) ? page.items : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setActionError("");
    try {
      await createTask(createTitle.trim(), createDescription.trim(), projectId);
      setCreateOpen(false);
      setCreateTitle("");
      setCreateDescription("");
      await refreshTasks();
    } catch (err) {
      console.error(err);
      setActionError("Failed to create task.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const advanceTask = async (task: Task) => {
    setBusyTaskId(task.id);
    setActionError("");
    try {
      let updated: Task;
      if (task.status === "Pending") {
        updated = await startTask(task.id);
      } else if (task.status === "InProgress") {
        updated = await completeTask(task.id);
      } else {
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      console.error(err);
      setActionError("Failed to update task status.");
    } finally {
      setBusyTaskId(null);
    }
  };

  if (invalidId) {
    return (
      <div className="pd-page">
        <p className="pd-state pd-state-error">Invalid project id.</p>
        <Link to="/projects" className="pd-link">
          Back to projects
        </Link>
      </div>
    );
  }

  if (loading && !project) {
    return (
      <div className="pd-page">
        <p className="pd-state">Loading project…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="pd-page">
        <p className="pd-state pd-state-error">{error || "Project not found."}</p>
        <button type="button" className="pd-btn pd-btn-secondary" onClick={() => reload()}>
          Retry
        </button>
        <Link to="/projects" className="pd-link">
          Back to projects
        </Link>
      </div>
    );
  }

  const chartW = 360;
  const chartH = 140;

  return (
    <div className="pd-page">
      <header className="pd-topbar">
        <label className="pd-global-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Search tasks, projects, people..."
            aria-label="Global search"
            readOnly
          />
          <kbd>⌘ K</kbd>
        </label>
        <div className="pd-topbar-right">
          <button
            type="button"
            className="pd-btn pd-btn-primary pd-btn-sm"
            onClick={() => setCreateOpen(true)}
          >
            <Icon name="add" size={18} />
            New Task
          </button>
          <button type="button" className="pd-icon-btn" aria-label="Notifications">
            <Icon name="notifications" size={20} />
            <span className="pd-notif-badge">3</span>
          </button>
          <div className="pd-user">
            <div className="pd-user-avatar" aria-hidden="true">
              ER
            </div>
            <div className="pd-user-meta">
              <span className="pd-user-name">Elena Rostova</span>
              <span className="pd-user-role">VP of Engineering</span>
            </div>
          </div>
        </div>
      </header>

      <div className="pd-crumb-row">
        <nav className="pd-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/projects">Projects</Link>
          <Icon name="chevron_right" size={16} />
          <span>{key}</span>
          <Icon name="chevron_right" size={16} />
          <span className="is-current">Overview &amp; Board</span>
        </nav>
        <div className="pd-sync">
          <span className="pd-sync-dot" aria-hidden="true" />
          <span>Sync Active</span>
          <button type="button" className="pd-icon-btn pd-icon-btn-sm" aria-label="History">
            <Icon name="history" size={18} />
          </button>
          <button type="button" className="pd-icon-btn pd-icon-btn-sm" aria-label="Share">
            <Icon name="ios_share" size={18} />
          </button>
        </div>
      </div>

      <section className="pd-header">
        <div className="pd-header-main">
          <div className="pd-title-row">
            <span className="pd-title-icon" aria-hidden="true">
              <Icon name="rocket_launch" size={22} />
            </span>
            <div>
              <div className="pd-title-line">
                <h1>{project.name}</h1>
                <span className="pd-key-pill">{key}</span>
              </div>
              <div className={`pd-status-pill tone-${statusMeta.tone}`}>
                <Icon name="check_circle" size={16} />
                {statusMeta.label}
              </div>
            </div>
          </div>

          <div className="pd-meta-row">
            <div className="pd-meta-item">
              <span className="pd-meta-label">Lead</span>
              {lead ? (
                <span className="pd-meta-lead">
                  <span className={`pd-avatar ${AVATAR_TONES[0]}`}>
                    {initials(lead.firstName, lead.lastName)}
                  </span>
                  {lead.firstName} {lead.lastName}
                </span>
              ) : (
                <span className="pd-meta-value">Unassigned</span>
              )}
            </div>
            <div className="pd-meta-item">
              <span className="pd-meta-label">Timeline</span>
              <span className="pd-meta-value">
                {formatShortDate(project.startDate)} → {formatDate(project.endDate, "Open")}
              </span>
            </div>
            {skills.length > 0 && (
              <div className="pd-meta-item">
                <span className="pd-meta-label">Skills</span>
                <span className="pd-skill-chips">
                  {skills.slice(0, 4).map((s) => (
                    <span key={s.skillId} className="pd-skill-chip">
                      {s.skillName}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>

          {project.description && (
            <p className="pd-description">{project.description}</p>
          )}
        </div>

        <div className="pd-header-actions">
          <button type="button" className="pd-btn pd-btn-secondary">
            <Icon name="analytics" size={18} />
            Sprint Report
          </button>
          <button
            type="button"
            className="pd-btn pd-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            <Icon name="add" size={18} />
            New Issue
          </button>
        </div>
      </section>

      {actionError && (
        <div className="pd-banner pd-banner-error" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError("")} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <div className="pd-board-toolbar">
        <div className="pd-view-tabs" role="tablist" aria-label="Board views">
          {(
            [
              { id: "board", label: "Board / Kanban", icon: "view_kanban" },
              { id: "list", label: "List View", icon: "view_list" },
              { id: "gantt", label: "Gantt / Timeline", icon: "view_timeline" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={boardView === tab.id}
              className={boardView === tab.id ? "is-active" : ""}
              onClick={() => setBoardView(tab.id)}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pd-board-controls">
          <button type="button" className="pd-chip-btn">
            <Icon name="filter_list" size={16} />
            Filters
          </button>
          <button type="button" className="pd-chip-btn">
            Group: Assignee
            <Icon name="expand_more" size={16} />
          </button>
          <button type="button" className="pd-chip-btn">
            <Icon name="view_week" size={16} />
            Columns
          </button>
        </div>
      </div>

      {boardView === "board" && (
        <section className="pd-kanban" aria-label="Project board">
          {COLUMNS.map((col) => {
            const colTasks = tasksByStatus[col.id];
            const pts = colTasks.reduce((s, t) => s + derivePoints(t), 0);
            return (
              <div key={col.id} className={`pd-column ${col.accent}`}>
                <header className="pd-column-header">
                  <div className="pd-column-title">
                    <span className="pd-column-dot" aria-hidden="true" />
                    <h2>{col.title}</h2>
                  </div>
                  <div className="pd-column-stats">
                    <span>{colTasks.length} tasks</span>
                    <span>{pts} pts</span>
                  </div>
                </header>

                <div className="pd-column-body">
                  {colTasks.length === 0 && (
                    <p className="pd-column-empty">No tasks in this column</p>
                  )}
                  {colTasks.map((task) => {
                    const prio = derivePriority(task);
                    const ptsVal = derivePoints(task);
                    const assignee = task.assignee;
                    return (
                      <article
                        key={task.id}
                        className="pd-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/tasks/${task.id}`);
                          }
                        }}
                      >
                        <div className="pd-card-top">
                          <span className="pd-card-id">{taskCode(project, task)}</span>
                          <span className={`pd-prio ${prio.className}`}>{prio.label}</span>
                        </div>
                        <h3 className="pd-card-title">{task.title}</h3>
                        {task.description && (
                          <p className="pd-card-desc">
                            {task.description.length > 90
                              ? `${task.description.slice(0, 90)}…`
                              : task.description}
                          </p>
                        )}
                        <footer className="pd-card-footer">
                          <span className="pd-card-meta">
                            <Icon name="calendar_today" size={14} />
                            {col.id === "Completed"
                              ? "Done"
                              : formatShortDate(project.endDate, "No due")}
                          </span>
                          <span className="pd-card-pts">{ptsVal} pts</span>
                          {assignee ? (
                            <span
                              className={`pd-avatar pd-avatar-sm ${
                                AVATAR_TONES[Math.abs(assignee.id) % AVATAR_TONES.length]
                              }`}
                              title={`${assignee.firstName} ${assignee.lastName}`}
                            >
                              {initials(assignee.firstName, assignee.lastName)}
                            </span>
                          ) : (
                            <span className="pd-avatar pd-avatar-sm tone-slate" title="Unassigned">
                              ?
                            </span>
                          )}
                        </footer>
                        {col.id !== "Completed" && (
                          <button
                            type="button"
                            className="pd-card-advance"
                            disabled={busyTaskId === task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void advanceTask(task);
                            }}
                          >
                            {busyTaskId === task.id
                              ? "Updating…"
                              : col.id === "Pending"
                                ? "Start"
                                : "Complete"}
                          </button>
                        )}
                        {col.id === "Completed" && (
                          <div className="pd-card-done">
                            <Icon name="check_circle" size={16} />
                            Shipped
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="pd-create-in-col"
                  onClick={() => setCreateOpen(true)}
                >
                  <Icon name="add" size={16} />
                  Create Task
                </button>
              </div>
            );
          })}
        </section>
      )}

      {boardView === "list" && (
        <section className="pd-list-view">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {boardTasks.map((task) => (
                <tr key={task.id} onClick={() => navigate(`/tasks/${task.id}`)}>
                  <td>{taskCode(project, task)}</td>
                  <td>{task.title}</td>
                  <td>{task.status}</td>
                  <td>
                    {task.assignee
                      ? `${task.assignee.firstName} ${task.assignee.lastName}`
                      : "—"}
                  </td>
                  <td>{derivePoints(task)}</td>
                </tr>
              ))}
              {boardTasks.length === 0 && (
                <tr>
                  <td colSpan={5}>No tasks yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {boardView === "gantt" && (
        <section className="pd-gantt-placeholder">
          <Icon name="view_timeline" size={28} />
          <p>Timeline view uses project start and end dates.</p>
          <p className="pd-muted">
            {formatDate(project.startDate)} → {formatDate(project.endDate, "Open-ended")}
          </p>
        </section>
      )}

      <section className="pd-analytics" aria-label="Sprint analytics and team">
        <article className="pd-panel pd-burndown">
          <header className="pd-panel-header">
            <div>
              <h2>{burndown?.sprintLabel ?? "Sprint"} Burndown</h2>
              <p className="pd-muted">Remaining work vs ideal pace</p>
            </div>
            <div className="pd-burndown-metrics">
              <div>
                <strong>{burndown?.remaining ?? 0} pts</strong>
                <span>remaining</span>
              </div>
              <div>
                <strong>{burndown?.daysLeft ?? 0}</strong>
                <span>Days Left</span>
              </div>
              <div>
                <strong>~{burndown?.pace ?? "0"} pts / day</strong>
                <span>needed</span>
              </div>
            </div>
          </header>

          {burndown && (
            <div className="pd-chart-wrap">
              <svg
                className="pd-chart"
                viewBox={`0 0 ${chartW} ${chartH}`}
                role="img"
                aria-label="Burndown chart"
              >
                <polyline
                  fill="none"
                  stroke="#c5c6d0"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  points={toPolyline(burndown.ideal, chartW, chartH)}
                />
                <polyline
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={toPolyline(burndown.actual, chartW, chartH)}
                />
              </svg>
              <div className="pd-chart-labels">
                <span>Day 1 ({burndown.totalPts} pts)</span>
                <span>
                  Day {burndown.elapsed} (Now)
                </span>
                <span>Day {burndown.totalDays} (Target: 0)</span>
              </div>
            </div>
          )}

          <footer className="pd-burndown-footer">
            <Icon
              name={burndown?.healthy ? "check_circle" : "warning"}
              size={16}
            />
            <span>Sprint Health</span>
            <strong className={burndown?.healthy ? "is-good" : "is-warn"}>
              {burndown?.healthy ? "Optimal Pace" : "Behind Pace"}
            </strong>
          </footer>
        </article>

        <article className="pd-panel pd-milestones">
          <header className="pd-panel-header">
            <h2>Active Milestones</h2>
            <span className="pd-muted">
              {milestones.filter((m) => m.status === "done").length} of {milestones.length} Done
            </span>
          </header>
          <ul className="pd-milestone-list">
            {milestones.map((m) => (
              <li key={m.id} className={`pd-milestone status-${m.status}`}>
                <div className="pd-milestone-top">
                  <span className="pd-milestone-name">{m.name}</span>
                  <span className="pd-milestone-pct">{m.pct}%</span>
                </div>
                <div className="pd-milestone-track">
                  <div
                    className="pd-milestone-fill"
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
                <div className="pd-milestone-meta">
                  <span>{m.detail}</span>
                  <span>Target: {m.target}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="pd-panel pd-team">
          <header className="pd-panel-header">
            <h2>Assigned Team</h2>
            <button type="button" className="pd-invite">
              <Icon name="person_add" size={16} />
              Invite
            </button>
          </header>
          <ul className="pd-team-list">
            {teamWithCounts.length === 0 && (
              <li className="pd-team-empty">No members assigned yet.</li>
            )}
            {teamWithCounts.map(({ member, roleName, count }, i) => (
              <li key={member.userId} className="pd-team-row">
                <span
                  className={`pd-avatar ${AVATAR_TONES[i % AVATAR_TONES.length]}`}
                >
                  {initials(member.firstName, member.lastName)}
                </span>
                <div className="pd-team-meta">
                  <span className="pd-team-name">
                    {member.firstName} {member.lastName}
                    {i === 0 && <em>Project Lead</em>}
                  </span>
                  <span className="pd-team-role">{roleName}</span>
                </div>
                <span className="pd-task-count">
                  {count} task{count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {createOpen && (
        <div
          className="pd-modal-backdrop"
          role="presentation"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="pd-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pd-create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pd-modal-header">
              <h2 id="pd-create-title">New Issue</h2>
              <button
                type="button"
                className="pd-icon-btn"
                aria-label="Close"
                onClick={() => setCreateOpen(false)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <form className="pd-modal-form" onSubmit={(e) => void handleCreate(e)}>
              <label>
                Title
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Issue title"
                  autoFocus
                />
              </label>
              <label>
                Description
                <textarea
                  required
                  maxLength={2000}
                  rows={4}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Describe the work"
                />
              </label>
              <div className="pd-modal-footer">
                <button
                  type="button"
                  className="pd-btn pd-btn-secondary"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pd-btn pd-btn-primary"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? "Creating…" : "Create Issue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailsPage;
