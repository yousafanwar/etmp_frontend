import { api, tokenStore } from "../api/client";
import type { LoginResponse } from "../types/auth";
import type { CreateUserRequest, User } from "../types/user";
import { createUser } from "./userService";

export const login = async (email: string, password: string) => {
  const tokens = await api.post<LoginResponse>("/users/login", { email, password }, true);
  tokenStore.set(tokens);
  return tokens;
};

export const signup = async (request: CreateUserRequest): Promise<User> => {
  const user = await createUser(request);
  await login(request.email, request.password);
  return user;
};

export const logout = async () => {
  try {
    await api.post<void>("/users/logout");
  } catch (err) {
    // Still clear local session if the API call fails (e.g. already expired).
    console.error(err);
  } finally {
    tokenStore.clear();
  }
};