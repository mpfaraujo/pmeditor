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
      <div className="rounded-2xl border border-white/8 bg-[#10172B] p-6 animate-pulse">
        <div className="mb-3 h-12 w-12 rounded-2xl bg-white/10" />
        <div className="mb-2 h-4 w-32 rounded bg-white/10" />
        <div className="h-3 w-48 rounded bg-white/6" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#10172B]/75 p-6 opacity-80">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-[#7f90ab]">
            {props.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-[#d8e2f0]">
              {props.title}
            </h2>
            <p className="mt-1 text-sm text-[#8ea2bf]">
              Faça login para criar questões.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <ActionCard {...props} />;
}
