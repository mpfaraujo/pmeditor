"use client";

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
    <div className="pm-shell flex items-center justify-center p-6">
      <div className="pm-surface rounded-2xl px-6 py-5 text-center">
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
    <Suspense>
      <LegacyFiltroRedirect />
    </Suspense>
  );
}
