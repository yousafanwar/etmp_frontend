import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import Icon from "../../components/common/Icon";
import TopbarUser from "../../components/layout/TopbarUser";
import {
  analyzeAndCreateTask,
  assignTask,
  createTask,
} from "../../services/TaskService";
import {
  getProjectSkills,
  getProjects,
  getProjectUsers,
} from "../../services/projectService";
import { getRoles, getUsers } from "../../services/userService";
import type { Project, ProjectSkill, ProjectUser } from "../../types/project";
import type { TaskPriority } from "../../types/task";
import type { User } from "../../types/user";
import "./CreateTask.css";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 500;
const FEEDBACK_MAX = 4000;

const PRIORITIES: {
  value: TaskPriority;
  label: string;
  dotClass: string;
}[] = [
  { value: "Low", label: "Low", dotClass: "ct-prio-dot-low" },
  { value: "Medium", label: "Medium", dotClass: "ct-prio-dot-medium" },
  { value: "High", label: "High", dotClass: "ct-prio-dot-high" },
  { value: "Urgent", label: "Urgent", dotClass: "ct-prio-dot-urgent" },
];

const AVATAR_TONES = ["purple", "blue", "green", "amber", "rose", "teal"] as const;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const getAvatarTone = (id: number) => AVATAR_TONES[Math.abs(id) % AVATAR_TONES.length];

const displayName = (user: { firstName: string; lastName: string; email: string }) =>
  `${user.firstName} ${user.lastName}`.trim() || user.email;

