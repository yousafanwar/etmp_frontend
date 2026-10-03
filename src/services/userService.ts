import { api } from "../api/client";
import type { CreateUserRequest, Role, User } from "../types/user";

export const getUsers = (signal?: AbortSignal) =>
  api.get<User[]>("/users", signal);

export const getRoles = (signal?: AbortSignal) =>
  api.get<Role[]>("/roles", signal);

export const createUser = (request: CreateUserRequest) =>
  api.post<User>("/users", request, true);
