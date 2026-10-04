import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import StatCard from "../../components/dashboard/StatCard";
import Icon from "../../components/common/Icon";
import { getProjectUsers, getProjects } from "../../services/projectService";
import { getTaskHistory, getTasks, getTaskStats } from "../../services/TaskService";
import { getRoles, getUsers } from "../../services/userService";
import type { Project, ProjectUser } from "../../types/project";
import type { Task } from "../../types/task";
import type { TaskHistory } from "../../types/taskHistory";
import type { Role, User } from "../../types/user";
import "./Dashboard.css";

type Tone = "primary" | "error" | "tertiary";
type RiskTone = "error" | "secondary" | "tertiary";
type Priority = "P0" | "P1";

interface MilestoneRow {
  projectId: number;
  project: string;
  dot: RiskTone;
  milestone: string;
  lead: string;
  due: string;
  risk: RiskTone;
  riskLabel: string;
}

interface UrgentAction {
  id: number;
  title: string;
  meta: string;
  priority: Priority;
}

interface WorkloadItem {
  team: string;
  pct: number;
  label: string;
  tone: Tone;
}

interface ActivityItem {
  id: number;
  initials: string;
  tone: "primary" | "error" | "neutral";
  badge: string;
  who: string;
  action: string;
  ref: string;
  refTone: "primary" | "error";
  time: string;
  team: string;
  taskId: number;
}

const toDate = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDate = (value: string | null | undefined, fallback = "No due date") => {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatRelativeTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
};

const fullName = (u: Pick<User, "firstName" | "lastName" | "email"> | ProjectUser) => {
  if ("userId" in u) {
    return `${u.firstName} ${u.lastName}`.trim() || u.email;
  }
  return `${u.firstName} ${u.lastName}`.trim() || u.email;
};

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

