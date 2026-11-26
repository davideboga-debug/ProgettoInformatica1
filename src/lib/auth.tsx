import { createAuthClient } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const authClient = createAuthClient(__NEON_AUTH_URL__, {
  adapter: BetterAuthReactAdapter(),
});

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
  image?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await authClient.getSession();
      setUser((data?.user as AuthUser | undefined) ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      setUser(null);
    }
  }, []);

  const getToken = useCallback(async () => {
    // Nessuna sessione: evitiamo la chiamata a /token (401) per i visitatori anonimi.
    if (!user) return null;
    try {
      // Il plugin JWT di Better Auth espone `token()` a runtime; i tipi del
      // wrapper React non lo dichiarano ancora.
      const client = authClient as unknown as {
        token: () => Promise<{ data?: { token?: string } | null; error?: unknown }>;
      };
      const { data, error } = await client.token();
      if (error) return null;
      return data?.token ?? null;
    } catch {
      return null;
    }
  }, [user]);

  const value = useMemo(
    () => ({ user, loading, refresh, signOut, getToken }),
    [user, loading, refresh, signOut, getToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve essere usato dentro AuthProvider");
  return value;
}
