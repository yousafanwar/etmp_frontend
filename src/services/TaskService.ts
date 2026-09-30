import { api } from "../api/client";
import type { PagedResult, Task, TaskQuery, TaskStatus } from "../types/task";
import type { TaskHistory } from "../types/taskHistory";

export type { TaskQuery };

export const getTasks = (query: TaskQuery = {}, signal?: AbortSignal) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  const qs = params.toString();
  return api.get<PagedResult<Task>>(`/tasks${qs ? `?${qs}` : ""}`, signal);
};

export const getTask = (id: number, signal?: AbortSignal) =>
  api.get<Task>(`/tasks/${id}`, signal);

export const createTask = (title: string, description: string, projectId: number) =>
  api.post<Task>("/tasks", { title, description, projectId });

export const updateTask = (id: number, title: string, description: string) =>
  api.put<Task>(`/tasks/${id}`, { title, description });

export const deleteTask = (id: number) => api.delete<void>(`/tasks/${id}`);

export const assignTask = (id: number, userId: number) =>
  api.put<Task>(`/tasks/${id}/assign/${userId}`);

export const startTask = (id: number) => api.put<Task>(`/tasks/${id}/start`);

export const completeTask = (id: number) => api.put<Task>(`/tasks/${id}/complete`);

export const getTaskHistory = (taskId: number, signal?: AbortSignal) =>
  api.get<TaskHistory[]>(`/tasks/${taskId}/history`, signal);

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
