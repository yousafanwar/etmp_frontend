export type TaskStatus = "Pending" | "InProgress" | "Completed";

/** Backend `TaskItemStatus` numeric enum values. */
export const TASK_STATUS_CODE: Record<TaskStatus, number> = {
  Pending: 0,
  InProgress: 1,
  Completed: 2,
};

const TASK_STATUS_BY_CODE: Record<number, TaskStatus> = {
  0: "Pending",
  1: "InProgress",
  2: "Completed",
};

export interface TaskAssignee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  projectId: number;
  projectName: string;
  assignee: TaskAssignee | null;
  /** Original natural-language feedback used for AI-created tasks. */
  originalFeedback: string;
  feedbackImageUrl: string | null;
  requiredSkillIds: number[];
}

/**
 * Raw `POST /tasks/analyze` (and shared TaskItemDto) wire shape.
 * `status` may arrive as a numeric enum (`0`) or a string name.
 */
export interface AnalyzeTaskResponse {
  id: number;
  title: string;
  description: string;
  status: TaskStatus | number;
  projectId: number;
  projectName: string;
  assignee: TaskAssignee | null;
  originalFeedback: string;
  feedbackImageUrl: string | null;
  requiredSkillIds: number[];
}

/** Shared DTO shape returned by task CRUD endpoints. */
export type TaskApiDto = AnalyzeTaskResponse;

export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export interface AnalyzeTaskRequest {
  projectId: number;
  feedbackText?: string;
  image?: File | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TaskQuery {
  page?: number;
  pageSize?: number;
  status?: TaskStatus;
  assigneeId?: number;
  projectId?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const normalizeTaskStatus = (status: unknown): TaskStatus => {
  if (status === "Pending" || status === "InProgress" || status === "Completed") {
    return status;
  }
  if (typeof status === "number" && TASK_STATUS_BY_CODE[status]) {
    return TASK_STATUS_BY_CODE[status];
  }
  if (typeof status === "string") {
    const asNum = Number(status);
    if (Number.isInteger(asNum) && TASK_STATUS_BY_CODE[asNum]) {
      return TASK_STATUS_BY_CODE[asNum];
    }
  }
  return "Pending";
};

export const normalizeTask = (dto: TaskApiDto | AnalyzeTaskResponse): Task => ({
  id: dto.id,
  title: dto.title,
  description: dto.description,
  status: normalizeTaskStatus(dto.status),
  projectId: dto.projectId,
  projectName: dto.projectName ?? "",
  assignee: dto.assignee ?? null,
  originalFeedback: dto.originalFeedback ?? "",
  feedbackImageUrl: dto.feedbackImageUrl ?? null,
  requiredSkillIds: Array.isArray(dto.requiredSkillIds) ? dto.requiredSkillIds : [],
});
