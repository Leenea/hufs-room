import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";

export type Me = {
  user: { id: string; nickname: string; email: string; role: "user" | "landlord" | "admin"; verification_status: string; is_demo: boolean; created_at: string } | null;
  access?: { level: string; hasReview: boolean; freeLeft: number; viewed: string[] };
  unread?: number;
  isLandlord?: boolean;
};
type Ctx = { me: Me; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ me: { user: null }, loading: true, refresh: async () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>({ user: null });
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
    } catch {
      setMe({ user: null });
    } finally {
      setLoading(false);
    }
  }, []);
  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    await refresh();
  }, [refresh]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);
  return <AuthCtx.Provider value={{ me, loading, refresh, logout }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
