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
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

const toDisplayName = (user: User) =>
  `${user.firstName} ${user.lastName}`.trim() || user.email;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = tokenStore.getAccess();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    const claims = getAccessTokenClaims(token);
    if (!claims) {
      setUser(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    Promise.all([
      getUser(claims.userId, controller.signal),
      getRoles(controller.signal).catch(() => [] as Awaited<ReturnType<typeof getRoles>>),
    ])
      .then(([profile, roles]) => {
        if (controller.signal.aborted) return;
        const roleName =
          roles.find((role) => role.id === profile.roleId)?.name || claims.role || "";
        setUser({
          ...profile,
          roleName,
          displayName: toDisplayName(profile),
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load current user", err);
        // Fall back to JWT claims so the topbar still shows something useful.
        setUser({
          id: claims.userId,
          firstName: "",
          lastName: "",
          email: claims.email,
          roleId: 0,
          roleName: claims.role,
          displayName: claims.email || `User #${claims.userId}`,
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
