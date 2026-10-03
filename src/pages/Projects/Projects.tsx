import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../../components/common/Icon";
import TopbarUser from "../../components/layout/TopbarUser";
import { createProject, getProjects, getProjectUsers } from "../../services/projectService";
import type { Project, ProjectStatus, ProjectUser } from "../../types/project";
import "./Projects.css";

const PAGE_SIZE_OPTIONS = [6, 12, 24];

type ViewMode = "grid" | "list" | "timeline";
type StatusFilter = "all" | ProjectStatus;
type OwnerFilter = "everyone" | number;

const STATUS_META: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  OnTrack: { label: "On Track", className: "status-on-track" },
  AtRisk: { label: "At Risk", className: "status-at-risk" },
  Delayed: { label: "Delayed", className: "status-delayed" },
  InReview: { label: "In Review", className: "status-in-review" },
};

const CATEGORIES = [
  "INFRASTRUCTURE",
  "FINTECH / CORE",
  "SECURITY & LEGAL",
  "DESIGN SYSTEMS",
  "DATA & AI",
  "WEB APPLICATIONS",
] as const;

const AVATAR_TONES = ["tone-indigo", "tone-teal", "tone-amber", "tone-rose", "tone-slate"] as const;

const toDate = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDate = (value: string | null | undefined) => {
  const d = toDate(value);
  if (!d) return "No due date";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

const initials = (first: string, last: string) =>
  `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";

/** Derive a display status until the API exposes one. */
const deriveStatus = (project: Project): ProjectStatus => {
  const end = toDate(project.endDate);
  if (!end) {
    return project.id % 5 === 0 ? "InReview" : "OnTrack";
  }
  const now = new Date();
  const msLeft = end.getTime() - now.getTime();
  const daysLeft = msLeft / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return "Delayed";
  if (daysLeft <= 14) return "AtRisk";
  if (project.id % 7 === 0) return "InReview";
  return "OnTrack";
};

const deriveCategory = (project: Project) =>
  CATEGORIES[Math.abs(project.id) % CATEGORIES.length];

const deriveCompletion = (project: Project) => {
  const start = toDate(project.startDate);
  const end = toDate(project.endDate);
  if (!start || !end || end <= start) {
    return 40 + (Math.abs(project.id) * 7) % 55;
  }
  const now = Date.now();
  const ratio = (now - start.getTime()) / (end.getTime() - start.getTime());
  return Math.max(8, Math.min(98, Math.round(ratio * 100)));
};

const deriveTaskProgress = (project: Project) => {
  const total = 60 + (Math.abs(project.id) * 11) % 80;
  const done = Math.round((deriveCompletion(project) / 100) * total);
  return { done, total };
};

type Highlight =
  | { kind: "pace"; label: string; value: string }
  | { kind: "blocker"; message: string }
  | { kind: "stage"; label: string; value: string; pct: number }
  | { kind: "catalog"; label: string; value: string }
  | { kind: "overrun"; badge: string; tag: string }
  | { kind: "demo"; label: string; value: string };

const deriveHighlight = (project: Project, status: ProjectStatus): Highlight => {
  const variant = Math.abs(project.id) % 6;
  if (status === "Delayed" || variant === 4) {
    const days = Math.max(1, Math.abs(project.id % 12) || 8);
    return { kind: "overrun", badge: `SPRINT OVERRUN: +${days} DAYS`, tag: "Schedule pressure" };
  }
  if (status === "AtRisk" || variant === 1) {
    return {
      kind: "blocker",
      message: project.description.slice(0, 64) || "External dependency blocking progress",
    };
  }
  switch (variant) {
    case 0:
      return {
        kind: "pace",
        label: "EXECUTION PACE",
        value: `+${(8 + (project.id % 10)).toFixed(1)}% / sprint`,
      };
    case 2:
      return {
        kind: "stage",
        label: "AUDITOR SIGN-OFF",
        value: "Stage 4 of 4 Ready",
        pct: 100,
      };
    case 3:
      return {
        kind: "catalog",
        label: "TOKENS CATALOG",
        value: `${80 + (project.id % 90)} Components Synced`,
      };
    default:
      return {
        kind: "demo",
        label: "STAKEHOLDER DEMO",
        value: "Passed QA Testing",
      };
  }
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

const HighlightBlock = ({ highlight }: { highlight: Highlight }) => {
  switch (highlight.kind) {
    case "pace":
      return (
        <div className="proj-highlight proj-highlight-pace">
          <div>
            <span className="proj-highlight-label">{highlight.label}</span>
            <span className="proj-highlight-value is-success">{highlight.value}</span>
          </div>
          <svg className="proj-sparkline" viewBox="0 0 64 28" aria-hidden="true">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="2,22 12,18 22,20 32,12 42,14 52,6 62,8"
            />
          </svg>
        </div>
      );
    case "blocker":
      return (
        <div className="proj-highlight proj-highlight-blocker">
          <Icon name="warning" size={16} />
          <div>
            <span className="proj-highlight-label">Blocker</span>
            <span className="proj-highlight-value">{highlight.message}</span>
          </div>
        </div>
      );
    case "stage":
      return (
        <div className="proj-highlight proj-highlight-stage">
          <div>
            <span className="proj-highlight-label">{highlight.label}</span>
            <span className="proj-highlight-value">{highlight.value}</span>
          </div>
          <div
            className="proj-ring"
            style={{ "--pct": `${highlight.pct}` } as CSSProperties}
            aria-hidden="true"
          >
            <Icon name="verified" size={16} />
          </div>
        </div>
      );
    case "catalog":
      return (
        <div className="proj-highlight proj-highlight-catalog">
          <div>
            <span className="proj-highlight-label">{highlight.label}</span>
            <span className="proj-highlight-value">{highlight.value}</span>
          </div>
          <div className="proj-swatches" aria-hidden="true">
            <span className="swatch s1" />
            <span className="swatch s2" />
            <span className="swatch s3" />
            <span className="swatch s4" />
          </div>
        </div>
      );
    case "overrun":
      return (
        <div className="proj-highlight proj-highlight-overrun">
          <span className="proj-overrun-badge">{highlight.badge}</span>
          <span className="proj-overrun-tag">{highlight.tag}</span>
        </div>
      );
    case "demo":
      return (
        <div className="proj-highlight proj-highlight-demo">
          <div>
            <span className="proj-highlight-label">{highlight.label}</span>
            <span className="proj-highlight-value is-success">{highlight.value}</span>
          </div>
          <span className="proj-demo-check">
            <Icon name="check_circle" size={22} />
          </span>
        </div>
      );
  }
};

const TeamAvatars = ({ members }: { members: ProjectUser[] }) => {
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;

  if (members.length === 0) {
    return (
      <div className="proj-avatars">
        <span className="proj-avatar tone-slate" title="Unassigned">
          ?
        </span>
      </div>
    );
  }

  return (
    <div className="proj-avatars">
      {shown.map((m, i) => (
        <span
          key={m.userId}
          className={`proj-avatar ${AVATAR_TONES[i % AVATAR_TONES.length]}`}
          title={`${m.firstName} ${m.lastName}`}
        >
          {initials(m.firstName, m.lastName)}
        </span>
      ))}
      {extra > 0 && <span className="proj-avatar-extra">+{extra}</span>}
    </div>
  );
};

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamByProject, setTeamByProject] = useState<Record<number, ProjectUser[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [reloadKey, setReloadKey] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("everyone");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createStartDate, setCreateStartDate] = useState(toInputDate(new Date()));
  const [createEndDate, setCreateEndDate] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getProjects(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setProjects(Array.isArray(list) ? list : []);
        setSyncedAt(new Date());
        setError("");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError("Failed to load projects.");
        console.error(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
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

  const enriched = useMemo(
    () =>
      projects.map((project) => {
        const status = deriveStatus(project);
        return {
          project,
          status,
          category: deriveCategory(project),
          completion: deriveCompletion(project),
          tasks: deriveTaskProgress(project),
          highlight: deriveHighlight(project, status),
          members: teamByProject[project.id] ?? [],
        };
      }),
    [projects, teamByProject],
  );

  const ownerOptions = useMemo(() => {
    const byId = new Map<number, ProjectUser>();
    for (const members of Object.values(teamByProject)) {
      for (const m of members) byId.set(m.userId, m);
    }
    return [...byId.values()].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    );
  }, [teamByProject]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enriched.filter(({ project, status, category, members }) => {
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (ownerFilter !== "everyone" && !members.some((m) => m.userId === ownerFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        project.name.toLowerCase().includes(q) ||
        project.description.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q) ||
        String(project.id).includes(q)
      );
    });
  }, [enriched, search, statusFilter, ownerFilter]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const from = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalCount);
  const pageList = buildPageList(safePage, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    setTeamByProject({});
  }, [reloadKey]);

  const pageProjectIds = pageItems.map((item) => item.project.id).join(",");

  useEffect(() => {
    const ids = pageProjectIds
      ? pageProjectIds.split(",").map((id) => Number(id)).filter(Boolean)
      : [];
    if (ids.length === 0) return;

    const missing = ids.filter((id) => !(id in teamByProject));
    if (missing.length === 0) return;

    const controller = new AbortController();

    Promise.all(
      missing.map(async (id): Promise<[number, ProjectUser[]]> => {
        try {
          const users = await getProjectUsers(id, controller.signal);
          return [id, Array.isArray(users) ? users : []];
        } catch {
          return [id, []];
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      setTeamByProject((prev) => {
        const next = { ...prev };
        for (const [id, users] of entries) next[id] = users;
        return next;
      });
    });

    return () => controller.abort();
  }, [pageProjectIds, teamByProject]);

  const summary = useMemo(() => {
    const inProgress = enriched.filter((e) => e.status === "OnTrack" || e.status === "AtRisk").length;
    const attention = enriched.filter((e) => e.status === "Delayed" || e.status === "AtRisk").length;
    const inReview = enriched.filter((e) => e.status === "InReview").length;
    const onSchedule =
      enriched.length === 0
        ? 0
        : (enriched.filter((e) => e.status === "OnTrack" || e.status === "InReview").length /
            enriched.length) *
          100;
    return { inProgress, attention, inReview, onSchedule };
  }, [enriched]);

  const syncedLabel = (() => {
    if (!syncedAt) return "Not synced";
    const mins = Math.max(0, Math.round((Date.now() - syncedAt.getTime()) / 60000));
    if (mins <= 0) return "Synced just now";
    if (mins === 1) return "Synced 1m ago";
    return `Synced ${mins}m ago`;
  })();

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setActionError("");
    try {
      await createProject({
        name: createName.trim(),
        description: createDescription.trim(),
        startDate: new Date(createStartDate).toISOString(),
        endDate: createEndDate ? new Date(createEndDate).toISOString() : null,
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateStartDate(toInputDate(new Date()));
      setCreateEndDate("");
      setLoading(true);
      refresh();
    } catch (err: unknown) {
      console.error(err);
      setActionError("Failed to create project.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div className="projects-page">
      <header className="proj-topbar">
        <label className="proj-global-search">
          <Icon name="search" size={20} />
          <input
            type="search"
            placeholder="Search tasks, projects, people..."
            aria-label="Global search"
            readOnly
          />
        </label>
        <div className="proj-topbar-right">
          <button type="button" className="proj-icon-btn" aria-label="Notifications">
            <Icon name="notifications" size={20} />
            <span className="proj-notif-badge">3</span>
          </button>
          <TopbarUser />
        </div>
      </header>

      <nav className="proj-breadcrumbs" aria-label="Breadcrumb">
        <span>Workspaces</span>
        <Icon name="chevron_right" size={16} />
        <span className="is-current">Enterprise Projects</span>
      </nav>

      <div className="proj-title-row">
        <div className="proj-title-group">
          <h1>Projects</h1>
          <span className="proj-count-pill">
            {totalCount.toLocaleString()} ACTIVE PROJECTS
          </span>
        </div>

        <div className="proj-title-actions">
          <div className="proj-view-toggle" role="group" aria-label="View mode">
            {(
              [
                { id: "grid", label: "Grid", icon: "grid_view" },
                { id: "list", label: "List", icon: "view_list" },
                { id: "timeline", label: "Timeline", icon: "view_timeline" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={viewMode === opt.id ? "is-active" : ""}
                onClick={() => setViewMode(opt.id)}
              >
                <Icon name={opt.icon} size={16} />
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="proj-btn proj-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            <Icon name="add" size={18} />
            New Project
          </button>
        </div>
      </div>

      <div className="proj-toolbar">
        <label className="proj-search">
          <Icon name="search" size={18} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search by name, key, or tag..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search projects"
          />
        </label>

        <label className="proj-select">
          <span className="proj-select-label">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">All Active</option>
            <option value="OnTrack">On Track</option>
            <option value="AtRisk">At Risk</option>
            <option value="Delayed">Delayed</option>
            <option value="InReview">In Review</option>
          </select>
          <Icon name="expand_more" size={18} />
        </label>

        <label className="proj-select">
          <span className="proj-select-label">Owner:</span>
          <select
            value={ownerFilter === "everyone" ? "everyone" : String(ownerFilter)}
            onChange={(e) => {
              const v = e.target.value;
              setOwnerFilter(v === "everyone" ? "everyone" : Number(v));
              setPage(1);
            }}
          >
            <option value="everyone">Everyone</option>
            {ownerOptions.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
          <Icon name="expand_more" size={18} />
        </label>

        <button
          type="button"
          className="proj-sync"
          onClick={() => {
            setLoading(true);
            refresh();
          }}
        >
          <Icon name="sync" size={16} />
          {syncedLabel}
        </button>
      </div>

      {actionError && (
        <div className="proj-banner proj-banner-error" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError("")} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <section className="proj-kpi-grid" aria-label="Project summary">
        <article className="proj-kpi">
          <div className="proj-kpi-top">
            <span className="proj-kpi-label">IN PROGRESS</span>
            <span className="proj-kpi-icon tone-blue">
              <Icon name="trending_up" size={18} />
            </span>
          </div>
          <div className="proj-kpi-value">{summary.inProgress}</div>
        </article>
        <article className="proj-kpi">
          <div className="proj-kpi-top">
            <span className="proj-kpi-label">ATTENTION</span>
            <span className="proj-kpi-icon tone-error">
              <Icon name="warning" size={18} />
            </span>
          </div>
          <div className="proj-kpi-value is-error">{summary.attention}</div>
        </article>
        <article className="proj-kpi">
          <div className="proj-kpi-top">
            <span className="proj-kpi-label">IN REVIEW</span>
            <span className="proj-kpi-icon tone-blue">
              <Icon name="chat_bubble" size={18} />
            </span>
          </div>
          <div className="proj-kpi-value">{summary.inReview}</div>
        </article>
        <article className="proj-kpi">
          <div className="proj-kpi-top">
            <span className="proj-kpi-label">ON SCHEDULE</span>
            <span className="proj-kpi-icon tone-success">
              <Icon name="check_circle" size={18} />
            </span>
          </div>
          <div className="proj-kpi-value">{summary.onSchedule.toFixed(1)}%</div>
        </article>
      </section>

      <section className="proj-content">
        {loading && <p className="proj-state">Loading projects…</p>}
        {error && !loading && <p className="proj-state proj-state-error">{error}</p>}
        {!loading && !error && pageItems.length === 0 && (
          <p className="proj-state">No projects found.</p>
        )}

        {!loading && !error && pageItems.length > 0 && viewMode !== "timeline" && (
          <div className={viewMode === "grid" ? "proj-grid" : "proj-list"}>
            {pageItems.map(
              ({ project, status, category, completion, tasks, highlight, members }) => {
                const meta = STATUS_META[status];
                return (
                  <article
                    key={project.id}
                    className="proj-card"
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/projects/${project.id}`);
                      }
                    }}
                  >
                    <div className="proj-card-header">
                      <span className="proj-category">{category}</span>
                      <span className={`proj-status ${meta.className}`}>{meta.label}</span>
                    </div>
                    <h2 className="proj-card-title">{project.name}</h2>
                    <p className="proj-card-desc">{project.description}</p>

                    <HighlightBlock highlight={highlight} />

                    <div className="proj-progress">
                      <div className="proj-progress-meta">
                        <span>Completion</span>
                        <span className="proj-progress-pct">{completion}%</span>
                      </div>
                      <div className="proj-progress-track">
                        <div
                          className={`proj-progress-fill ${
                            status === "Delayed"
                              ? "is-error"
                              : status === "AtRisk"
                                ? "is-warn"
                                : "is-primary"
                          }`}
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                    </div>

                    <footer className="proj-card-footer">
                      <TeamAvatars members={members} />
                      <span className="proj-meta">
                        <Icon name="calendar_today" size={14} />
                        {formatDate(project.endDate ?? project.startDate)}
                      </span>
                      <span className="proj-meta">
                        <Icon name="check_circle" size={14} />
                        {tasks.done}/{tasks.total}
                      </span>
                    </footer>
                  </article>
                );
              },
            )}
          </div>
        )}

        {!loading && !error && pageItems.length > 0 && viewMode === "timeline" && (
          <div className="proj-timeline">
            {pageItems.map(({ project, status, category }) => {
              const meta = STATUS_META[status];
              return (
                <div
                  key={project.id}
                  className="proj-timeline-row"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/projects/${project.id}`);
                    }
                  }}
                >
                  <span className="proj-category">{category}</span>
                  <span className="proj-timeline-name">{project.name}</span>
                  <span className={`proj-status ${meta.className}`}>{meta.label}</span>
                  <span className="proj-meta">
                    <Icon name="calendar_today" size={14} />
                    {formatDate(project.startDate)} → {formatDate(project.endDate)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <footer className="proj-pagination">
          <span className="proj-page-info">
            Showing {from}–{to} of {totalCount.toLocaleString()} projects
          </span>

          <label className="proj-page-size">
            Items per page:
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

          <div className="proj-page-controls">
            <button
              type="button"
              className="proj-page-btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {pageList.map((item, idx) =>
              item === "…" ? (
                <span key={`e-${idx}`} className="proj-page-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`proj-page-btn ${item === safePage ? "is-active" : ""}`}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              className="proj-page-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      {createOpen && (
        <div
          className="proj-modal-backdrop"
          role="presentation"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="proj-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="proj-modal-header">
              <h2 id="create-project-title">New Project</h2>
              <button
                type="button"
                className="proj-icon-btn"
                aria-label="Close"
                onClick={() => setCreateOpen(false)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <form className="proj-modal-form" onSubmit={(e) => void handleCreate(e)}>
              <label>
                Name
                <input
                  type="text"
                  maxLength={100}
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Project name"
                  autoFocus
                />
              </label>
              <label>
                Description
                <textarea
                  maxLength={500}
                  required
                  rows={4}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="What is this project about?"
                />
              </label>
              <div className="proj-modal-row">
                <label>
                  Start date
                  <input
                    type="date"
                    required
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                  />
                </label>
                <label>
                  End date
                  <input
                    type="date"
                    value={createEndDate}
                    min={createStartDate || undefined}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                  />
                </label>
              </div>
              <div className="proj-modal-footer">
                <button
                  type="button"
                  className="proj-btn proj-btn-secondary"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="proj-btn proj-btn-primary"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? "Creating…" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
