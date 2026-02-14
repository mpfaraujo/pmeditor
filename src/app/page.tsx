// src/app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, BookOpen, FileText, ClipboardCopy, Settings } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActionCard } from "@/components/dashboard/ActionCard";
import { ProtectedActionCard } from "@/components/dashboard/ProtectedActionCard";
import { LoginButton } from "@/components/auth/LoginButton";

const SHOW_METRICS = false;

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Editor de Questões
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Banco de questões e montagem de provas.
            </p>
          </div>
          <LoginButton />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {SHOW_METRICS && (<>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard label="Questões Criadas" value={0} tone="blue" />
          <StatCard label="Provas Geradas" value={0} tone="green" />
          <StatCard label="Alunos Avaliados" value={0} tone="purple" />
        </div></>)}

        <Separator className="my-8" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
  <ProtectedActionCard
    href="/editor"
    title="Nova Questão"
    description="Crie uma nova questão no editor."
    icon={<PlusCircle className="h-6 w-6" />}
    accent="blue"
  />

  <ActionCard
    href="/editor/questoes/filtro"
    title="Banco de Questões"
    description="Filtre, navegue e selecione questões para montar provas."
    icon={<BookOpen className="h-6 w-6" />}
    accent="purple"
  />

  <ActionCard
    href="/template"
    title="Modelo de Questão"
    description="Copie o modelo para pré-preencher as informações da questão."
    icon={<ClipboardCopy className="h-6 w-6" />}
    accent="green"
  />
</div>

      </div>
    </main>
  );
}
