"use client";

import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import "../../library-workspace.css";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LegacyFiltroRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/editor/prova/selecionar-layout?${qs}` : "/editor/prova/selecionar-layout");
  }, [router, searchParams]);

  return (
    <div className="library-state" role="status">
      <div className="library-auth-panel">
        <h1 className="text-lg font-semibold text-slate-900">Redirecionando…</h1>
        <p className="mt-1 text-sm text-slate-500">
          A configuração da prova agora fica separada do banco de questões.
        </p>
      </div>
    </div>
  );
}

export default function FiltroQuestoesPage() {
  return (
    <WorkspaceShell section="mount" title="Configuração da prova"><Suspense fallback={<div className="library-state" role="status">Preparando configuração…</div>}>
      <LegacyFiltroRedirect />
    </Suspense></WorkspaceShell>
  );
}
