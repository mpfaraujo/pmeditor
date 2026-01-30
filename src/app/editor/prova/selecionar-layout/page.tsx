"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProva } from "@/contexts/ProvaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ImageUpload } from "@/components/editor/ImageUpload";

type LayoutType = "prova" | "exercicio";
type ColumnCount = 1 | 2;

export default function SelecionarLayoutPage() {
  const router = useRouter();
  const { provaConfig, updateProvaConfig } = useProva();

  const [layoutType, setLayoutType] = useState<LayoutType>(provaConfig.layoutType);
  const [columns, setColumns] = useState<ColumnCount>(provaConfig.columns);
  const [professor, setProfessor] = useState(provaConfig.professor);
  const [disciplina, setDisciplina] = useState(provaConfig.disciplina);
  const [data, setData] = useState(provaConfig.data);
  const [turma, setTurma] = useState(provaConfig.turma);
  const [logoUrl, setLogoUrl] = useState<string | null>(provaConfig.logoUrl);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);

  const handleContinuar = () => {
    // Atualiza o contexto com as configurações
    updateProvaConfig({
      layoutType,
      columns,
      professor,
      disciplina,
      data,
      turma,
      logoUrl,
    });

    // Redireciona para a página de montagem
    router.push("/editor/prova/montar");
  };

  const handleVoltar = () => {
    router.push("/editor/questoes");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={handleVoltar}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">Configurar Prova</h1>
          <p className="text-slate-600 mt-2">
            Escolha o layout e preencha os dados da sua prova
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna 1: Tipo e Colunas */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Tipo de Layout</CardTitle>
                <CardDescription>Escolha o formato da prova</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tipo de Layout */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Tipo</Label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setLayoutType("prova")}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        layoutType === "prova"
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="font-semibold text-slate-900">Prova</div>
                      <div className="text-sm text-slate-600">
                        Com campos de nome, turma, data, nota
                      </div>
                    </button>

                    <button
                      onClick={() => setLayoutType("exercicio")}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        layoutType === "exercicio"
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="font-semibold text-slate-900">Lista de Exercício</div>
                      <div className="text-sm text-slate-600">
                        Apenas logo e questões
                      </div>
                    </button>
                  </div>
                </div>

                {/* Número de Colunas */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Colunas</Label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setColumns(1)}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        columns === 1
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="font-semibold text-slate-900">1 Coluna</div>
                      <div className="text-sm text-slate-600">
                        Questões em sequência
                      </div>
                    </button>

                    <button
                      onClick={() => setColumns(2)}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        columns === 2
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="font-semibold text-slate-900">2 Colunas</div>
                      <div className="text-sm text-slate-600">
                        Questões lado a lado
                      </div>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna 2-3: Dados da Prova */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Dados da Prova</CardTitle>
                <CardDescription>Preencha as informações da sua prova</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo */}
                <div className="space-y-3">
                  <Label htmlFor="logo" className="text-base font-semibold">
                    Logo da Instituição
                  </Label>
                  <div
                    onClick={() => setLogoDialogOpen(true)}
                    className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-slate-400 transition-colors bg-slate-50"
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <div className="text-slate-600 font-medium">Clique para adicionar logo</div>
                        <div className="text-sm text-slate-500">PNG, JPG ou SVG</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid de Campos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="professor">Professor</Label>
                    <Input
                      id="professor"
                      placeholder="Nome do professor"
                      value={professor}
                      onChange={(e) => setProfessor(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="disciplina">Disciplina</Label>
                    <Input
                      id="disciplina"
                      placeholder="Ex: Matemática"
                      value={disciplina}
                      onChange={(e) => setDisciplina(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data">Data</Label>
                    <Input
                      id="data"
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="turma">Turma</Label>
                    <Input
                      id="turma"
                      placeholder="Ex: 3A"
                      value={turma}
                      onChange={(e) => setTurma(e.target.value)}
                    />
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleVoltar}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleContinuar}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Continuar para Montagem
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialog para upload de logo */}
      <ImageUpload
        open={logoDialogOpen}
        onOpenChange={setLogoDialogOpen}
        onImageInsert={(url) => {
          setLogoUrl(url);
          setLogoDialogOpen(false);
        }}
      />
    </div>
  );
}
