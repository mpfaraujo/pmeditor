"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PerfilPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/minha-area?tab=perfil");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Redirecionando...</div>
    </div>
  );
}
