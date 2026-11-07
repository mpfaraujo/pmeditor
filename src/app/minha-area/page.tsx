"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Users, FileText, ClipboardList, ShieldCheck, BookOpen, AlignLeft, Plus } from "lucide-react";
import Link from "next/link";
import { ProfileTab } from "@/components/minha-area/ProfileTab";
import { TurmasTab } from "@/components/minha-area/TurmasTab";
import { QuestoesTab } from "@/components/minha-area/QuestoesTab";
import { ProvasTab } from "@/components/minha-area/ProvasTab";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

const sections = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "turmas", label: "Turmas", icon: Users },
  { id: "questoes", label: "Questões", icon: FileText },
  { id: "provas", label: "Provas", icon: ClipboardList },
];

function MinhaAreaContent() {
  const searchParams = useSearchParams();
  const { user, isLoggedIn, isAdmin, loading } = useAuth();
  const requestedTab = searchParams.get("tab") ?? "perfil";
  const defaultTab = sections.some(section => section.id === requestedTab) ? requestedTab : "perfil";

  if (loading) return <div className="p-12 text-center text-muted-foreground" role="status">Carregando sua área…</div>;
  if (!isLoggedIn) return <div className="workspace-mount-empty"><h1>Seus materiais em um só lugar</h1><p className="workspace-help mb-5">Entre na sua conta pelo botão no topo para acessar sua área.</p><Button asChild variant="outline"><Link href="/dashboard">Voltar ao início</Link></Button></div>;

  return (
    <Tabs defaultValue={defaultTab} className="workspace-area-tabs">
      <div className="workspace-area-layout">
        <aside className="workspace-area-nav" aria-label="Seções da minha área">
          <TabsList aria-label="Materiais e perfil">
            {sections.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}><Icon className="mr-2 h-4 w-4" />{label}</TabsTrigger>)}
          </TabsList>
          <div className="workspace-inspector-section" />
          <Link href="/editor/textos-base"><AlignLeft size={16} />Textos base</Link>
          <Link href="/editor/assuntos"><BookOpen size={16} />Assuntos</Link>
          <Link href="/template"><FileText size={16} />Modelo de questão</Link>
          {isAdmin && <>
            <div className="workspace-inspector-section"><p className="workspace-help mb-3 flex items-center gap-2"><ShieldCheck size={15} />Administração</p></div>
            <Link href="/admin/usuarios"><Users size={16} />Usuários</Link>
            <Link href="/admin/gerenciar"><BookOpen size={16} />Gerenciar questões</Link>
          </>}
        </aside>
        <main className="workspace-area-content">
          <div className="workspace-page-heading"><div><h1>Minha área</h1><p>{user?.email}</p></div><Button asChild className="workspace-primary"><Link href="/editor/questoes"><Plus size={16} />Nova prova</Link></Button></div>
          <TabsContent value="perfil"><ProfileTab /></TabsContent>
          <TabsContent value="turmas"><TurmasTab /></TabsContent>
          <TabsContent value="questoes"><QuestoesTab /></TabsContent>
          <TabsContent value="provas"><ProvasTab /></TabsContent>
        </main>
      </div>
    </Tabs>
  );
}

export default function MinhaAreaPage() {
  return <WorkspaceShell section="area" title="Minha área"><Suspense fallback={<div className="p-12 text-center" role="status">Carregando…</div>}><MinhaAreaContent /></Suspense></WorkspaceShell>;
}
