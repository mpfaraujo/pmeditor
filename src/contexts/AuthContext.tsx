"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { UserProfile } from "@/types/user";
import {
  loginWithGoogle as apiLogin,
  getProfile as apiGetProfile,
  saveProfile as apiSaveProfile,
} from "@/lib/user";

const LS_SESSION_KEY = "pmeditor:session";

interface AuthContextType {
  /** Perfil do usuário logado (null = visitante) */
  user: UserProfile | null;
  isLoggedIn: boolean;
  loading: boolean;

  login: (idToken: string) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;

  /* helpers de defaults */
  defaultProfessor: string;
  defaultDisciplina: string;
  defaultInstituicao: string;
  defaultLogoUrl: string | null;

  /* helpers de permissão */
  isAdmin: boolean;
  canCreateQuestion: boolean;
  canEditQuestion: (authorId?: string) => boolean;
  canDeleteQuestion: (authorId?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // restaurar sessão no mount (client-only, evita hydration mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(LS_SESSION_KEY);
    if (!stored) return;

    setSessionToken(stored);
    setLoading(true);

    let cancelled = false;
    apiGetProfile(stored)
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch(() => {
        localStorage.removeItem(LS_SESSION_KEY);
        if (!cancelled) {
          setSessionToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (idToken: string) => {
    const { sessionToken: token, profile } = await apiLogin(idToken);
    localStorage.setItem(LS_SESSION_KEY, token);
    setSessionToken(token);
    setUser(profile);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(LS_SESSION_KEY);
    setSessionToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!sessionToken) return;
      const updated = await apiSaveProfile(sessionToken, patch);
      setUser(updated);
    },
    [sessionToken]
  );

  const value = useMemo<AuthContextType>(() => {
    const isLoggedIn = !!user;
    const isAdmin = user?.role === "admin";

    const firstInst = user?.instituicoes?.[0];

    return {
      user,
      isLoggedIn,
      loading,

      login,
      logout,
      updateProfile,

      defaultProfessor: user?.nome ?? "",
      defaultDisciplina: user?.disciplinas?.[0] ?? "",
      defaultInstituicao: firstInst?.nome ?? "",
      defaultLogoUrl: firstInst?.logoUrl ?? null,

      isAdmin,
      canCreateQuestion: isLoggedIn,
      canEditQuestion: (authorId?: string) =>
        isAdmin || (isLoggedIn && !!authorId && authorId === user?.googleId),
      canDeleteQuestion: (authorId?: string) =>
        isAdmin || (isLoggedIn && !!authorId && authorId === user?.googleId),
    };
  }, [user, loading, login, logout, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
