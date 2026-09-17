export interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId?: number | null;
  assignee?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
}

export interface GetTasksParams {
  pageNumber?: number;
  pageSize?: number;
  title?: string;
  status?: string;
  assigneeId?: number;
  sortBy?: string;
  sortDescending?: boolean;
}