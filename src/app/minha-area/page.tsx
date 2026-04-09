"use client";

import { Suspense, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Users, FileText, ClipboardList, ShieldCheck, BookOpen, AlignLeft } from "lucide-react";
import Link from "next/link";
import { ProfileTab } from "@/components/minha-area/ProfileTab";
import { TurmasTab } from "@/components/minha-area/TurmasTab";
import { QuestoesTab } from "@/components/minha-area/QuestoesTab";
import { ProvasTab } from "@/components/minha-area/ProvasTab";

function ShortcutItem({
  icon,
  title,
  description,
  actionLabel,
  href,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#F4F4F2]">{title}</p>
          <p className="mt-0.5 text-sm leading-snug text-[#9eb4d1]">{description}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="mt-3 w-full border-white/15 bg-white/6 text-white hover:bg-white/12 hover:text-white"
      >
        <Link href={href}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

function MinhaAreaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn, isAdmin, loading } = useAuth();

  const defaultTab = searchParams.get("tab") ?? "perfil";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Carregando...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-slate-600">Faça login para acessar sua área.</p>
        <Button onClick={() => router.push("/")}>Voltar ao início</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F2] xl:h-screen xl:overflow-hidden">
      <div className="h-full xl:grid xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <Tabs defaultValue={defaultTab} className="space-y-0 xl:contents">
          <div className="xl:contents">
            <aside className="border-r border-white/6 bg-[#0B1020] px-4 py-5 xl:overflow-y-auto">
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
                  className="-ml-2 h-8 px-2 text-[#9eb4d1] hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>

                <TabsList className="h-auto w-full flex-col items-stretch bg-transparent gap-2 p-0">
                  <TabsTrigger
                    value="perfil"
                    className="w-full justify-start gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-left text-[#c9d7ea] data-[state=active]:border-[#FBC02D]/50 data-[state=active]:bg-[#FBC02D] data-[state=active]:text-[#2D3436] data-[state=active]:shadow-md transition-all"
                  >
                    <User className="h-4 w-4" />
                    <span>Perfil</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="turmas"
                    className="w-full justify-start gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-left text-[#c9d7ea] data-[state=active]:border-[#FBC02D]/50 data-[state=active]:bg-[#FBC02D] data-[state=active]:text-[#2D3436] data-[state=active]:shadow-md transition-all"
                  >
                    <Users className="h-4 w-4" />
                    <span>Turmas</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="questoes"
                    className="w-full justify-start gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-left text-[#c9d7ea] data-[state=active]:border-[#FBC02D]/50 data-[state=active]:bg-[#FBC02D] data-[state=active]:text-[#2D3436] data-[state=active]:shadow-md transition-all"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Questões</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="provas"
                    className="w-full justify-start gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-left text-[#c9d7ea] data-[state=active]:border-[#FBC02D]/50 data-[state=active]:bg-[#FBC02D] data-[state=active]:text-[#2D3436] data-[state=active]:shadow-md transition-all"
                  >
                    <ClipboardList className="h-4 w-4" />
                    <span>Provas</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </aside>

            <div className="min-w-0 xl:overflow-y-auto">
              <div className="border-b border-[#11182a] bg-[#0B1020] px-5 py-4 animate-fade-in-up xl:px-6">
                <h1 className="pm-work-title text-white">Minha Área</h1>
                <p className="pm-work-subtitle">{user?.email}</p>
              </div>
              <TabsContent value="perfil" className="mt-0 animate-fade-in-up px-4 py-5 xl:px-6">
                <ProfileTab />
              </TabsContent>

              <TabsContent value="turmas" className="mt-0 animate-fade-in-up px-4 py-5 xl:px-6">
                <TurmasTab />
              </TabsContent>

              <TabsContent value="questoes" className="mt-0 animate-fade-in-up px-4 py-5 xl:px-6">
                <QuestoesTab />
              </TabsContent>

              <TabsContent value="provas" className="mt-0 animate-fade-in-up px-4 py-5 xl:px-6">
                <ProvasTab />
              </TabsContent>
            </div>

            <aside className="border-l border-white/6 bg-[#0B1020] px-4 py-5 xl:overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-2">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#9eb4d1]">
                    Atalhos
                  </p>
                  {isAdmin && (
                    <span className="rounded-full border border-[#FBC02D]/30 bg-[#FBC02D]/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#FBC02D]">
                      Admin
                    </span>
                  )}
                </div>

                <ShortcutItem
                  icon={<BookOpen className="h-4 w-4 text-[#FBC02D]" />}
                  title="Assuntos"
                  description="Ajustes na árvore da sua disciplina."
                  actionLabel="Abrir"
                  href="/editor/assuntos"
                />

                <ShortcutItem
                  icon={<AlignLeft className="h-4 w-4 text-[#FBC02D]" />}
                  title="Textos base"
                  description="Gerencie textos vinculados às suas questões."
                  actionLabel="Abrir"
                  href="/editor/textos-base"
                />

                {isAdmin && (
                  <div className="rounded-xl border border-[#FBC02D]/20 bg-[#FBC02D]/8 p-3">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 text-[#FBC02D]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#F4F4F2]">Administrador</p>
                        <p className="mt-0.5 text-sm leading-snug text-[#9eb4d1]">
                          Rotas de manutenção e gestão.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/15 bg-white/6 text-white hover:bg-white/12 hover:text-white"
                        onClick={() => router.push("/admin/usuarios")}
                      >
                        Usuários
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/15 bg-white/6 text-white hover:bg-white/12 hover:text-white"
                        onClick={() => router.push("/admin/gerenciar")}
                      >
                        Questões
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default function MinhaAreaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-slate-400">Carregando...</div>
        </div>
      }
    >
      <MinhaAreaContent />
    </Suspense>
  );
}
