"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Users, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_QUESTIONS_API_BASE?.replace(/\/questoes\/?$/, "") ?? "https://mpfaraujo.com.br/guardafiguras/api";

type Usuario = {
  googleId: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  updatedAt: string;
  totalQuestoes: number;
};

type Stats = {
  totalQuestoes: number;
  totalUsuarios: number;
  usuarios: Usuario[];
};

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminUsuariosPage() {
  const router = useRouter();
  const { isAdmin, loading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/dashboard");
  }, [isAdmin, loading, router]);

  useEffect(() => {
    if (loading || !isAdmin) return;
    const token = localStorage.getItem("pmeditor:session") ?? "";
    fetch(`${API_BASE}/admin/stats.php`, {
      headers: { "X-Session-Token": token },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setStats(data);
        else setErro(data.error ?? "Erro ao carregar.");
      })
      .catch(() => setErro("Falha na requisição."))
      .finally(() => setLoadingStats(false));
  }, [loading, isAdmin]);

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-xl font-bold">Dashboard Admin</h1>
        </div>

        {loadingStats && <p className="text-muted-foreground">Carregando…</p>}
        {erro && <p className="text-red-500">{erro}</p>}

        {stats && (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.totalQuestoes}</div>
                  <div className="text-sm text-muted-foreground">Questões no banco</div>
                </div>
              </div>
              <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
                <div className="bg-green-100 p-3 rounded-lg">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.totalUsuarios}</div>
                  <div className="text-sm text-muted-foreground">Usuários cadastrados</div>
                </div>
              </div>
            </div>

            {/* Tabela de usuários */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h2 className="font-semibold">Usuários</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-muted-foreground uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Usuário</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Papel</th>
                    <th className="px-4 py-3 text-right">Questões</th>
                    <th className="px-4 py-3 text-left">Último acesso</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.usuarios.map(u => (
                    <tr key={u.googleId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                              {(u.nome || u.email)?.[0]?.toUpperCase() ?? "?"}
                            </div>
                          )}
                          <span className="font-medium">{u.nome || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {u.totalQuestoes > 0 ? (
                          <span className="font-semibold text-blue-600">{u.totalQuestoes}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
