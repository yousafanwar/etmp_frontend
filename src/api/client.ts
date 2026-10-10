import type { LoginResponse } from "../types/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export const tokenStore = {
  getAccess: () => localStorage.getItem("accessToken"),
  set: (t: LoginResponse) => localStorage.setItem("accessToken", t.accessToken),
  clear: () => localStorage.removeItem("accessToken"),
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean; // false for login
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/users/refresh`, {
      method: "POST",
      credentials: "include", // sends the HttpOnly cookie
    });
    if (!res.ok) return false;
    tokenStore.set((await res.json()) as LoginResponse);
    return true;
  } catch {
    return false;
  }
}

function send(path: string, { method = "GET", body, signal, auth = true }: RequestOptions) {
  const token = tokenStore.getAccess();
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  return fetch(`${BASE_URL}${path}`, {
    method,
    signal,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options);

  if (res.status === 401 && options.auth !== false) {
    refreshing ??= refreshTokens().finally(() => {
      refreshing = null;
    });

    if (await refreshing) {
      res = await send(path, options); // retry once with the new access token
    } else {
      tokenStore.clear();
      window.location.href = "/login";
      throw new ApiError(401, "Session expired");
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      typeof data === "string"
        ? data
        : data?.detail ?? data?.title ?? data?.message ?? res.statusText;
    throw new ApiError(res.status, message);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// A GET request. Optionally pass an AbortSignal to cancel it (e.g. on unmount).
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, {
    method: "GET",
    signal: signal,
  });
}

// A POST request. `skipAuth` is true only for endpoints like login that
// must NOT send the Authorization header.
async function post<T>(path: string, body?: unknown, skipAuth?: boolean): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body,
    auth: !skipAuth,
  });
}

/** Multipart POST — do not JSON-encode; Content-Type is set by the browser. */
async function postForm<T>(path: string, body: FormData, signal?: AbortSignal): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body,
    signal,
  });
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body,
  });
}

async function remove<T>(path: string): Promise<T> {
  return request<T>(path, {
    method: "DELETE",
  });
}

export const api = {
  get: get,
  post: post,
  postForm: postForm,
  put: put,
  delete: remove,
};