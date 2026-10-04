import { api } from "../api/client";
import type { UserSkill } from "../types/skill";
import type {
  CreateUserRequest,
  Role,
  UpdateProfileRequest,
  UpdateUserRequest,
  User,
} from "../types/user";

export const getUsers = (signal?: AbortSignal) =>
  api.get<User[]>("/users", signal);

export const getUser = (id: number, signal?: AbortSignal) =>
  api.get<User>(`/users/${id}`, signal);

export const getRoles = (signal?: AbortSignal) =>
  api.get<Role[]>("/roles", signal);

export const createUser = (request: CreateUserRequest) =>
  api.post<User>("/users", request, true);

export const updateUser = (id: number, request: UpdateUserRequest) =>
  api.put<User>(`/users/${id}`, request);

export const updateMyProfile = (request: UpdateProfileRequest) =>
  api.put<User>("/users/me", request);

export const getUserSkills = (userId: number, signal?: AbortSignal) =>
  api.get<UserSkill[]>(`/users/${userId}/skills`, signal);

export const addUserSkill = (userId: number, skillId: number) =>
  api.post<void>(`/users/${userId}/skills/${skillId}`);

export const removeUserSkill = (userId: number, skillId: number) =>
  api.delete<void>(`/users/${userId}/skills/${skillId}`);

export const deleteUser = (id: number) =>
  api.delete<void>(`/users/${id}`);