const deriveProjectRisk = (
  project: Project,
): { risk: RiskTone; riskLabel: string; sort: number } => {
  const end = toDate(project.endDate);
  if (!end) return { risk: "tertiary", riskLabel: "On Track", sort: 2 };
  const daysLeft = (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return { risk: "error", riskLabel: "High Risk", sort: 0 };
  if (daysLeft <= 14) return { risk: "secondary", riskLabel: "Medium Risk", sort: 1 };
  return { risk: "tertiary", riskLabel: "On Track", sort: 2 };
};

const milestoneLabel = (project: Project) => {
  const text = project.description?.trim();
  if (!text) return "Project delivery";
  return text.length > 64 ? `${text.slice(0, 64)}…` : text;
};

const historyBadge = (
  action: string,
): { badge: string; tone: "primary" | "error" | "neutral"; refTone: "primary" | "error" } => {
  if (action === "StatusChanged") {
    return { badge: "check", tone: "primary", refTone: "primary" };
  }
  if (action === "Assigned") {
    return { badge: "priority_high", tone: "error", refTone: "error" };
  }
  return { badge: "bookmark", tone: "neutral", refTone: "primary" };
};

const describeHistoryAction = (entry: TaskHistory) => {
  switch (entry.action) {
    case "Created":
      return "created task";
    case "Assigned":
      return "updated assignee on";
    case "StatusChanged":
      return entry.newValue === "Completed"
        ? "completed"
        : entry.newValue === "InProgress"
          ? "started"
          : "updated status on";
    default:
      return entry.action.toLowerCase();
  }
};

const UrgentItem = ({
  title,
  meta,
  priority,
  onReview,
}: UrgentAction & { onReview: () => void }) => {
  const [done, setDone] = useState(false);

  return (
    <div className={`urgent-item ${done ? "is-done" : ""}`}>
      <div className="urgent-item-top">
        <label className="urgent-item-check">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => setDone(e.target.checked)}
          />
          <div>
            <span className="urgent-item-title">{title}</span>
            <span className="urgent-item-meta">{meta}</span>
          </div>
        </label>
        <span className={`priority priority-${priority.toLowerCase()}`}>{priority}</span>
      </div>
      <div className="urgent-item-actions">
        <button type="button" className="btn-review" onClick={onReview}>
          Review
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<number, ProjectUser[]>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, completed: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);

    Promise.all([
      getTaskStats(signal),
      getProjects(signal),
      getTasks({ page: 1, pageSize: 100, sortBy: "id", sortOrder: "desc" }, signal),
      getUsers(signal).catch(() => [] as User[]),
      getRoles(signal).catch(() => [] as Role[]),
    ])
      .then(async ([taskStats, projectList, taskPage, userList, roleList]) => {
        const safeProjects = Array.isArray(projectList) ? projectList : [];
        const safeTasks = Array.isArray(taskPage?.items) ? taskPage.items : [];

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

        const historySeed = safeTasks.slice(0, 12);
        const historyPages = await Promise.all(
          historySeed.map(async (task) => {
            try {
              const history = await getTaskHistory(task.id, signal);
              return { task, history: Array.isArray(history) ? history : [] };
            } catch {
              return { task, history: [] as TaskHistory[] };
            }
          }),
        );

        if (signal.aborted) return;

        const activityItems = historyPages
          .flatMap(({ task, history }) =>
            history.map((entry) => {
              const who =
                entry.userName?.trim() ||
                (entry.userId ? `User #${entry.userId}` : "System");
              const meta = historyBadge(entry.action);
              return {
                id: entry.id,
                initials: initialsOf(who),
                tone: meta.tone,
                badge: meta.badge,
                who,
                action: describeHistoryAction(entry),
                ref: `#${task.id}`,
                refTone: meta.refTone,
                time: formatRelativeTime(entry.createdAt),
                team: task.projectName || "Workspace",
                taskId: task.id,
                createdAt: entry.createdAt,
              };
            }),
          )
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 9)
          .map(
            ({ createdAt: _createdAt, ...item }): ActivityItem => item,
          );

        setStats(taskStats);
        setProjects(safeProjects);
        setMembersByProject(Object.fromEntries(memberEntries));
        setTasks(safeTasks);
        setUsers(Array.isArray(userList) ? userList.filter(Boolean) : []);
        setRoles(Array.isArray(roleList) ? roleList : []);
        setActivity(activityItems);
        setError("");
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        console.error(err);
        setError(errorMessage(err, "Failed to load dashboard."));
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const activeTasks = stats.pending + stats.inProgress;
  const completionPct = stats.total
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  const atRiskProjects = useMemo(
    () => projects.filter((p) => deriveProjectRisk(p).sort < 2),
    [projects],
  );

  const unassignedOpen = useMemo(
    () =>
      tasks.filter(
        (t) => t.status !== "Completed" && t.assignee == null,
      ).length,
    [tasks],
  );

  const milestones = useMemo<MilestoneRow[]>(() => {
    return [...projects]
      .map((project) => {
        const { risk, riskLabel, sort } = deriveProjectRisk(project);
        const leadMember = membersByProject[project.id]?.[0];
        return {
          projectId: project.id,
          project: project.name,
          dot: risk,
          milestone: milestoneLabel(project),
          lead: leadMember ? fullName(leadMember) : "Unassigned",
          due: formatDate(project.endDate),
          risk,
          riskLabel,
          sort,
          endMs: toDate(project.endDate)?.getTime() ?? Number.POSITIVE_INFINITY,
        };
      })
      .sort((a, b) => a.sort - b.sort || a.endMs - b.endMs)
      .slice(0, 8)
      .map(({ sort: _sort, endMs: _endMs, ...row }) => row);
  }, [projects, membersByProject]);

  const urgentActions = useMemo<UrgentAction[]>(() => {
    return tasks
      .filter((t) => t.status === "Pending" || (t.status === "InProgress" && !t.assignee))
      .slice(0, 6)
      .map((t) => {
        const assignee = t.assignee
          ? fullName(t.assignee)
          : "Unassigned";
        const priority: Priority = !t.assignee || t.status === "Pending" ? "P0" : "P1";
        return {
          id: t.id,
          title: t.title,
          meta: `${t.projectName || "Project"} • ${assignee} • ${t.status}`,
          priority,
        };
      });
  }, [tasks]);

  const workload = useMemo<WorkloadItem[]>(() => {
    if (roles.length === 0 || users.length === 0) {
      const byProject = projects.slice(0, 4).map((project) => {
        const memberCount = membersByProject[project.id]?.length ?? 0;
        const openTasks = tasks.filter(
          (t) => t.projectId === project.id && t.status !== "Completed",
        ).length;
        const capacity = Math.max(1, memberCount) * 3;
        const pct = Math.round((openTasks / capacity) * 100);
        const tone: Tone = pct > 100 ? "error" : pct >= 80 ? "primary" : "tertiary";
        const label =
          pct > 100
            ? `${pct}% (Overbooked)`
            : pct < 60
              ? `${pct}% (Available)`
              : `${pct}%`;
        return { team: project.name, pct, label, tone };
      });
      return byProject;
    }

    return roles
      .map((role) => {
        const roleUsers = users.filter((u) => u.roleId === role.id);
        if (roleUsers.length === 0) return null;
        const userIds = new Set(roleUsers.map((u) => u.id));
        const assignedOpen = tasks.filter(
          (t) =>
            t.status !== "Completed" &&
            t.assignee != null &&
            userIds.has(t.assignee.id),
        ).length;
        const capacity = roleUsers.length * 3;
        const pct = Math.round((assignedOpen / capacity) * 100);
        const tone: Tone = pct > 100 ? "error" : pct >= 80 ? "primary" : "tertiary";
        const label =
          pct > 100
            ? `${pct}% (Overbooked)`
            : pct < 60
              ? `${pct}% (Available)`
              : `${pct}%`;
        return { team: role.name, pct, label, tone };
      })
      .filter((item): item is WorkloadItem => item != null)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [roles, users, tasks, projects, membersByProject]);

  const busiestRole = workload[0];
  const greetingName = currentUser?.displayName?.split(" ")[0] || "there";

  if (loading) {
    return (
      <div className="dashboard">
        <p className="dashboard-state">Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <p className="dashboard-state dashboard-state-error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <section className="card dashboard-hero">
        <div className="hero-text">
          <h1>Overview</h1>
          <p>
            Welcome back, {greetingName}. Tracking {projects.length} project
            {projects.length === 1 ? "" : "s"} and {activeTasks} active task
            {activeTasks === 1 ? "" : "s"}
            {atRiskProjects.length > 0
              ? ` — ${atRiskProjects.length} need attention.`
              : "."}
          </p>
        </div>

        <div className="hero-controls">
          <Link to="/projects" className="btn btn-subtle">
            <Icon name="domain" size={18} />
            All Projects
          </Link>
          <Link to="/tasks" className="btn btn-subtle">
            <Icon name="assignment" size={18} />
            All Tasks
          </Link>
          <Link to="/team" className="btn btn-primary">
            <Icon name="group" size={18} />
            Team
          </Link>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          title="Total Active Tasks"
          icon="assignment"
          value={activeTasks.toLocaleString()}
          badge={`${stats.total.toLocaleString()} total`}
          footerLeft={`${stats.inProgress} in progress`}
          footerRight={`${stats.pending} pending`}
          footerRightTone="success"
        />
        <StatCard
          title="Overdue / At Risk"
          icon="warning"
          iconTone="error"
          value={String(atRiskProjects.length)}
          valueTone={atRiskProjects.length > 0 ? "error" : "default"}
          badge={unassignedOpen > 0 ? `${unassignedOpen} Unassigned` : "Clear"}
          badgeTone={unassignedOpen > 0 ? "error" : "success"}
          footerLeft={
            atRiskProjects.length > 0
              ? "Projects near or past due"
              : "No schedule pressure"
          }
          footerRight="Triage queue"
          footerRightTone={atRiskProjects.length > 0 ? "error" : "default"}
        />
        <StatCard
          title="Task Completion"
          icon="task_alt"
          iconTone="tertiary"
          value={`${completionPct}%`}
          statusText={completionPct >= 60 ? "On Track" : "In Progress"}
          statusTone="success"
          footerLeft={`${stats.completed} completed`}
          footerRight={`${stats.total} total tasks`}
        />
      </section>

      <div className="main-grid">
        <section className="card milestones">
          <div className="card-header">
            <div>
              <h2>Critical Path &amp; At-Risk Projects</h2>
              <p>Projects sorted by schedule risk and upcoming end dates</p>
            </div>
            <button
              type="button"
              className="link-btn"
              onClick={() => navigate("/projects")}
            >
              Full Roadmap
              <Icon name="arrow_forward" size={18} />
            </button>
          </div>

          <div className="table-wrap">
            {milestones.length === 0 ? (
              <p className="dashboard-empty">No projects yet. Create one to populate this view.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Key Milestone</th>
                    <th>Assigned Lead</th>
                    <th>Due Date</th>
                    <th>Risk Status</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m) => (
                    <tr
                      key={m.projectId}
                      className="clickable-row"
                      onClick={() => navigate(`/projects/${m.projectId}`)}
                    >
                      <td>
                        <div className="cell-project">
                          <span className={`dot dot-${m.dot}`} />
                          {m.project}
                        </div>
                      </td>
                      <td className="muted">{m.milestone}</td>
                      <td>
                        <div className="cell-lead">
                          <span className="avatar-sm">{initialsOf(m.lead)}</span>
                          {m.lead}
                        </div>
                      </td>
                      <td className="muted num">{m.due}</td>
                      <td>
                        <span className={`risk-pill risk-${m.risk}`}>
                          <span className={`dot dot-sm dot-${m.risk}`} />
                          {m.riskLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className="side-column">
          <section className="card urgent">
            <div className="card-header">
              <div className="urgent-heading">
                <Icon name="bolt" className="text-error" />
                <h2>Urgent Actions</h2>
              </div>
              <span className="count-pill">{urgentActions.length} Awaiting</span>
            </div>
            <div className="urgent-list">
              {urgentActions.length === 0 ? (
                <p className="dashboard-empty">No pending actions right now.</p>
              ) : (
                urgentActions.map((a) => (
                  <UrgentItem
                    key={a.id}
                    {...a}
                    onReview={() => navigate(`/tasks/${a.id}`)}
                  />
                ))
              )}
            </div>
          </section>

          <section className="card workload">
            <div className="card-header">
              <h2>Team Workload</h2>
              <span className="workload-caption">Open task load</span>
            </div>
            <div className="workload-list">
              {workload.length === 0 ? (
                <p className="dashboard-empty">No team capacity data yet.</p>
              ) : (
                workload.map((w) => (
                  <div key={w.team} className="workload-row">
                    <div className="workload-labels">
                      <span className="workload-team">{w.team}</span>
                      <span className={`workload-value tone-text-${w.tone}`}>{w.label}</span>
                    </div>
                    <div className="progress">
                      <div
                        className={`progress-fill fill-${w.tone}`}
                        style={{ width: `${Math.min(w.pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            {busiestRole && busiestRole.pct > 100 && (
              <div className="callout">
                <Icon name="info" size={18} className="text-primary" />
                <span>
                  {busiestRole.team} is over capacity — consider rebalancing open tasks.
                </span>
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="card activity">
        <div className="card-header">
          <div>
            <h2>Operational Activity Stream</h2>
            <p>Recent task history across active work items</p>
          </div>
          <button
            type="button"
            className="link-btn link-btn-caps"
            onClick={() => navigate("/tasks")}
          >
            View All Tasks
          </button>
        </div>

        <div className="activity-grid">
          {activity.length === 0 ? (
            <p className="dashboard-empty">No recent activity recorded yet.</p>
          ) : (
            activity.map((a) => (
              <button
                key={a.id}
                type="button"
                className="activity-item activity-item-btn"
                onClick={() => navigate(`/tasks/${a.taskId}`)}
              >
                <div className="activity-avatar-wrap">
                  <div className={`activity-avatar avatar-${a.tone}`}>{a.initials}</div>
                  <Icon name={a.badge} size={12} className={`activity-badge badge-${a.tone}`} />
                </div>
                <div className="activity-body">
                  <p>
                    <strong>{a.who}</strong> {a.action}{" "}
                    <code className={`ref ref-${a.refTone}`}>{a.ref}</code>
                  </p>
                  <span className="activity-meta">
                    {a.time} • {a.team}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
