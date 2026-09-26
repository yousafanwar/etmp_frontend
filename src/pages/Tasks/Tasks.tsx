import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Icon from "../../components/common/Icon";
import AssigneeSelect from "../../components/tasks/AssigneeSelect";
import {
  assignTask,
  completeTask,
  createTask,
  deleteTask,
  getTasks,
  startTask,
} from "../../services/TaskService";
import { getRoles, getUsers } from "../../services/userService";
import type { Task, TaskStatus } from "../../types/task";
import type { User } from "../../types/user";
import "./Tasks.css";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const STATUS_META: Record<
  TaskStatus,
  { label: string; className: string; icon?: string }
> = {
  Pending: { label: "Todo", className: "status-todo", icon: "radio_button_unchecked" },
  InProgress: { label: "In Progress", className: "status-progress", icon: "pending" },
  Completed: { label: "Done", className: "status-done", icon: "check_circle" },
};

type PlaceholderPriority = "P0" | "P1" | "P2" | "P3";

const PRIORITY_META: Record<
  PlaceholderPriority,
  { label: string; className: string; icon: string }
> = {
  P0: { label: "P0 Critical", className: "priority-p0", icon: "diamond" },
  P1: { label: "P1 High", className: "priority-p1", icon: "priority_high" },
  P2: { label: "P2 Medium", className: "priority-p2", icon: "remove" },
  P3: { label: "P3 Low", className: "priority-p3", icon: "arrow_downward" },
};

const PLACEHOLDER_PROJECTS = [
  { name: "Apollo Cloud Migration", tone: "blue" },
  { name: "Enterprise SOC2", tone: "green" },
  { name: "NextGen Mobile", tone: "purple" },
  { name: "Platform Core", tone: "orange" },
] as const;

/** Temporary placeholders until project/priority ship on the API. */
const getPlaceholderProject = (taskId: number) =>
  PLACEHOLDER_PROJECTS[taskId % PLACEHOLDER_PROJECTS.length];

const getPlaceholderPriority = (taskId: number): PlaceholderPriority => {
  const levels: PlaceholderPriority[] = ["P0", "P1", "P2", "P3"];
  return levels[taskId % levels.length];
};

