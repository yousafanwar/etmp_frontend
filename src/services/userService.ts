import { api } from "../api/client";
import type { CreateUserRequest, Role, UpdateUserRequest, User } from "../types/user";

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

export const deleteUser = (id: number) =>
  api.delete<void>(`/users/${id}`);
