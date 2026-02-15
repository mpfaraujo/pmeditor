"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Users, FileText, ClipboardList } from "lucide-react";
import { ProfileTab } from "@/components/minha-area/ProfileTab";
import { TurmasTab } from "@/components/minha-area/TurmasTab";
import { QuestoesTab } from "@/components/minha-area/QuestoesTab";
import { ProvasTab } from "@/components/minha-area/ProvasTab";

function MinhaAreaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn, loading } = useAuth();

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">Minha Área</h1>
          <p className="text-slate-600 mt-2">{user?.email}</p>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full">
            <TabsTrigger value="perfil" className="gap-1.5">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="turmas" className="gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Turmas</span>
            </TabsTrigger>
            <TabsTrigger value="questoes" className="gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Questões</span>
            </TabsTrigger>
            <TabsTrigger value="provas" className="gap-1.5">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Provas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="mt-6">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="turmas" className="mt-6">
            <TurmasTab />
          </TabsContent>

          <TabsContent value="questoes" className="mt-6">
            <QuestoesTab />
          </TabsContent>

          <TabsContent value="provas" className="mt-6">
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
