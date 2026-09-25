export type TaskStatus = "Pending" | "InProgress" | "Completed";

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: number | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}