const errorMessage = (err: unknown, fallback: string) => {
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

const CreateTask = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assigneeMenuRef = useRef<HTMLDivElement>(null);
  const createHandlerRef = useRef<() => void>(() => undefined);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSkills, setProjectSkills] = useState<ProjectSkill[]>([]);
  const [projectUsers, setProjectUsers] = useState<ProjectUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roleNames, setRoleNames] = useState<Record<number, string>>({});

  const [projectId, setProjectId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("High");
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [skillQuery, setSkillQuery] = useState("");
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [aiSynthesized, setAiSynthesized] = useState(false);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedProjectId = Number(projectId);
  const hasValidProject =
    Number.isInteger(selectedProjectId) && selectedProjectId > 0;

  const assigneeOptions = useMemo(() => {
    if (projectUsers.length > 0) {
      return projectUsers.map((pu) => {
        const full = users.find((u) => u.id === pu.userId);
        return {
          id: pu.userId,
          firstName: pu.firstName,
          lastName: pu.lastName,
          email: pu.email,
          roleId: full?.roleId ?? 0,
        };
      });
    }
    return users;
  }, [projectUsers, users]);

  const selectedAssignee = useMemo(
    () => assigneeOptions.find((u) => u.id === assigneeId) ?? null,
    [assigneeOptions, assigneeId],
  );

  const skillById = useMemo(
    () => new Map(projectSkills.map((s) => [s.skillId, s])),
    [projectSkills],
  );

  const availableSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    return projectSkills.filter((s) => {
      if (selectedSkillIds.includes(s.skillId)) return false;
      if (!q) return true;
      return s.skillName.toLowerCase().includes(q);
    });
  }, [projectSkills, selectedSkillIds, skillQuery]);

  const canUseAi = hasValidProject && (feedback.trim().length > 0 || !!attachment);
  const canCreateManual =
    hasValidProject && title.trim().length > 0 && description.trim().length > 0;
  const canSubmit = canUseAi || canCreateManual;
  const isBusy = analyzing || submitting;

  // Load projects + directory
  useEffect(() => {
    const controller = new AbortController();
    setLoadingMeta(true);

    Promise.all([
      getProjects(controller.signal),
      getUsers(controller.signal).catch(() => [] as User[]),
      getRoles(controller.signal).catch(() => [] as Awaited<ReturnType<typeof getRoles>>),
    ])
      .then(([projectList, userList, roles]) => {
        if (controller.signal.aborted) return;
        const list = Array.isArray(projectList) ? projectList : [];
        setProjects(list);
        setUsers(Array.isArray(userList) ? userList : []);
        setRoleNames(Object.fromEntries(roles.map((r) => [r.id, r.name])));

        const fromQuery = Number(searchParams.get("projectId"));
        if (Number.isInteger(fromQuery) && fromQuery > 0 && list.some((p) => p.id === fromQuery)) {
          setProjectId(String(fromQuery));
        } else if (list.length === 1) {
          setProjectId(String(list[0].id));
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(err, "Failed to load projects."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingMeta(false);
      });

    return () => controller.abort();
  }, [searchParams]);

  // Load project skills + members when project changes
  useEffect(() => {
    if (!hasValidProject) {
      setProjectSkills([]);
      setProjectUsers([]);
      setSelectedSkillIds([]);
      setAssigneeId(null);
      return;
    }

    const controller = new AbortController();
    Promise.all([
      getProjectSkills(selectedProjectId, controller.signal).catch(() => [] as ProjectSkill[]),
      getProjectUsers(selectedProjectId, controller.signal).catch(() => [] as ProjectUser[]),
    ])
      .then(([skills, members]) => {
        if (controller.signal.aborted) return;
        setProjectSkills(Array.isArray(skills) ? skills : []);
        setProjectUsers(Array.isArray(members) ? members : []);
        setSelectedSkillIds([]);
        setAssigneeId(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load project staffing data", err);
      });

    return () => controller.abort();
  }, [hasValidProject, selectedProjectId]);

  useEffect(() => {
    if (!assigneeMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!assigneeMenuRef.current?.contains(e.target as Node)) {
        setAssigneeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [assigneeMenuOpen]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        createHandlerRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addSkill = (skillId: number) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId) ? prev : [...prev, skillId],
    );
    setSkillQuery("");
  };

  const removeSkill = (skillId: number) => {
    setSelectedSkillIds((prev) => prev.filter((id) => id !== skillId));
  };

  const handleSkillKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = skillQuery.trim().toLowerCase();
    const match =
      availableSkills.find((s) => s.skillName.toLowerCase() === q) ??
      availableSkills[0];
    if (match) addSkill(match.skillId);
  };

  const onPickFile = (fileList: FileList | null) => {
    const file = fileList?.[0] ?? null;
    if (!file) {
      setAttachment(null);
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Unsupported image format. Use JPEG, PNG, GIF, or WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setError("");
    setAttachment(file);
  };

  const clearAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitViaAi = async () => {
    if (!canUseAi || isBusy) return;
    setAnalyzing(true);
    setError("");
    try {
      const task = await analyzeAndCreateTask({
        projectId: selectedProjectId,
        feedbackText: feedback.trim(),
        image: attachment,
      });
      setAiSynthesized(true);
      setTitle(task.title);
      setDescription(task.description);
      setSelectedSkillIds(task.requiredSkillIds ?? []);
      setAssigneeId(task.assignee?.id ?? null);
      navigate(`/tasks/${task.id}`, { replace: true });
    } catch (err: unknown) {
      setError(errorMessage(err, "AI could not draft this task. Please try again."));
    } finally {
      setAnalyzing(false);
    }
  };

  const submitManual = async (asDraft: boolean) => {
    if (!canCreateManual || isBusy) return;
    setSubmitting(true);
    setError("");
    try {
      let task = await createTask(
        title.trim().slice(0, TITLE_MAX),
        description.trim().slice(0, DESCRIPTION_MAX),
        selectedProjectId,
      );
      if (!asDraft && assigneeId) {
        try {
          task = await assignTask(task.id, assigneeId);
        } catch (assignErr: unknown) {
          console.error("Task created but assign failed", assignErr);
          navigate(`/tasks/${task.id}`, { replace: true });
          return;
        }
      }
      navigate(`/tasks/${task.id}`, { replace: true });
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to create task."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (isBusy) return;
    // Prefer AI path when feedback/image is present — matches backend analyze-and-create.
    if (canUseAi) {
      await submitViaAi();
      return;
    }
    if (canCreateManual) {
      await submitManual(false);
      return;
    }
    setError(
      "Select a project, then either describe your objective for Copilot or fill in title and description.",
    );
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleCreate();
  };

  createHandlerRef.current = () => {
    void handleCreate();
  };

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  return (
    <div className="create-task-page">
      <header className="ct-topbar">
        <div className="ct-breadcrumbs">
          <Link to="/tasks">Tasks</Link>
          <Icon name="chevron_right" size={14} />
          <span className="is-current">New Workflow Item</span>
        </div>
        <div className="ct-topbar-right">
          <button type="button" className="ct-icon-btn" aria-label="Notifications">
            <Icon name="notifications" size={22} />
            <span className="ct-notif-badge">3</span>
          </button>
          <TopbarUser />
        </div>
      </header>

      <div className="ct-shell">
        <div className="ct-header">
          <div>
            <div className="ct-eyebrow">
              <span>Tasks</span>
              <Icon name="chevron_right" size={14} />
              <span className="ct-eyebrow-current">New Workflow Item</span>
            </div>
            <h1>Create New Task</h1>
            <p className="ct-subtitle">
              Describe what needs to be done. ETMP Copilot will help draft details and find the
              right assignee.
            </p>
          </div>

          <div className="ct-project-field">
            <label htmlFor="ct-project">Target Project</label>
            <div className="ct-select-wrap">
              <select
                id="ct-project"
                value={projectId}
                disabled={loadingMeta || projects.length === 0}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">
                  {loadingMeta
                    ? "Loading projects…"
                    : projects.length === 0
                      ? "No projects available"
                      : "Select a project"}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Icon name="expand_more" size={20} className="ct-select-chevron" />
            </div>
          </div>
        </div>

        {error && (
          <div className="ct-banner ct-banner-error" role="alert">
            {error}
            <button type="button" onClick={() => setError("")} aria-label="Dismiss">
              <Icon name="close" size={16} />
            </button>
          </div>
        )}

        <form className="ct-card" onSubmit={handleFormSubmit}>
          {/* AI intake */}
          <section className="ct-ai-panel">
            <div className="ct-ai-panel-head">
              <div className="ct-ai-label">
                <Icon name="auto_awesome" size={20} />
                <span>Describe your objective or report</span>
              </div>
              <span className="ct-chip">Markdown supported</span>
            </div>

            <textarea
              className="ct-feedback"
              rows={3}
              maxLength={FEEDBACK_MAX}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Describe the issue, bug, or feature in plain language… (e.g. Memory pressure on Zurich Redis nodes triggering latency alarms on queue consumers)"
              disabled={isBusy}
            />

            <div className="ct-ai-actions">
              <div className="ct-attach-row">
                <label className="ct-attach-btn">
                  <Icon name="attach_file" size={18} />
                  <span>Attach image or logs</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    hidden
                    disabled={isBusy}
                    onChange={(e) => onPickFile(e.target.files)}
                  />
                </label>
                {attachment && (
                  <div className="ct-file-pill">
                    <Icon name="image" size={16} />
                    <span className="ct-file-name">{attachment.name}</span>
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      onClick={clearAttachment}
                      disabled={isBusy}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="ct-btn ct-btn-ai"
                disabled={!canUseAi || isBusy}
                onClick={() => void submitViaAi()}
              >
                <Icon name={analyzing ? "sync" : "auto_awesome"} size={18} />
                {analyzing ? "Analyzing…" : "Auto-Draft with AI"}
              </button>
            </div>
          </section>

          <div className="ct-divider">
            <span className="ct-divider-line" />
            <span className="ct-divider-label">
              <span className="ct-divider-dot" />
              Structured Details
            </span>
            <span className="ct-divider-line" />
          </div>

          <div className="ct-fields">
            <div className="ct-field">
              <label htmlFor="ct-title" className="ct-field-label">
                <span>Task Title</span>
                <span className="ct-required">Required</span>
              </label>
              <input
                id="ct-title"
                type="text"
                maxLength={TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Upgrade node cluster to v2.4"
                disabled={isBusy}
              />
            </div>

            <div className="ct-field">
              <span className="ct-field-label">Priority Level</span>
              <div className="ct-priority-grid" role="group" aria-label="Priority level">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`ct-priority-opt ${priority === p.value ? `is-selected is-${p.value.toLowerCase()}` : ""}`}
                    onClick={() => setPriority(p.value)}
                    disabled={isBusy}
                  >
                    <span className={`ct-prio-dot ${p.dotClass}`} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ct-field">
              <div className="ct-field-label-row">
                <label htmlFor="ct-description" className="ct-field-label">
                  Description &amp; Acceptance Criteria
                </label>
                {aiSynthesized && (
                  <span className="ct-ai-badge">
                    <Icon name="edit_note" size={16} />
                    AI Auto-Synthesized
                  </span>
                )}
              </div>
              <textarea
                id="ct-description"
                rows={6}
                maxLength={DESCRIPTION_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add relevant technical context, reproduction steps, or explicit deliverables…"
                disabled={isBusy}
              />
              <p className="ct-hint">
                {description.length}/{DESCRIPTION_MAX} characters
              </p>
            </div>

            <div className="ct-split">
              <div className="ct-field">
                <span className="ct-field-label">Required Skills</span>
                <div className="ct-skills">
                  {selectedSkillIds.map((id) => {
                    const skill = skillById.get(id);
                    return (
                      <span key={id} className="ct-skill-chip">
                        <span>{skill?.skillName ?? `Skill #${id}`}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${skill?.skillName ?? id}`}
                          onClick={() => removeSkill(id)}
                          disabled={isBusy}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </span>
                    );
                  })}
                  <input
                    type="text"
                    className="ct-skill-input"
                    value={skillQuery}
                    onChange={(e) => setSkillQuery(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    placeholder={
                      !hasValidProject
                        ? "Select a project first"
                        : projectSkills.length === 0
                          ? "No project skills"
                          : "+ Add skill"
                    }
                    disabled={isBusy || !hasValidProject || projectSkills.length === 0}
                    list="ct-skill-suggestions"
                  />
                  <datalist id="ct-skill-suggestions">
                    {availableSkills.map((s) => (
                      <option key={s.skillId} value={s.skillName} />
                    ))}
                  </datalist>
                </div>
                {skillQuery.trim() && availableSkills.length > 0 && (
                  <ul className="ct-skill-menu">
                    {availableSkills.slice(0, 6).map((s) => (
                      <li key={s.skillId}>
                        <button type="button" onClick={() => addSkill(s.skillId)}>
                          {s.skillName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="ct-hint">
                  Press Enter to append tags. Copilot uses project skills when auto-drafting.
                </p>
              </div>

              <div className="ct-field" ref={assigneeMenuRef}>
                <div className="ct-field-label-row">
                  <span className="ct-field-label">Assignee</span>
                  <button
                    type="button"
                    className="ct-link-btn"
                    onClick={() => setAssigneeMenuOpen((o) => !o)}
                    disabled={isBusy || assigneeOptions.length === 0}
                  >
                    Change
                  </button>
                </div>

                <div className={`ct-assignee ${selectedAssignee ? "" : "is-empty"}`}>
                  {selectedAssignee ? (
                    <>
                      <div className="ct-assignee-main">
                        <span
                          className={`ct-avatar ct-avatar-${getAvatarTone(selectedAssignee.id)}`}
                        >
                          {getInitials(displayName(selectedAssignee))}
                        </span>
                        <div className="ct-assignee-meta">
                          <div className="ct-assignee-name-row">
                            <span className="ct-assignee-name">
                              {displayName(selectedAssignee)}
                            </span>
                            <span className="ct-match-badge">Skill match</span>
                          </div>
                        </div>
                      </div>
                      <span className="ct-assignee-role">
                        {roleNames[selectedAssignee.roleId] || "Team member"}
                      </span>
                    </>
                  ) : (
                    <span className="ct-assignee-placeholder">
                      {assigneeOptions.length === 0
                        ? "No project members available"
                        : "Unassigned — Copilot will suggest a match"}
                    </span>
                  )}
                </div>

                {assigneeMenuOpen && (
                  <ul className="ct-assignee-menu" role="listbox">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setAssigneeId(null);
                          setAssigneeMenuOpen(false);
                        }}
                      >
                        Unassigned
                      </button>
                    </li>
                    {assigneeOptions.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className={assigneeId === u.id ? "is-active" : ""}
                          onClick={() => {
                            setAssigneeId(u.id);
                            setAssigneeMenuOpen(false);
                          }}
                        >
                          <span
                            className={`ct-avatar ct-avatar-sm ct-avatar-${getAvatarTone(u.id)}`}
                          >
                            {getInitials(displayName(u))}
                          </span>
                          <span>
                            {displayName(u)}
                            <small>{u.email}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="ct-hint">
                  Suggested from project membership and skill overlap on AI create.
                </p>
              </div>
            </div>
          </div>

          <footer className="ct-footer">
            <div className="ct-footer-status">
              <Icon
                name={canUseAi || canCreateManual ? "check_circle" : "info"}
                size={16}
              />
              <span>
                {analyzing
                  ? "Copilot is analyzing your report…"
                  : canUseAi
                    ? "Copilot ready — Create Task will analyze and deploy"
                    : canCreateManual
                      ? "Manual draft ready for deployment"
                      : "Add an objective or fill title & description to continue"}
              </span>
            </div>
            <div className="ct-footer-actions">
              <button
                type="button"
                className="ct-btn ct-btn-ghost"
                onClick={() => navigate(-1)}
                disabled={isBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ct-btn ct-btn-secondary"
                disabled={!canCreateManual || isBusy}
                onClick={() => void submitManual(true)}
                title="Create as pending without assignee"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                className="ct-btn ct-btn-primary"
                disabled={!canSubmit || isBusy}
              >
                <Icon name={isBusy ? "sync" : "add_task"} size={20} />
                {analyzing
                  ? "Analyzing…"
                  : submitting
                    ? "Creating…"
                    : "Create Task"}
              </button>
            </div>
          </footer>
        </form>

        <p className="ct-protip">
          <Icon name="keyboard" size={18} />
          <span>
            Pro tip: Press{" "}
            <kbd>{isMac ? "Cmd" : "Ctrl"} + Enter</kbd> to rapidly submit this task anywhere on
            the form.
          </span>
        </p>
      </div>
    </div>
  );
};

export default CreateTask;
