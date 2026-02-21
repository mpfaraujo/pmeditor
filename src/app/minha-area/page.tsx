"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Users, FileText, ClipboardList, ShieldCheck } from "lucide-react";
import { ProfileTab } from "@/components/minha-area/ProfileTab";
import { TurmasTab } from "@/components/minha-area/TurmasTab";
import { QuestoesTab } from "@/components/minha-area/QuestoesTab";
import { ProvasTab } from "@/components/minha-area/ProvasTab";

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
    <div className="min-h-screen stripe-grid-bg p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header ProvaMarela */}
        <div className="mb-8 animate-fade-in-up">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="mb-6 hover:bg-white/80 transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <div className="stripe-card-gradient p-8 mb-6">
            <h1 className="text-4xl font-bold text-slate-800">
              Minha Área
            </h1>
            <p className="text-slate-600 mt-2 text-lg">{user?.email}</p>
          </div>
        </div>

        {/* Área admin — só visível para admins */}
        {isAdmin && (
          <div className="mb-6 p-4 border border-amber-200 bg-amber-50 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-medium">Administrador</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={() => router.push("/admin/gerenciar")}
            >
              Gerenciar Questões
            </Button>
          </div>
        )}

        {/* Tabs com identidade ProvaMarela */}
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <div className="glass rounded-xl p-2">
            <TabsList className="w-full bg-transparent gap-2">
              <TabsTrigger
                value="perfil"
                className="gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Perfil</span>
              </TabsTrigger>
              <TabsTrigger
                value="turmas"
                className="gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Turmas</span>
              </TabsTrigger>
              <TabsTrigger
                value="questoes"
                className="gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Questões</span>
              </TabsTrigger>
              <TabsTrigger
                value="provas"
                className="gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Provas</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="perfil" className="mt-6 animate-fade-in-up">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="turmas" className="mt-6 animate-fade-in-up">
            <TurmasTab />
          </TabsContent>

          <TabsContent value="questoes" className="mt-6 animate-fade-in-up">
            <QuestoesTab />
          </TabsContent>

          <TabsContent value="provas" className="mt-6 animate-fade-in-up">
            <ProvasTab />
          </TabsContent>
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