const formatTaskId = (id: number) => `TASK-${String(id).padStart(4, "0")}`;

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

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [filterOpen, setFilterOpen] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [roleNames, setRoleNames] = useState<Record<number, string>>({});

  const searchRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const refresh = () => setReloadKey((k) => k + 1);

  const mergeUsersFromTasks = (list: User[], taskList: Task[]) => {
    const byId = new Map(list.map((user) => [user.id, user]));
    for (const task of taskList) {
      const assignee = task.assignee;
      if (!assignee || byId.has(assignee.id)) continue;
      byId.set(assignee.id, {
        id: assignee.id,
        firstName: assignee.firstName,
        lastName: assignee.lastName,
        email: assignee.email,
        roleId: 0,
      });
    }
    return [...byId.values()];
  };

  useEffect(() => {
    const controller = new AbortController();

    getUsers(controller.signal)
      .then((userList) => {
        if (controller.signal.aborted) return;
        const normalized = Array.isArray(userList) ? userList : [];
        setUsers((prev) => {
          const byId = new Map(normalized.map((user) => [user.id, user]));
          for (const user of prev) {
            if (!byId.has(user.id)) byId.set(user.id, user);
          }
          return [...byId.values()];
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load users for assignee picker", err);
      });

    getRoles(controller.signal)
      .then((roles) => {
        if (controller.signal.aborted) return;
        setRoleNames(Object.fromEntries(roles.map((role) => [role.id, role.name])));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load roles for assignee picker", err);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getTasks(
      {
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setTasks(result.items);
        setTotalCount(result.totalCount);
        setTotalPages(Math.max(1, result.totalPages || 1));
        setSelected(new Set());
        setError("");
        setUsers((prev) => mergeUsersFromTasks(prev, result.items));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError("Failed to load tasks.");
        console.error(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, pageSize, search, statusFilter, reloadKey]);

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
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const allSelected = tasks.length > 0 && tasks.every((t) => selected.has(t.id));
  const selectedIds = [...selected];

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(tasks.map((t) => t.id)));
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBatch = async (action: (id: number) => Promise<unknown>) => {
    setBusy(true);
    setActionError("");
    setLoading(true);
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => action(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setActionError(`${failed} of ${selectedIds.length} actions failed.`);
      }
      refresh();
    } catch (err) {
      setActionError("Batch action failed.");
      console.error(err);
    } finally {
      setBusy(false);
      setStatusMenuOpen(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} selected task(s)?`)) return;
    await runBatch((id) => deleteTask(id));
  };

  const handleBatchStatus = async (action: "start" | "complete") => {
    await runBatch((id) => (action === "start" ? startTask(id) : completeTask(id)));
  };

  const handleBatchAssign = async (e: FormEvent) => {
    e.preventDefault();
    const userId = Number(assignUserId);
    if (!Number.isInteger(userId) || userId <= 0) {
      setActionError("Enter a valid user ID.");
      return;
    }
    setAssignOpen(false);
    setAssignUserId("");
    await runBatch((id) => assignTask(id, userId));
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createDescription.trim()) return;
    setCreateSubmitting(true);
    setActionError("");
    try {
      await createTask(createTitle.trim(), createDescription.trim());
      setCreateOpen(false);
      setCreateTitle("");
      setCreateDescription("");
      setLoading(true);
      if (page === 1) refresh();
      else setPage(1);
    } catch (err) {
      setActionError("Failed to create task.");
      console.error(err);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleRowAssign = async (taskId: number, userId: number) => {
    setActionError("");
    try {
      const updated = await assignTask(taskId, userId);
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task;
          // Prefer API payload; fall back to local user list if assignee omitted.
          if (updated.assignee) return updated;
          const user = users.find((u) => u.id === userId);
          return {
            ...updated,
            assignee: user
              ? {
                  id: user.id,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                }
              : task.assignee,
          };
        }),
      );
    } catch (err) {
      setActionError("Could not assign task.");
      console.error(err);
      throw err;
    }
  };

  const handleRowStart = async (id: number) => {
    setBusy(true);
    setActionError("");
    setLoading(true);
    try {
      await startTask(id);
      refresh();
    } catch (err) {
      setActionError("Could not start task. Ensure it is assigned and Pending.");
      setLoading(false);
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleRowComplete = async (id: number) => {
    setBusy(true);
    setActionError("");
    setLoading(true);
    try {
      await completeTask(id);
      refresh();
    } catch (err) {
      setActionError("Could not complete task. Ensure it is In Progress.");
      setLoading(false);
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchInput("");
      searchRef.current?.blur();
    }
  };

  const applyStatusFilter = (status: TaskStatus | "") => {
    setStatusFilter(status);
    setPage(1);
    setLoading(true);
    setFilterOpen(false);
  };

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const pageList = buildPageList(page, totalPages);

  return (
    <div className="tasks-page">
      <header className="tasks-topbar">
        <nav className="tasks-breadcrumbs" aria-label="Breadcrumb">
          <span>Workspaces</span>
          <Icon name="chevron_right" size={14} />
          <span>Enterprise Backlog</span>
          <Icon name="chevron_right" size={14} />
          <span className="is-current">All Tasks</span>
        </nav>

        <div className="tasks-topbar-right">
          <button type="button" className="tasks-icon-btn" aria-label="Notifications">
            <Icon name="notifications" size={20} />
            <span className="tasks-notif-badge">3</span>
          </button>
          <div className="tasks-user">
            <div className="tasks-user-avatar" aria-hidden="true">
              ER
            </div>
            <div className="tasks-user-meta">
              <span className="tasks-user-name">User 1</span>
              <span className="tasks-user-role">User 1's department</span>
            </div>
          </div>
        </div>
      </header>

      <div className="tasks-title-row">
        <div className="tasks-title-group">
          <h1>Tasks Explorer</h1>
          <span className="tasks-count-pill">
            {totalCount.toLocaleString()} Total Tasks
          </span>
          <span className="tasks-live">
            <span className="tasks-live-dot" />
            Live Syncing
          </span>
        </div>
      </div>

      <div className="tasks-toolbar">
        <label className="tasks-search">
          <Icon name="search" size={20} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search tasks, projects, people..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKey}
            aria-label="Search tasks"
          />
          <kbd className="tasks-kbd">⌘K</kbd>
        </label>

        <div className="tasks-toolbar-actions" ref={filterRef}>
          <button
            type="button"
            className={`tasks-btn tasks-btn-secondary ${statusFilter ? "is-active" : ""}`}
            onClick={() => setFilterOpen((o) => !o)}
            aria-expanded={filterOpen}
          >
            <Icon name="filter_list" size={18} />
            Filter
            {statusFilter ? `: ${STATUS_META[statusFilter].label}` : ""}
            <Icon name="expand_more" size={18} />
          </button>

          {filterOpen && (
            <div className="tasks-filter-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className={!statusFilter ? "is-selected" : ""}
                onClick={() => applyStatusFilter("")}
              >
                All statuses
              </button>
              {(Object.keys(STATUS_META) as TaskStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  role="menuitem"
                  className={statusFilter === status ? "is-selected" : ""}
                  onClick={() => applyStatusFilter(status)}
                >
                  {STATUS_META[status].label}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="tasks-btn tasks-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            <Icon name="add" size={18} />
            Create Task
          </button>
        </div>
      </div>

      {actionError && (
        <div className="tasks-banner tasks-banner-error" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError("")} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="tasks-batch-bar" role="region" aria-label="Batch actions">
          <div className="tasks-batch-left">
            <label className="tasks-check">
              <input type="checkbox" checked readOnly />
            </label>
            <span className="tasks-batch-count">{selected.size} tasks selected</span>
            <span className="tasks-batch-context">
              Operating on selected tasks across this page
            </span>
          </div>

          <div className="tasks-batch-actions">
            <button
              type="button"
              className="tasks-batch-btn"
              disabled={busy}
              onClick={() => setAssignOpen(true)}
            >
              <Icon name="person_add" size={16} />
              Batch Assign
            </button>

            <div className="tasks-batch-status-wrap">
              <button
                type="button"
                className="tasks-batch-btn"
                disabled={busy}
                onClick={() => setStatusMenuOpen((o) => !o)}
              >
                <Icon name="sync_alt" size={16} />
                Change Status
              </button>
              {statusMenuOpen && (
                <div className="tasks-batch-status-menu">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleBatchStatus("start")}
                  >
                    Start (In Progress)
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleBatchStatus("complete")}
                  >
                    Complete (Done)
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="tasks-batch-btn tasks-batch-btn-danger"
              disabled={busy}
              onClick={() => void handleBatchDelete()}
            >
              <Icon name="delete" size={16} />
              Delete
            </button>

            <button
              type="button"
              className="tasks-batch-close"
              aria-label="Clear selection"
              onClick={() => {
                setSelected(new Set());
                setStatusMenuOpen(false);
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="tasks-table-card">
        {loading && <p className="tasks-state">Loading tasks…</p>}
        {error && !loading && <p className="tasks-state tasks-state-error">{error}</p>}
        {!loading && !error && tasks.length === 0 && (
          <p className="tasks-state">No tasks found.</p>
        )}

        {!loading && !error && tasks.length > 0 && (
          <div className="tasks-table-wrap">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <label className="tasks-check">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Select all tasks on this page"
                      />
                    </label>
                  </th>
                  <th>Task ID</th>
                  <th>Task Title &amp; Summary</th>
                  <th>Project</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const meta = STATUS_META[task.status] ?? STATUS_META.Pending;
                  const project = getPlaceholderProject(task.id);
                  const priority = PRIORITY_META[getPlaceholderPriority(task.id)];
                  const isSelected = selected.has(task.id);
                  return (
                    <tr key={task.id} className={isSelected ? "is-selected" : ""}>
                      <td className="col-check">
                        <label className="tasks-check">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(task.id)}
                            aria-label={`Select ${formatTaskId(task.id)}`}
                          />
                        </label>
                      </td>
                      <td>
                        <button type="button" className="tasks-id-link">
                          {formatTaskId(task.id)}
                        </button>
                      </td>
                      <td>
                        <div className="tasks-title-cell">
                          <span className="tasks-row-title">{task.title}</span>
                          <span className="tasks-row-summary">{task.description}</span>
                        </div>
                      </td>
                      <td>
                        <div className="tasks-project">
                          <span className={`tasks-project-dot tone-${project.tone}`} />
                          <span className="tasks-project-name">{project.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`tasks-priority ${priority.className}`}>
                          <Icon name={priority.icon} size={14} />
                          {priority.label}
                        </span>
                      </td>
                      <td>
                        <span className={`tasks-status ${meta.className}`}>
                          {meta.icon && <Icon name={meta.icon} size={14} />}
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        <AssigneeSelect
                          taskId={task.id}
                          assignee={task.assignee}
                          users={users}
                          roleNames={roleNames}
                          disabled={busy}
                          onAssign={handleRowAssign}
                        />
                      </td>
                      <td className="col-actions">
                        <div className="tasks-row-actions">
                          {task.status === "Pending" && (
                            <button
                              type="button"
                              className="tasks-row-btn"
                              disabled={busy}
                              onClick={() => void handleRowStart(task.id)}
                            >
                              Start
                            </button>
                          )}
                          {task.status === "InProgress" && (
                            <button
                              type="button"
                              className="tasks-row-btn"
                              disabled={busy}
                              onClick={() => void handleRowComplete(task.id)}
                            >
                              Complete
                            </button>
                          )}
                          {task.status === "Completed" && (
                            <span className="tasks-row-muted">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="tasks-pagination">
          <span className="tasks-page-info">
            Showing {from}–{to} of {totalCount.toLocaleString()} tasks
          </span>

          <label className="tasks-page-size">
            Per page:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
                setLoading(true);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  Show {n} rows
                </option>
              ))}
            </select>
          </label>

          <div className="tasks-page-controls">
            <span className="tasks-page-label">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="tasks-page-btn"
              disabled={page <= 1}
              onClick={() => {
                setLoading(true);
                setPage((p) => Math.max(1, p - 1));
              }}
              aria-label="Previous page"
            >
              <Icon name="chevron_left" size={18} />
            </button>
            {pageList.map((item, idx) =>
              item === "…" ? (
                <span key={`e-${idx}`} className="tasks-page-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`tasks-page-btn ${item === page ? "is-active" : ""}`}
                  onClick={() => {
                    if (item !== page) {
                      setLoading(true);
                      setPage(item);
                    }
                  }}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              className="tasks-page-btn"
              disabled={page >= totalPages}
              onClick={() => {
                setLoading(true);
                setPage((p) => Math.min(totalPages, p + 1));
              }}
              aria-label="Next page"
            >
              <Icon name="chevron_right" size={18} />
            </button>
          </div>
        </footer>
      </div>

      {createOpen && (
        <div className="tasks-modal-backdrop" role="presentation" onClick={() => setCreateOpen(false)}>
          <div
            className="tasks-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-task-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tasks-modal-header">
              <h2 id="create-task-title">Create Task</h2>
              <button
                type="button"
                className="tasks-icon-btn"
                aria-label="Close"
                onClick={() => setCreateOpen(false)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <form className="tasks-modal-form" onSubmit={(e) => void handleCreate(e)}>
              <label>
                Title
                <input
                  type="text"
                  maxLength={100}
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Short task title"
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
                  placeholder="What needs to be done?"
                />
              </label>
              <div className="tasks-modal-footer">
                <button
                  type="button"
                  className="tasks-btn tasks-btn-secondary"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tasks-btn tasks-btn-primary"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? "Creating…" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignOpen && (
        <div className="tasks-modal-backdrop" role="presentation" onClick={() => setAssignOpen(false)}>
          <div
            className="tasks-modal tasks-modal-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-task-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tasks-modal-header">
              <h2 id="assign-task-title">Batch Assign</h2>
              <button
                type="button"
                className="tasks-icon-btn"
                aria-label="Close"
                onClick={() => setAssignOpen(false)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <form className="tasks-modal-form" onSubmit={(e) => void handleBatchAssign(e)}>
              <p className="tasks-modal-hint">
                Assign {selectedIds.length} selected task(s) to a user by ID.
              </p>
              <label>
                User ID
                <input
                  type="number"
                  min={1}
                  required
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  placeholder="e.g. 12"
                  autoFocus
                />
              </label>
              <div className="tasks-modal-footer">
                <button
                  type="button"
                  className="tasks-btn tasks-btn-secondary"
                  onClick={() => setAssignOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="tasks-btn tasks-btn-primary" disabled={busy}>
                  Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
