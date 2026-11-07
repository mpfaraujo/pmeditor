"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default function PerfilPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/minha-area?tab=perfil");
  }, [router]);

  return (
    <WorkspaceShell section="area" title="Perfil"><div className="p-12 text-center" role="status">
      <div className="animate-pulse text-slate-400">Redirecionando...</div>
    </div></WorkspaceShell>
  );
}
