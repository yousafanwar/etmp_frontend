const NAME_ID_URI =
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
const EMAIL_URI = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";
const ROLE_URI = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

export interface AccessTokenClaims {
  userId: number;
  email: string;
  role: string;
}

const decodePayload = (token: string): Record<string, unknown> | null => {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const asString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value) && value.length > 0) return asString(value[0]);
  return "";
};

export const getAccessTokenClaims = (token: string): AccessTokenClaims | null => {
  const payload = decodePayload(token);
  if (!payload) return null;

  const rawId = payload[NAME_ID_URI] ?? payload.nameid ?? payload.sub;
  const userId = Number(asString(rawId));
  if (!Number.isInteger(userId) || userId <= 0) return null;

  return {
    userId,
    email: asString(payload[EMAIL_URI] ?? payload.email),
    role: asString(payload[ROLE_URI] ?? payload.role),
  };
};
