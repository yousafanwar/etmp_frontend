import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/common/Icon";
import TopbarUser from "../../components/layout/TopbarUser";
import AssigneeSelect from "../../components/tasks/AssigneeSelect";
import { createComment, getComments } from "../../services/commentService";
import { getSkills } from "../../services/skillService";
import {
  assignTask,
  completeTask,
  getTask,
  getTaskHistory,
  startTask,
  updateTask,
} from "../../services/TaskService";
import { getRoles, getUsers } from "../../services/userService";
import type { Comment } from "../../types/comment";
import type { Skill } from "../../types/skill";
import type { Task, TaskStatus } from "../../types/task";
import type { TaskHistory } from "../../types/taskHistory";
import type { User } from "../../types/user";
import "./TaskDetails.css";

type ActivityTab = "comments" | "history";

const STATUS_META: Record<
  TaskStatus,
  { label: string; className: string; icon: string }
> = {
  Pending: { label: "Todo", className: "status-todo", icon: "radio_button_unchecked" },
  InProgress: { label: "In Progress", className: "status-progress", icon: "pending" },
  Completed: { label: "Done", className: "status-done", icon: "check_circle" },
};

const AVATAR_TONES = ["purple", "blue", "green", "amber", "rose", "teal"] as const;

const formatTaskId = (id: number) => `#${id}`;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const getAvatarTone = (id: number) => AVATAR_TONES[Math.abs(id) % AVATAR_TONES.length];

const formatAbsoluteDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatRelativeTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return `Yesterday at ${date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  if (days < 7) return `${days} days ago`;
  return formatAbsoluteDate(iso);
};

const describeHistory = (entry: TaskHistory) => {
  const actor = entry.userName?.trim() || (entry.userId ? `User #${entry.userId}` : "System");
  switch (entry.action) {
    case "Created":
      return { actor, text: "created this task", detail: null as string | null };
    case "Assigned":
      return {
        actor,
        text: "changed assignee",
        detail:
          entry.oldValue || entry.newValue
            ? `${entry.oldValue ?? "Unassigned"} → ${entry.newValue ?? "Unassigned"}`
            : null,
      };
    case "StatusChanged":
      return {
        actor,
        text: "updated status",
        detail:
          entry.oldValue || entry.newValue
            ? `${entry.oldValue ?? "—"} → ${entry.newValue ?? "—"}`
            : null,
      };
    default:
      return {
        actor,
        text: entry.action.toLowerCase(),
        detail:
          entry.oldValue || entry.newValue
            ? `${entry.oldValue ?? "—"} → ${entry.newValue ?? "—"}`
            : null,
      };
  }
};

const userDisplayName = (user: User | undefined, userId: number) => {
  if (!user) return `User #${userId}`;
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
};

const TaskDetailsPage = () => {
  const { id } = useParams();
  return <TaskDetails key={id ?? "invalid"} />;
};

