import { api } from "../api/client";
import type { Comment } from "../types/comment";

export const getComments = (taskId: number, signal?: AbortSignal) =>
  api.get<Comment[]>(`/comments/task/${taskId}`, signal);

export const createComment = (taskId: number, content: string) =>
  api.post<Comment>("/comments", { taskId, content });

export const deleteComment = (id: number) =>
  api.delete<void>(`/comments/${id}`);
