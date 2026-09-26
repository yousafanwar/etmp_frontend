import { api } from "../api/client";
import type { Role, User } from "../types/user";

export const getUsers = (signal?: AbortSignal) =>
  api.get<User[]>("/users", signal);

export const getRoles = (signal?: AbortSignal) =>
  api.get<Role[]>("/roles", signal);
