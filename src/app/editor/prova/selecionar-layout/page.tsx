"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProva } from "@/contexts/ProvaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ImageUpload } from "@/components/editor/ImageUpload";

type LayoutType = "prova" | "exercicio";
type ColumnCount = 1 | 2;

export default function SelecionarLayoutPage() {
  const router = useRouter();
  const { provaConfig, updateProvaConfig } = useProva();

  const [layoutType, setLayoutType] = useState<LayoutType>(provaConfig.layoutType);
  const [columns, setColumns] = useState<ColumnCount>(provaConfig.columns);

  const [showGabarito, setShowGabarito] = useState<boolean>(
    provaConfig.showGabarito
  );

  const [nome, setNome] = useState(provaConfig.nome);
  const [turma, setTurma] = useState(provaConfig.turma);
  const [professor, setProfessor] = useState(provaConfig.professor);
  const [disciplina, setDisciplina] = useState(provaConfig.disciplina);
  const [data, setData] = useState(provaConfig.data);
  const [nota, setNota] = useState(provaConfig.nota);

  const [instituicao, setInstituicao] = useState(provaConfig.instituicao);

  const [logoUrl, setLogoUrl] = useState<string | null>(provaConfig.logoUrl);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);

  // 0 = ProvaHeader original (default). 1..9 = ProvaHeaderLayout1..9
  const [headerLayout, setHeaderLayout] = useState<number>(
    (provaConfig as any).headerLayout ?? 0
  );

  const handleContinuar = () => {
    updateProvaConfig({
      layoutType,
      columns,
      showGabarito,
      nome,
      turma,
      professor,
      disciplina,
      data,
      nota,
      instituicao,
      logoUrl,
      headerLayout,
    } as any);

    router.push("/editor/prova/montar");
  };

  const handleVoltar = () => {
    router.push("/editor/questoes");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" onClick={handleVoltar} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">
            Configurar Prova
          </h1>
          <p className="text-slate-600 mt-2">
            Escolha o layout e preencha os dados
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Layout */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Layout</CardTitle>
                <CardDescription>Formato e colunas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setLayoutType("prova")}
                    className={`w-full p-3 rounded-lg border-2 text-left ${
                      layoutType === "prova"
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="font-semibold">Prova</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutType("exercicio")}
                    className={`w-full p-3 rounded-lg border-2 text-left ${
                      layoutType === "exercicio"
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="font-semibold">Lista de Exercício</div>
                  </button>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setColumns(1)}
                    className={`w-full p-3 rounded-lg border-2 text-left ${
                      columns === 1
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    1 Coluna
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumns(2)}
                    className={`w-full p-3 rounded-lg border-2 text-left ${
                      columns === 2
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    2 Colunas
                  </button>
                </div>

                {/* Header */}
                <div className="space-y-2 pt-2">
                  <Label>Modelo de cabeçalho</Label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 10 }, (_, i) => i).map((i) => {
                      const active = headerLayout === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setHeaderLayout(i)}
                          className={[
                            "h-7 w-7 rounded-full border text-xs font-semibold",
                            "flex items-center justify-center select-none",
                            active
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-slate-300 bg-white text-slate-700",
                          ].join(" ")}
                          aria-label={`Header layout ${i}`}
                          title={i === 0 ? "Header original" : `Header layout ${i}`}
                        >
                          {i}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Gabarito */}
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="showGabarito"
                    checked={showGabarito}
                    onCheckedChange={(v) => setShowGabarito(Boolean(v))}
                  />
                  <Label htmlFor="showGabarito">Mostrar gabarito</Label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dados */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Dados da Prova</CardTitle>
                <CardDescription>Cabeçalho</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Logo</Label>
                  <div
                    onClick={() => setLogoDialogOpen(true)}
                    className="w-full h-32 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer bg-slate-50"
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        className="max-h-full max-w-full object-contain"
                        alt=""
                      />
                    ) : (
                      "Clique para adicionar logo"
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Instituição</Label>
                    <Input
                      value={instituicao}
                      onChange={(e) => setInstituicao(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Nome</Label>
                    <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div>
                    <Label>Turma</Label>
                    <Input value={turma} onChange={(e) => setTurma(e.target.value)} />
                  </div>
                  <div>
                    <Label>Professor</Label>
                    <Input
                      value={professor}
                      onChange={(e) => setProfessor(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Disciplina</Label>
                    <Input
                      value={disciplina}
                      onChange={(e) => setDisciplina(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Nota</Label>
                    <Input value={nota} onChange={(e) => setNota(e.target.value)} />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={handleVoltar} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleContinuar} className="flex-1">
                    Continuar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
