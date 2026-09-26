import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../common/Icon";
import type { TaskAssignee } from "../../types/task";
import type { User } from "../../types/user";
import "./AssigneeSelect.css";

const AVATAR_TONES = ["purple", "blue", "green", "amber", "rose", "teal"] as const;

const getInitials = (firstName: string, lastName: string) =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";

const getFullName = (firstName: string, lastName: string) =>
  `${firstName} ${lastName}`.trim();

const getAvatarTone = (id: number) => AVATAR_TONES[id % AVATAR_TONES.length];

interface AssigneeSelectProps {
  taskId: number;
  assignee: TaskAssignee | null;
  users: User[];
  roleNames: Record<number, string>;
  disabled?: boolean;
  onAssign: (taskId: number, userId: number) => Promise<void>;
}

const AssigneeSelect = ({
  taskId,
  assignee,
  users,
  roleNames,
  disabled = false,
  onAssign,
}: AssigneeSelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const updateMenuPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({ top: rect.bottom + 6, left: rect.left });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    const onReposition = () => updateMenuPosition();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const name = getFullName(user.firstName, user.lastName).toLowerCase();
      const role = (roleNames[user.roleId] ?? "").toLowerCase();
      return (
        name.includes(q) ||
        user.email.toLowerCase().includes(q) ||
        role.includes(q)
      );
    });
  }, [users, query, roleNames]);

  const handleSelect = async (userId: number) => {
    if (assignee?.id === userId || assigningId !== null) {
      setOpen(false);
      setQuery("");
      return;
    }
    setAssigningId(userId);
    try {
      await onAssign(taskId, userId);
      setOpen(false);
      setQuery("");
    } finally {
      setAssigningId(null);
    }
  };

  const triggerLabel = assignee
    ? getFullName(assignee.firstName, assignee.lastName)
    : "Unassigned";
  const triggerInitials = assignee
    ? getInitials(assignee.firstName, assignee.lastName)
    : "?";
  const triggerTone = assignee ? getAvatarTone(assignee.id) : "purple";

  return (
    <div className={`assignee-select ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="assignee-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open) updateMenuPosition();
          setOpen((value) => !value);
        }}
      >
        <span className={`assignee-avatar tone-${triggerTone}`} aria-hidden="true">
          {triggerInitials}
        </span>
        <span className="assignee-trigger-name">{triggerLabel}</span>
        <Icon name="expand_more" size={16} className="assignee-chevron" />
      </button>

      {open && (
        <div
          className="assignee-menu"
          role="listbox"
          aria-label="Assign task"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <label className="assignee-search">
            <Icon name="search" size={16} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Assign to..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search people"
            />
          </label>

          <div className="assignee-list">
            {filteredUsers.length === 0 && (
              <p className="assignee-empty">No people found</p>
            )}
            {filteredUsers.map((user) => {
              const selected = assignee?.id === user.id;
              const name = getFullName(user.firstName, user.lastName);
              const role = roleNames[user.roleId] || user.email;
              const tone = getAvatarTone(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`assignee-option ${selected ? "is-selected" : ""}`}
                  disabled={assigningId !== null}
                  onClick={() => void handleSelect(user.id)}
                >
                  <span className={`assignee-avatar tone-${tone}`} aria-hidden="true">
                    {getInitials(user.firstName, user.lastName)}
                  </span>
                  <span className="assignee-option-text">
                    <span className="assignee-option-name">{name}</span>
                    <span className="assignee-option-role">{role}</span>
                  </span>
                  {selected && (
                    <Icon name="check" size={18} className="assignee-check" />
                  )}
                  {assigningId === user.id && (
                    <span className="assignee-option-busy">…</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssigneeSelect;
