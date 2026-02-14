"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImageUpload } from "@/components/editor/ImageUpload";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import type { Institution } from "@/types/user";

export default function PerfilPage() {
  const router = useRouter();
  const { user, isLoggedIn, loading, updateProfile } = useAuth();

  const [nome, setNome] = useState("");
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [newDisciplina, setNewDisciplina] = useState("");
  const [instituicoes, setInstituicoes] = useState<Institution[]>([]);
  const [saving, setSaving] = useState(false);
  const [logoDialogOpen, setLogoDialogOpen] = useState<number | null>(null);

  // sincronizar com user
  useEffect(() => {
    if (!user) return;
    setNome(user.nome ?? "");
    setDisciplinas(user.disciplinas ?? []);
    setInstituicoes(user.instituicoes ?? []);
  }, [user]);

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
        <p className="text-slate-600">Faça login para acessar seu perfil.</p>
        <Button onClick={() => router.push("/")}>Voltar ao início</Button>
      </div>
    );
  }

  const addDisciplina = () => {
    const val = newDisciplina.trim();
    if (!val || disciplinas.includes(val)) return;
    setDisciplinas((prev) => [...prev, val]);
    setNewDisciplina("");
  };

  const removeDisciplina = (idx: number) => {
    setDisciplinas((prev) => prev.filter((_, i) => i !== idx));
  };

  const addInstituicao = () => {
    setInstituicoes((prev) => [...prev, { nome: "", logoUrl: null }]);
  };

  const removeInstituicao = (idx: number) => {
    setInstituicoes((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateInstituicao = (idx: number, patch: Partial<Institution>) => {
    setInstituicoes((prev) =>
      prev.map((inst, i) => (i === idx ? { ...inst, ...patch } : inst))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ nome, disciplinas, instituicoes });
      alert("Perfil salvo!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">Meu Perfil</h1>
          <p className="text-slate-600 mt-2">{user?.email}</p>
        </div>

        <div className="space-y-6">
          {/* Nome */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do professor</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
            </CardContent>
          </Card>

          {/* Disciplinas */}
          <Card>
            <CardHeader>
              <CardTitle>Disciplinas</CardTitle>
              <CardDescription>
                Suas disciplinas principais (usadas como default na criação de questões)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {disciplinas.map((d, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => removeDisciplina(i)}
                      className="ml-1 rounded-full p-0.5 hover:bg-slate-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newDisciplina}
                  onChange={(e) => setNewDisciplina(e.target.value)}
                  placeholder="Ex.: Matemática"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDisciplina();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addDisciplina}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instituições */}
          <Card>
            <CardHeader>
              <CardTitle>Instituições</CardTitle>
              <CardDescription>
                Suas escolas/universidades (nome + logo para o cabeçalho da prova)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {instituicoes.map((inst, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={inst.nome}
                      onChange={(e) => updateInstituicao(i, { nome: e.target.value })}
                      placeholder="Nome da instituição"
                    />
                    <div className="flex items-center gap-2">
                      {inst.logoUrl ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={inst.logoUrl}
                            alt=""
                            className="h-10 max-w-[120px] object-contain"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLogoDialogOpen(i)}
                          >
                            Trocar logo
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogoDialogOpen(i)}
                        >
                          Adicionar logo
                        </Button>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInstituicao(i)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={addInstituicao} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar instituição
              </Button>
            </CardContent>
          </Card>

          {/* Salvar */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="px-8">
              {saving ? "Salvando..." : "Salvar perfil"}
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog de upload de logo (reutilizado) */}
      {logoDialogOpen !== null && (
        <ImageUpload
          open
          onOpenChange={(open) => {
            if (!open) setLogoDialogOpen(null);
          }}
          onImageInsert={(url) => {
            updateInstituicao(logoDialogOpen, { logoUrl: url });
            setLogoDialogOpen(null);
          }}
        />
      )}
    </div>
  );
}
