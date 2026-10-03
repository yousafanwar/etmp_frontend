export type TaskStatus = "Pending" | "InProgress" | "Completed";

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
