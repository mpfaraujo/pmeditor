"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCopy, FilePlus2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default function Home() {
  const { isLoggedIn, loading } = useAuth();
  return (
    <WorkspaceShell section="dashboard" title="Seu espaço de preparação">
      <main className="workspace-dashboard">
        <div className="workspace-dashboard-intro">
          <div><h1>Prepare sua próxima prova</h1><p>Encontre questões, organize seus materiais e monte a avaliação.</p></div>
          {isLoggedIn && <Button asChild variant="outline"><Link href="/minha-area?tab=provas"><FolderOpen size={16} />Suas provas</Link></Button>}
        </div>
        <div className="workspace-dashboard-grid">
          <section className="workspace-dashboard-feature">
            <BookOpen size={30} strokeWidth={1.6} aria-hidden="true" />
            <h2>Comece pelas questões</h2>
            <p>Filtre por disciplina, assunto e origem. Confira o conteúdo e acompanhe a seleção enquanto prepara sua prova.</p>
            <Button asChild className="workspace-primary"><Link href="/editor/questoes">Explorar banco de questões<ArrowRight size={16} /></Link></Button>
          </section>
          <section className="workspace-dashboard-links" aria-label="Outras tarefas">
            {isLoggedIn ? <Link href="/editor?skipYaml=1"><FilePlus2 size={22} aria-hidden="true" /><div><strong>Nova questão</strong><p>Abra o editor para criar seu conteúdo.</p></div><ArrowRight className="ml-auto shrink-0" size={16} /></Link> : <div className="py-6"><strong>Nova questão</strong><p className="workspace-help mt-2">{loading ? "Carregando sua sessão…" : "Entre na sua conta para criar questões."}</p></div>}
            <Link href="/template"><ClipboardCopy size={22} aria-hidden="true" /><div><strong>Modelo de questão</strong><p>Copie o modelo para preencher informações.</p></div><ArrowRight className="ml-auto shrink-0" size={16} /></Link>
            {isLoggedIn ? <Link href="/minha-area"><FolderOpen size={22} aria-hidden="true" /><div><strong>Minha área</strong><p>Perfil, turmas, questões e provas salvas.</p></div><ArrowRight className="ml-auto shrink-0" size={16} /></Link> : <div className="py-6"><strong>Minha área</strong><p className="workspace-help mt-2">Entre para acessar seus materiais.</p></div>}
          </section>
        </div>
      </main>
    </WorkspaceShell>
  );
}
