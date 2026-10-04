import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { tokenStore } from "../api/client";
import { getRoles, getUser } from "../services/userService";
import type { User } from "../types/user";
import { getAccessTokenClaims } from "./tokenClaims";

export interface CurrentUser extends User {
  roleName: string;
  displayName: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  setCurrentUser: (profile: User, roleName?: string) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refreshUser: async () => undefined,
  setCurrentUser: () => undefined,
});

const toDisplayName = (user: User) =>
  `${user.firstName} ${user.lastName}`.trim() || user.email;

const toCurrentUser = (profile: User, roleName: string): CurrentUser => ({
  ...profile,
  roleName,
  displayName: toDisplayName(profile),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async (signal?: AbortSignal) => {
    const token = tokenStore.getAccess();
    if (!token) {
      setUser(null);
      return;
    }

    const claims = getAccessTokenClaims(token);
    if (!claims) {
      setUser(null);
      return;
    }

    try {
      const [profile, roles] = await Promise.all([
        getUser(claims.userId, signal),
        getRoles(signal).catch(() => [] as Awaited<ReturnType<typeof getRoles>>),
      ]);
      if (signal?.aborted) return;
      const roleName =
        roles.find((role) => role.id === profile.roleId)?.name || claims.role || "";
      setUser(toCurrentUser(profile, roleName));
    } catch (err: unknown) {
      if (signal?.aborted) return;
      console.error("Failed to load current user", err);
      setUser({
        id: claims.userId,
        firstName: "",
        lastName: "",
        email: claims.email,
        roleId: 0,
        roleName: claims.role,
        displayName: claims.email || `User #${claims.userId}`,
      });
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadUser(controller.signal).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, []);

  const refreshUser = async () => {
    await loadUser();
  };

  const setCurrentUser = (profile: User, roleName?: string) => {
    setUser((prev) =>
      toCurrentUser(profile, roleName ?? prev?.roleName ?? ""),
    );
  };

  const value = useMemo(
    () => ({ user, loading, refreshUser, setCurrentUser }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
