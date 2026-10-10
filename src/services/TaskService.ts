import { api } from "../api/client";
import type {
  AnalyzeTaskRequest,
  AnalyzeTaskResponse,
  PagedResult,
  Task,
  TaskApiDto,
  TaskQuery,
  TaskStatus,
} from "../types/task";
import { normalizeTask } from "../types/task";
import type { TaskHistory } from "../types/taskHistory";

export type { TaskQuery, AnalyzeTaskResponse };

export const getTasks = async (query: TaskQuery = {}, signal?: AbortSignal) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  const qs = params.toString();
  const page = await api.get<PagedResult<TaskApiDto>>(
    `/tasks${qs ? `?${qs}` : ""}`,
    signal,
  );
  return {
    ...page,
    items: (page.items ?? []).map(normalizeTask),
  } satisfies PagedResult<Task>;
};

export const getTask = async (id: number, signal?: AbortSignal) =>
  normalizeTask(await api.get<TaskApiDto>(`/tasks/${id}`, signal));

export const createTask = async (
  title: string,
  description: string,
  projectId: number,
) =>
  normalizeTask(
    await api.post<TaskApiDto>("/tasks", { title, description, projectId }),
  );

/**
 * AI analyze-and-create: uploads feedback (+ optional image) and returns the
 * newly created task (`AnalyzeTaskResponse` / TaskItemDto).
 */
export const analyzeAndCreateTask = async (
  { projectId, feedbackText = "", image }: AnalyzeTaskRequest,
  signal?: AbortSignal,
) => {
  const form = new FormData();
  form.append("ProjectId", String(projectId));
  form.append("FeedbackText", feedbackText);
  if (image) form.append("Image", image);
  const response = await api.postForm<AnalyzeTaskResponse>(
    "/tasks/analyze",
    form,
    signal,
  );
  return normalizeTask(response);
};

export const updateTask = async (id: number, title: string, description: string) =>
  normalizeTask(await api.put<TaskApiDto>(`/tasks/${id}`, { title, description }));

export const deleteTask = (id: number) => api.delete<void>(`/tasks/${id}`);

export const assignTask = async (id: number, userId: number) =>
  normalizeTask(await api.put<TaskApiDto>(`/tasks/${id}/assign/${userId}`));

export const startTask = async (id: number) =>
  normalizeTask(await api.put<TaskApiDto>(`/tasks/${id}/start`));

export const completeTask = async (id: number) =>
  normalizeTask(await api.put<TaskApiDto>(`/tasks/${id}/complete`));

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
