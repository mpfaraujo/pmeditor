"use client";

import { AdminWorkspace } from "../admin-workspace";

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

function AdminUsuariosPageContent() {
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

  if (loading) return <div className="admin-state" role="status">Carregando administração…</div>;
  if (!isAdmin) return <div className="admin-state" role="status">Redirecionando para sua área de trabalho…</div>;

  return (
    <div className="admin-page">
      <div className="admin-users-body">
        {/* Header */}
        <div className="admin-page-head-inner mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div><h1 className="admin-page-title">Usuários e banco de questões</h1><p className="admin-page-subtitle">Acompanhe os cadastros e a participação no banco.</p></div>
        </div>

        {loadingStats && <p className="text-muted-foreground py-8" role="status">Carregando usuários…</p>}
        {erro && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert">{erro}</p>}

        {stats && (
          <>
            {/* Cards de resumo */}
            <div className="admin-summary">
              <div className="admin-summary-item">
                <div className="admin-summary-icon">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{stats.totalQuestoes}</div>
                  <div className="text-sm text-muted-foreground">Questões no banco</div>
                </div>
              </div>
              <div className="admin-summary-item">
                <div className="admin-summary-icon">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{stats.totalUsuarios}</div>
                  <div className="text-sm text-muted-foreground">Usuários cadastrados</div>
                </div>
              </div>
            </div>

            {/* Tabela de usuários */}
            <div className="admin-table-surface">
              <div className="admin-table-title">
                <h2 className="font-semibold">Usuários</h2>
              </div>
              <div className="admin-table-scroll"><table className="admin-user-table w-full text-sm">
                <thead className="bg-gray-50 text-xs text-muted-foreground">
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
                          u.role === "admin" ? "admin-role admin-role-admin" : "admin-role"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
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
              </table></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminUsuariosPage() {
  return <AdminWorkspace current="usuarios"><AdminUsuariosPageContent /></AdminWorkspace>;
}
