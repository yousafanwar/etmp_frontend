import { api } from "../api/client";
import type { PagedResult, Task, TaskStatus } from "../types/task";

interface TaskQuery {
  page?: number;
  pageSize?: number;
  status?: TaskStatus;
  assigneeId?: number;
}

export const getTasks = (query: TaskQuery = {}, signal?: AbortSignal) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => v !== undefined && params.set(k, String(v)));
  return api.get<PagedResult<Task>>(`/tasks?${params}`, signal);
};

export const getTask = (id: number) => api.get<Task>(`/tasks/${id}`);
export const createTask = (title: string, description: string) =>
  api.post<Task>("/tasks", { title, description });
export const updateTask = (id: number, title: string, description: string) =>
  api.put<Task>(`/tasks/${id}`, { title, description });
export const deleteTask = (id: number) => api.delete<void>(`/tasks/${id}`);
export const assignTask = (id: number, userId: number) =>
  api.put<Task>(`/tasks/${id}/assign/${userId}`);
export const startTask = (id: number) => api.put<Task>(`/tasks/${id}/start`);
export const completeTask = (id: number) => api.put<Task>(`/tasks/${id}/complete`);

// Dashboard stat: one tiny request per status, read only totalCount
export const getTaskStats = async (signal?: AbortSignal) => {
  const count = (status?: TaskStatus) =>
    getTasks({ page: 1, pageSize: 1, status }, signal).then((r) => r.totalCount);

  const [total, pending, inProgress, completed] = await Promise.all([
    count(),
    count("Pending"),
    count("InProgress"),
    count("Completed"),
  ]);
  return { total, pending, inProgress, completed };
};