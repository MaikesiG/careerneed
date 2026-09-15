"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";

export type AuthUser = {
  id: string;
  email: string;
  created_at: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const response = await apiFetch("/auth/me", {
        cache: "no-store",
      });

      if (!response.ok) {
        setUser(null);
        return null;
      }

      const currentUser = (await response.json()) as AuthUser;
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const response = await apiFetch("/auth/me", {
          cache: "no-store",
        });

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setUser(null);
          return;
        }

        setUser((await response.json()) as AuthUser);
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      refreshUser,
      logout,
    }),
    [isLoading, logout, refreshUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
