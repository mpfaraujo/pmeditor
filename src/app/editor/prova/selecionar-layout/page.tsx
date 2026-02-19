"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProva } from "@/contexts/ProvaContext";
import { useAuth } from "@/contexts/AuthContext";
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
import { LogoPicker } from "@/components/editor/LogoPicker";
import { DotPicker, type DotPickerOption } from "@/components/ui/dot-picker";

type LayoutType = "prova" | "exercicio";
type ColumnCount = 1 | 2;


export default function SelecionarLayoutPage() {
  
  const router = useRouter();
  const { provaConfig, updateProvaConfig } = useProva();
  const {
    isLoggedIn,
    defaultProfessor,
    defaultDisciplina,
    defaultInstituicao,
    defaultLogoUrl,
    user,
  } = useAuth();

  const [layoutType, setLayoutType] = useState<LayoutType>(provaConfig.layoutType);
const [columns, setColumns] = useState<ColumnCount>(
  Number(provaConfig.columns) === 2 ? 2 : 1
);


  const [showGabarito, setShowGabarito] = useState<boolean>(
    provaConfig.showGabarito
  );

  const [turma, setTurma] = useState(provaConfig.turma);
  const [professor, setProfessor] = useState(provaConfig.professor);
  const [disciplina, setDisciplina] = useState(provaConfig.disciplina);
  const [data, setData] = useState(provaConfig.data);

  const [instituicao, setInstituicao] = useState(provaConfig.instituicao);

  const [logoUrl, setLogoUrl] = useState<string | null>(provaConfig.logoUrl);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [noLogo, setNoLogo] = useState<boolean>(!provaConfig.logoUrl);
const [logoPlaceholder, setLogoPlaceholder] = useState<string>(
  provaConfig.logoPlaceholder
);


  // 0 = ProvaHeader original (default). 1..9 = ProvaHeaderLayout1..9
  const [headerLayout, setHeaderLayout] = useState<number>(
    (provaConfig as any).headerLayout ?? 0
  );

  const headerOptions: DotPickerOption[] = Array.from({ length: 11 }, (_, i) => ({
    value: i,
    title: i === 0 ? "Header original" : `Header layout ${i}`,
    ariaLabel: `Header layout ${i}`,
    label: i,
  }));
  const [questionHeaderVariant, setQuestionHeaderVariant] = useState<number>(
  (provaConfig as any).questionHeaderVariant ?? 0
);

  const decoratorOptions: DotPickerOption[] = Array.from({ length: 5 }, (_, i) => ({
  value: i,
  title: `Decorador ${i}`,
  ariaLabel: `Decorador da questão ${i}`,
  label: i,
}));



  const handleContinuar = () => {
    updateProvaConfig({
      layoutType,
      columns,
      showGabarito,
      turma,
      professor,
      disciplina,
      data,
      instituicao,
      logoUrl:noLogo? null : logoUrl,
      logoPlaceholder: noLogo ? logoPlaceholder : "",
      headerLayout,
      questionHeaderVariant
    } as any);

    router.push("/editor/prova/montar");
  };

  const handleVoltar = () => {
    router.push("/editor/questoes");
  };
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

// auto-preencher com defaults do perfil (só campos vazios)
useEffect(() => {
  if (!mounted || !isLoggedIn) return;
  if (!professor && defaultProfessor) setProfessor(defaultProfessor);
  if (!disciplina && defaultDisciplina) setDisciplina(defaultDisciplina);
  if (!instituicao && defaultInstituicao) setInstituicao(defaultInstituicao);
  if (!logoUrl && defaultLogoUrl) {
    setLogoUrl(defaultLogoUrl);
    setNoLogo(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [mounted, isLoggedIn]);

if (!mounted) return null;

  return (
    <div className="min-h-screen stripe-grid-bg p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-fade-in-up">
          <Button variant="ghost" onClick={handleVoltar} className="mb-4 hover:bg-white/60">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-4xl font-bold text-slate-800">
            Configurar Prova
          </h1>
          <p className="text-slate-600 mt-2">
            Escolha o layout e preencha os dados
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-up">
          {/* Layout */}
          <div className="lg:col-span-1">
            <Card className="h-full stripe-card hover-lift">
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
                <div className="space-y-2">
                  <Label>Modelo de cabeçalho</Label>
                  <DotPicker
                    value={headerLayout}
                    options={headerOptions}
                    onChange={(v) => setHeaderLayout(v)}
                  />
                </div>
                {/* Decorador da questão */}
                <div className="space-y-2">
                  <Label>Decorador da questão</Label>
                  <DotPicker
                  value={questionHeaderVariant}
                  options={decoratorOptions}
                  onChange={setQuestionHeaderVariant}/>
                </div> 
               

                {/* Gabarito */}
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="showGabarito"
                    checked={showGabarito}
                    onCheckedChange={(v) => setShowGabarito(Boolean(v))}
                  />
                  <Label htmlFor="showGabarito">Mostrar gabaritos</Label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dados */}
          <div className="lg:col-span-2">
            <Card className="stripe-card hover-lift">
              <CardHeader>
                <CardTitle>Dados da Prova</CardTitle>
                <CardDescription>Cabeçalho</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
  <div className="flex items-center justify-between">
    <Label>Logo</Label>

    <div className="flex items-center gap-2">
      <Checkbox
        id="noLogo"
        checked={noLogo}
        onCheckedChange={(v) => {
          const checked = Boolean(v);
          setNoLogo(checked);
          if (checked) setLogoUrl(null);
        }}
      />
      <Label htmlFor="noLogo">Sem logo</Label>
    </div>
  </div>

  {!noLogo && (
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
  )}

  {noLogo && (
    <div className="space-y-2">
      <Label>Texto no lugar da logo (opcional)</Label>
      <Input
        value={logoPlaceholder}
        onChange={(e) => setLogoPlaceholder(e.target.value)}
        placeholder="Ex.: ESCOLA / SECRETARIA / etc."
      />
    </div>
  )}
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
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={handleVoltar} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleContinuar} className="flex-1 btn-primary">
                    Continuar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

{!noLogo && (
  <LogoPicker
    open={logoDialogOpen}
    onOpenChange={setLogoDialogOpen}
    onLogoSelect={(url) => {
      setLogoUrl(url);
    }}
    instituicao={instituicao}
  />
)}
    </div>
  );
}
