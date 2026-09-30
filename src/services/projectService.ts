import { api } from "../api/client";
import type {
  CreateProjectRequest,
  Project,
  ProjectSkill,
  ProjectUser,
  UpdateProjectRequest,
} from "../types/project";

export const getProjects = (signal?: AbortSignal) =>
  api.get<Project[]>("/projects", signal);

export const getProject = (id: number, signal?: AbortSignal) =>
  api.get<Project>(`/projects/${id}`, signal);

export const createProject = (body: CreateProjectRequest) =>
  api.post<Project>("/projects", body);

export const updateProject = (id: number, body: UpdateProjectRequest) =>
  api.put<Project>(`/projects/${id}`, body);

export const deleteProject = (id: number) =>
  api.delete<void>(`/projects/${id}`);

export const getProjectUsers = (projectId: number, signal?: AbortSignal) =>
  api.get<ProjectUser[]>(`/projects/${projectId}/users`, signal);

export const addProjectUser = (projectId: number, userId: number) =>
  api.post<void>(`/projects/${projectId}/users/${userId}`);

export const removeProjectUser = (projectId: number, userId: number) =>
  api.delete<void>(`/projects/${projectId}/users/${userId}`);

export const getProjectSkills = (projectId: number, signal?: AbortSignal) =>
  api.get<ProjectSkill[]>(`/projects/${projectId}/skills`, signal);

export const addProjectSkill = (projectId: number, skillId: number) =>
  api.post<void>(`/projects/${projectId}/skills/${skillId}`);

export const removeProjectSkill = (projectId: number, skillId: number) =>
  api.delete<void>(`/projects/${projectId}/skills/${skillId}`);