const TaskDetails = () => {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const taskId = Number(idParam);
  const invalidId = !Number.isInteger(taskId) || taskId <= 0;

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roleNames, setRoleNames] = useState<Record<number, string>>({});
  const [skillNames, setSkillNames] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(!invalidId);
  const [error, setError] = useState(invalidId ? "Invalid task id." : "");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState<ActivityTab>("comments");
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const usersById = useMemo(() => {
    const map = new Map<number, User>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const createdAt = useMemo(() => {
    const created = history.find((h) => h.action === "Created");
    return created?.createdAt ?? null;
  }, [history]);

  useEffect(() => {
    if (invalidId) return;
    const controller = new AbortController();

    Promise.all([
      getTask(taskId, controller.signal),
      getComments(taskId, controller.signal),
      getTaskHistory(taskId, controller.signal),
    ])
      .then(([taskResult, commentsResult, historyResult]) => {
        if (controller.signal.aborted) return;
        setTask(taskResult);
        setTitleDraft(taskResult.title);
        setDescriptionDraft(taskResult.description);
        setComments(
          [...commentsResult].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
        setHistory(
          [...historyResult].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
        setError("");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setError("Failed to load task details.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [taskId, invalidId]);

  useEffect(() => {
    const controller = new AbortController();
    getUsers(controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setUsers(Array.isArray(list) ? list : []);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) console.error(err);
      });
    getRoles(controller.signal)
      .then((roles) => {
        if (!controller.signal.aborted) {
          setRoleNames(Object.fromEntries(roles.map((role) => [role.id, role.name])));
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) console.error(err);
      });
    getSkills(controller.signal)
      .then((skills: Skill[]) => {
        if (!controller.signal.aborted) {
          setSkillNames(
            Object.fromEntries(
              (Array.isArray(skills) ? skills : []).map((skill) => [skill.id, skill.name]),
            ),
          );
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) console.error(err);
      });
    return () => controller.abort();
  }, []);

  const refreshSideData = async () => {
    const [commentsResult, historyResult, taskResult] = await Promise.all([
      getComments(taskId),
      getTaskHistory(taskId),
      getTask(taskId),
    ]);
    setTask(taskResult);
    setTitleDraft(taskResult.title);
    setDescriptionDraft(taskResult.description);
    setComments(
      [...commentsResult].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );
    setHistory(
      [...historyResult].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );
  };

  const handleAssign = async (_id: number, userId: number) => {
    setActionError("");
    setBusy(true);
    try {
      const updated = await assignTask(taskId, userId);
      setTask(updated);
      const historyResult = await getTaskHistory(taskId);
      setHistory(
        [...historyResult].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    } catch (err) {
      console.error(err);
      setActionError("Could not assign this task.");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    setBusy(true);
    setActionError("");
    try {
      const updated = await startTask(taskId);
      setTask(updated);
      await refreshSideData();
    } catch (err) {
      console.error(err);
      setActionError("Could not start task. Assign someone first if it is still Todo.");
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    setBusy(true);
    setActionError("");
    try {
      const updated = await completeTask(taskId);
      setTask(updated);
      await refreshSideData();
    } catch (err) {
      console.error(err);
      setActionError("Could not mark task done. It must be In Progress.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!task || !titleDraft.trim()) return;
    setSavingDetails(true);
    setActionError("");
    try {
      const updated = await updateTask(task.id, titleDraft.trim(), task.description);
      setTask(updated);
      setEditingTitle(false);
      await refreshSideData();
    } catch (err) {
      console.error(err);
      setActionError("Failed to update title.");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!task || !descriptionDraft.trim()) return;
    setSavingDetails(true);
    setActionError("");
    try {
      const updated = await updateTask(task.id, task.title, descriptionDraft.trim());
      setTask(updated);
      setEditingDescription(false);
      await refreshSideData();
    } catch (err) {
      console.error(err);
      setActionError("Failed to update description.");
    } finally {
      setSavingDetails(false);
    }
  };

  const handlePostComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentDraft.trim()) return;
    setPostingComment(true);
    setActionError("");
    try {
      const created = await createComment(taskId, commentDraft.trim());
      setComments((prev) => [created, ...prev]);
      setCommentDraft("");
      const historyResult = await getTaskHistory(taskId);
      setHistory(
        [...historyResult].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    } catch (err) {
      console.error(err);
      setActionError("Failed to post comment.");
    } finally {
      setPostingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="task-details">
        <p className="td-state">Loading task…</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="task-details">
        <p className="td-state td-state-error">{error || "Task not found."}</p>
        <button type="button" className="td-btn td-btn-secondary" onClick={() => navigate("/tasks")}>
          Back to Tasks
        </button>
      </div>
    );
  }

  const statusMeta = STATUS_META[task.status] ?? STATUS_META.Pending;
  const assigneeName = task.assignee
    ? `${task.assignee.firstName} ${task.assignee.lastName}`.trim()
    : null;
  const projectName = task.projectName?.trim() || null;

  return (
    <div className="task-details">
      <header className="td-topbar">
        <label className="td-global-search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Search tasks, projects, tags…" readOnly />
          <kbd>Ctrl+K</kbd>
        </label>
        <div className="td-topbar-right">
          <button type="button" className="td-icon-btn" aria-label="Notifications">
            <Icon name="notifications" size={20} />
            <span className="td-notif-badge">3</span>
          </button>
          <TopbarUser />
        </div>
      </header>

      <div className="td-page-header">
        <nav className="td-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/tasks">Tasks</Link>
          {projectName && task.projectId ? (
            <>
              <Icon name="chevron_right" size={14} />
              <Link to={`/projects/${task.projectId}`}>{projectName}</Link>
            </>
          ) : null}
          <Icon name="chevron_right" size={14} />
          <span>{formatTaskId(task.id)}</span>
          <Icon name="chevron_right" size={14} />
          <span className="is-current">{task.title}</span>
        </nav>

        <div className="td-header-actions">
          <span className={`td-status-chip ${statusMeta.className}`}>
            <span className="td-status-dot" />
            {statusMeta.label}
          </span>

          {task.status === "Pending" && (
            <button
              type="button"
              className="td-btn td-btn-primary"
              disabled={busy}
              onClick={() => void handleStart()}
            >
              <Icon name="play_arrow" size={18} />
              Start Task
            </button>
          )}
          {task.status === "InProgress" && (
            <button
              type="button"
              className="td-btn td-btn-primary"
              disabled={busy}
              onClick={() => void handleComplete()}
            >
              <Icon name="check" size={18} />
              Mark Done
            </button>
          )}
          {task.status === "Completed" && (
            <span className="td-done-label">
              <Icon name="verified" size={18} />
              Completed
            </span>
          )}
        </div>
      </div>

      {actionError && (
        <div className="td-banner" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError("")} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <div className="td-layout">
        <div className="td-main">
          <section className="td-card td-title-card">
            <div className="td-title-meta">
              <span className="td-id-pill">Task {formatTaskId(task.id)}</span>
              {projectName && (
                task.projectId ? (
                  <Link to={`/projects/${task.projectId}`} className="td-project-chip">
                    <Icon name="folder" size={14} />
                    {projectName}
                  </Link>
                ) : (
                  <span className="td-project-chip">
                    <Icon name="folder" size={14} />
                    {projectName}
                  </span>
                )
              )}
              {createdAt && (
                <span className="td-created">
                  <Icon name="schedule" size={14} />
                  Created {formatAbsoluteDate(createdAt)}
                </span>
              )}
            </div>

            {editingTitle ? (
              <div className="td-edit-block">
                <input
                  className="td-title-input"
                  value={titleDraft}
                  maxLength={100}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  autoFocus
                />
                <div className="td-edit-actions">
                  <button
                    type="button"
                    className="td-btn td-btn-secondary"
                    onClick={() => {
                      setEditingTitle(false);
                      setTitleDraft(task.title);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="td-btn td-btn-primary"
                    disabled={savingDetails || !titleDraft.trim()}
                    onClick={() => void handleSaveTitle()}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="td-title-row">
                <h1>{task.title}</h1>
                <button
                  type="button"
                  className="td-icon-btn"
                  aria-label="Edit title"
                  onClick={() => setEditingTitle(true)}
                >
                  <Icon name="edit" size={18} />
                </button>
              </div>
            )}
          </section>

          <section className="td-card">
            <div className="td-card-header">
              <div className="td-card-heading">
                <Icon name="notes" size={18} />
                <h2>Description</h2>
              </div>
              {!editingDescription && (
                <button
                  type="button"
                  className="td-link-btn"
                  onClick={() => setEditingDescription(true)}
                >
                  Edit description
                </button>
              )}
            </div>

            {editingDescription ? (
              <div className="td-edit-block">
                <textarea
                  className="td-description-input"
                  rows={5}
                  maxLength={500}
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  autoFocus
                />
                <div className="td-edit-actions">
                  <button
                    type="button"
                    className="td-btn td-btn-secondary"
                    onClick={() => {
                      setEditingDescription(false);
                      setDescriptionDraft(task.description);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="td-btn td-btn-primary"
                    disabled={savingDetails || !descriptionDraft.trim()}
                    onClick={() => void handleSaveDescription()}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="td-description">{task.description}</p>
            )}
          </section>

          {(task.originalFeedback || task.feedbackImageUrl) && (
            <section className="td-card">
              <div className="td-card-header">
                <div className="td-card-heading">
                  <Icon name="auto_awesome" size={18} />
                  <h2>Original Feedback</h2>
                </div>
                <span className="td-audit-label">AI intake</span>
              </div>
              {task.originalFeedback && (
                <p className="td-description td-feedback-text">{task.originalFeedback}</p>
              )}
              {task.feedbackImageUrl && (
                <a
                  className="td-feedback-image"
                  href={task.feedbackImageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={task.feedbackImageUrl} alt="Attached feedback" />
                </a>
              )}
            </section>
          )}

          <section className="td-card td-activity-card">
            <div className="td-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "comments"}
                className={tab === "comments" ? "is-active" : ""}
                onClick={() => setTab("comments")}
              >
                Comments ({comments.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "history"}
                className={tab === "history" ? "is-active" : ""}
                onClick={() => setTab("history")}
              >
                History ({history.length})
              </button>
            </div>

            {tab === "comments" && (
              <div className="td-tab-panel">
                <form className="td-comment-composer" onSubmit={(e) => void handlePostComment(e)}>
                  <textarea
                    placeholder="Leave a comment on this task..."
                    rows={3}
                    maxLength={1000}
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                  />
                  <div className="td-composer-footer">
                    <div className="td-composer-tools" aria-hidden="true">
                      <Icon name="format_bold" size={18} />
                      <Icon name="code" size={18} />
                      <Icon name="link" size={18} />
                    </div>
                    <button
                      type="submit"
                      className="td-btn td-btn-primary"
                      disabled={postingComment || !commentDraft.trim()}
                    >
                      {postingComment ? "Posting…" : "Post Comment"}
                    </button>
                  </div>
                </form>

                <div className="td-comment-list">
                  {comments.length === 0 && (
                    <p className="td-empty">No comments yet. Start the discussion.</p>
                  )}
                  {comments.map((comment) => {
                    const author = userDisplayName(usersById.get(comment.userId), comment.userId);
                    return (
                      <article key={comment.id} className="td-comment">
                        <div
                          className={`td-avatar tone-${getAvatarTone(comment.userId)}`}
                          aria-hidden="true"
                        >
                          {getInitials(author)}
                        </div>
                        <div className="td-comment-body">
                          <div className="td-comment-meta">
                            <strong>{author}</strong>
                            <span>{formatRelativeTime(comment.createdAt)}</span>
                          </div>
                          <p>{comment.content}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "history" && (
              <div className="td-tab-panel">
                <div className="td-history-list">
                  {history.length === 0 && <p className="td-empty">No history recorded yet.</p>}
                  {history.map((entry) => {
                    const desc = describeHistory(entry);
                    const toneId = entry.userId ?? entry.id;
                    return (
                      <div key={entry.id} className="td-history-item">
                        <div
                          className={`td-avatar tone-${getAvatarTone(toneId)}`}
                          aria-hidden="true"
                        >
                          {getInitials(desc.actor)}
                        </div>
                        <div>
                          <p>
                            <strong>{desc.actor}</strong> {desc.text}
                            {desc.detail && <span className="td-history-detail"> {desc.detail}</span>}
                          </p>
                          <span className="td-history-time">
                            {formatRelativeTime(entry.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="td-card">
            <div className="td-card-header">
              <div className="td-card-heading">
                <Icon name="history" size={18} />
                <h2>Recent Task History</h2>
              </div>
              <span className="td-audit-label">audit log</span>
            </div>
            <div className="td-timeline">
              {history.slice(0, 6).map((entry) => {
                const desc = describeHistory(entry);
                const toneId = entry.userId ?? entry.id;
                return (
                  <div key={`tl-${entry.id}`} className="td-timeline-item">
                    <div
                      className={`td-avatar td-avatar-sm tone-${getAvatarTone(toneId)}`}
                      aria-hidden="true"
                    >
                      {getInitials(desc.actor)}
                    </div>
                    <div>
                      <p>
                        <strong>{desc.actor}</strong> {desc.text}
                        {desc.detail && <span className="td-history-detail"> {desc.detail}</span>}
                      </p>
                      <span className="td-history-time">{formatRelativeTime(entry.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
              {history.length === 0 && <p className="td-empty">No recent activity.</p>}
            </div>
          </section>
        </div>

        <aside className="td-properties">
          <div className="td-properties-card">
            <div className="td-properties-header">
              <h2>Task Properties</h2>
              <span className="td-entity-tag">TaskEntity</span>
            </div>

            <div className="td-prop">
              <span className="td-prop-label">Task ID</span>
              <span className="td-prop-value">{formatTaskId(task.id)}</span>
            </div>

            <div className="td-prop">
              <span className="td-prop-label">Project</span>
              {projectName && task.projectId ? (
                <Link to={`/projects/${task.projectId}`} className="td-prop-link">
                  {projectName}
                </Link>
              ) : (
                <span className="td-prop-value">{projectName || "—"}</span>
              )}
            </div>

            <div className="td-prop">
              <span className="td-prop-label">Status (TaskItemStatus)</span>
              <span className={`td-status-chip ${statusMeta.className}`}>
                <Icon name={statusMeta.icon} size={14} />
                {statusMeta.label}
              </span>
              <div className="td-status-actions">
                {task.status === "Pending" && (
                  <button
                    type="button"
                    className="td-btn td-btn-secondary td-btn-sm"
                    disabled={busy}
                    onClick={() => void handleStart()}
                  >
                    Start
                  </button>
                )}
                {task.status === "InProgress" && (
                  <button
                    type="button"
                    className="td-btn td-btn-secondary td-btn-sm"
                    disabled={busy}
                    onClick={() => void handleComplete()}
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>

            {task.requiredSkillIds.length > 0 && (
              <div className="td-prop">
                <span className="td-prop-label">Required Skills</span>
                <div className="td-skill-chips">
                  {task.requiredSkillIds.map((skillId) => (
                    <span key={skillId} className="td-skill-chip">
                      {skillNames[skillId] ?? `Skill #${skillId}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="td-prop">
              <div className="td-prop-label-row">
                <span className="td-prop-label">Assignee (User)</span>
              </div>

              {task.assignee && assigneeName ? (
                <div className="td-assignee-card">
                  <div
                    className={`td-avatar tone-${getAvatarTone(task.assignee.id)}`}
                    aria-hidden="true"
                  >
                    {getInitials(assigneeName)}
                  </div>
                  <div>
                    <strong>{assigneeName}</strong>
                    <span>AssigneeId: #{task.assignee.id}</span>
                  </div>
                </div>
              ) : (
                <p className="td-unassigned">Unassigned</p>
              )}

              <label className="td-reassign-label">Reassign task to:</label>
              <AssigneeSelect
                taskId={task.id}
                assignee={task.assignee}
                users={users}
                roleNames={roleNames}
                disabled={busy}
                onAssign={handleAssign}
              />
            </div>

            <div className="td-prop">
              <span className="td-prop-label">Related Records</span>
              <div className="td-related">
                <button
                  type="button"
                  className="td-related-card"
                  onClick={() => setTab("comments")}
                >
                  <Icon name="chat_bubble" size={18} />
                  <div>
                    <strong>Comments</strong>
                    <span>{comments.length}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="td-related-card"
                  onClick={() => setTab("history")}
                >
                  <Icon name="manage_history" size={18} />
                  <div>
                    <strong>History Logs</strong>
                    <span>{history.length}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TaskDetailsPage;
