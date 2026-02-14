"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ActionCard } from "./ActionCard";

/**
 * ActionCard que só aparece para usuários logados.
 * Visitantes veem nada (ou uma versão desabilitada).
 */
export function ProtectedActionCard(props: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: "blue" | "green" | "purple" | "gray";
  badge?: string;
}) {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="rounded-xl border bg-white shadow-sm p-6 animate-pulse">
        <div className="h-12 w-12 rounded-xl bg-slate-200 mb-3" />
        <div className="h-4 w-32 bg-slate-200 rounded mb-2" />
        <div className="h-3 w-48 bg-slate-100 rounded" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border bg-white/60 shadow-sm p-6 opacity-60">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
            {props.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-slate-400">
              {props.title}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Faça login para criar questões.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <ActionCard {...props} />;
}
