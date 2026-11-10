"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { useProva, type ProvaConfig } from "@/contexts/ProvaContext";
import { useAuth } from "@/contexts/AuthContext";
import ProvaMontarView from "@/components/prova/ProvaMontarView";
import { LogoPicker } from "@/components/editor/LogoPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DotPicker, type DotPickerOption } from "@/components/ui/dot-picker";
import { moverPara, numeracaoPrevista, somarPontos, trechoInicial } from "@/lib/diagramar";

type Aba = "prova" | "ordem" | "pontos";

const headerOptions: DotPickerOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  title: i === 0 ? "Cabeçalho original" : `Cabeçalho ${i}`,
  ariaLabel: `Cabeçalho ${i}`,
  label: i,
}));

const decoratorOptions: DotPickerOption[] = Array.from({ length: 5 }, (_, i) => ({
  value: i,
  title: `Decorador ${i}`,
  ariaLabel: `Decorador da questão ${i}`,
  label: i,
}));

/** Input que só grava no contexto após uma pausa na digitação (cada gravação repagina o preview). */
function CampoTexto({
  value,
  onCommit,
  type = "text",
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef<number | null>(null);

  useEffect(() => setLocal(value), [value]);

  const agendar = (v: string) => {
    setLocal(v);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onCommit(v), 400);
  };

  return (
    <Input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => agendar(e.target.value)}
      onBlur={() => {
        if (timer.current) window.clearTimeout(timer.current);
        if (local !== value) onCommit(local);
      }}
      className="h-8 text-sm"
    />
  );
}

function OpcaoBotao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
        ativo ? "border-[#FBC02D] bg-[#FBC02D] text-[#2D3436]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function AbaProva({ onAbrirLogo }: { onAbrirLogo: () => void }) {
  const { provaConfig, updateProvaConfig } = useProva();
  const set = (patch: Partial<ProvaConfig>) => updateProvaConfig(patch);
  const semLogo = !provaConfig.logoUrl;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-slate-500">Formato</Label>
        <div className="flex gap-1">
          <OpcaoBotao ativo={provaConfig.layoutType === "prova"} onClick={() => set({ layoutType: "prova" })}>Prova</OpcaoBotao>
          <OpcaoBotao ativo={provaConfig.layoutType === "exercicio"} onClick={() => set({ layoutType: "exercicio" })}>Lista</OpcaoBotao>
          <OpcaoBotao ativo={provaConfig.layoutType === "acessivel"} onClick={() => set({ layoutType: "acessivel" })}>Acessível</OpcaoBotao>
        </div>
        {provaConfig.layoutType !== "acessivel" && (
          <div className="flex gap-1">
            <OpcaoBotao ativo={Number(provaConfig.columns) === 1} onClick={() => set({ columns: 1 })}>1 coluna</OpcaoBotao>
            <OpcaoBotao ativo={Number(provaConfig.columns) === 2} onClick={() => set({ columns: 2 })}>2 colunas</OpcaoBotao>
          </div>
        )}
      </section>

      {provaConfig.layoutType !== "acessivel" && (
        <section className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-slate-500">Cabeçalho</Label>
            <DotPicker
              value={provaConfig.headerLayout ?? 0}
              options={headerOptions}
              onChange={(v) => set({ headerLayout: v as ProvaConfig["headerLayout"] })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-slate-500">Decorador da questão</Label>
            <DotPicker
              value={provaConfig.questionHeaderVariant ?? 0}
              options={decoratorOptions}
              onChange={(v) => set({ questionHeaderVariant: v as ProvaConfig["questionHeaderVariant"] })}
            />
          </div>
        </section>
      )}

      <section className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-slate-500">Dados</Label>
        <div className="space-y-1">
          <Label className="text-xs">Título</Label>
          <CampoTexto value={provaConfig.titulo ?? ""} onCommit={(v) => set({ titulo: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Instituição</Label>
          <CampoTexto value={provaConfig.instituicao ?? ""} onCommit={(v) => set({ instituicao: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Professor</Label>
            <CampoTexto value={provaConfig.professor ?? ""} onCommit={(v) => set({ professor: v })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Disciplina</Label>
            <CampoTexto value={provaConfig.disciplina ?? ""} onCommit={(v) => set({ disciplina: v })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Turma</Label>
            <CampoTexto value={provaConfig.turma ?? ""} onCommit={(v) => set({ turma: v })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data</Label>
            <CampoTexto type="date" value={provaConfig.data ?? ""} onCommit={(v) => set({ data: v })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rodapé central</Label>
          <CampoTexto
            value={provaConfig.rodapeMensagem ?? ""}
            onCommit={(v) => set({ rodapeMensagem: v })}
            placeholder='Vazio = "Tipo X" quando houver tipos'
          />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-slate-500">Logo</Label>
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="dg-sem-logo"
              checked={semLogo}
              onCheckedChange={(v) => (v ? set({ logoUrl: null }) : onAbrirLogo())}
            />
            <Label htmlFor="dg-sem-logo" className="text-xs">Sem logo</Label>
          </div>
        </div>
        {semLogo ? (
          <CampoTexto
            value={provaConfig.logoPlaceholder ?? ""}
            onCommit={(v) => set({ logoPlaceholder: v })}
            placeholder="Texto no lugar da logo (opcional)"
          />
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={onAbrirLogo}>
            Trocar logo
          </Button>
        )}
      </section>

      <section className="flex items-center gap-2">
        <Checkbox
          id="dg-gabarito"
          checked={provaConfig.showGabarito}
          onCheckedChange={(v) => set({ showGabarito: Boolean(v) })}
        />
        <Label htmlFor="dg-gabarito" className="text-sm">Incluir gabarito</Label>
      </section>
    </div>
  );
}

function LinhaOrdem({
  pos,
  total,
  numeros,
  titulo,
  trecho,
  onMover,
}: {
  pos: number;
  total: number;
  numeros: string;
  titulo: string;
  trecho: string;
  onMover: (destino: number) => void;
}) {
  const [valor, setValor] = useState(String(pos + 1));
  useEffect(() => setValor(String(pos + 1)), [pos]);

  const aplicar = () => {
    const n = parseInt(valor, 10);
    if (!Number.isFinite(n) || n - 1 === pos) {
      setValor(String(pos + 1));
      return;
    }
    onMover(n - 1);
  };

  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-2">
      <input
        type="number"
        min={1}
        max={total}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            aplicar();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        onBlur={aplicar}
        className="w-12 shrink-0 rounded border border-slate-300 px-1 py-1 text-center text-sm tabular-nums"
        aria-label="Posição"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-slate-900">{numeros}</span>
          <span className="truncate text-[11px] text-slate-500">{titulo}</span>
        </div>
        <div className="line-clamp-2 text-xs text-slate-600">{trecho || "—"}</div>
      </div>
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          disabled={pos === 0}
          onClick={() => onMover(pos - 1)}
          className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          title="Subir"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={pos === total - 1}
          onClick={() => onMover(pos + 1)}
          className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          title="Descer"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AbaOrdem() {
  const { selectedQuestions, selections, updateColumnLayout } = useProva();
  const numeracao = useMemo(() => numeracaoPrevista(selectedQuestions, selections), [selectedQuestions, selections]);

  const faixaPorPos = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const it of numeracao) m.set(it.pos, [...(m.get(it.pos) ?? []), it.numero]);
    return m;
  }, [numeracao]);

  const mover = (from: number, to: number) => {
    updateColumnLayout({ coluna1: moverPara(selectedQuestions, from, to), coluna2: [] });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Digite a nova posição e tecle Enter. As outras deslizam. Questões que compartilham texto base
        ficam juntas na prova, mesmo se separadas aqui.
      </p>
      {selectedQuestions.map((q, pos) => {
        const nums = faixaPorPos.get(pos) ?? [];
        const numeros = nums.length > 1 ? `Q${nums[0]}–${nums[nums.length - 1]}` : `Q${nums[0] ?? "?"}`;
        const meta = q.metadata ?? {};
        const titulo = [meta.disciplina, meta.assunto].filter(Boolean).join(" · ");
        return (
          <LinhaOrdem
            key={meta.id ?? pos}
            pos={pos}
            total={selectedQuestions.length}
            numeros={numeros}
            titulo={titulo}
            trecho={trechoInicial(q.content)}
            onMover={(destino) => mover(pos, destino)}
          />
        );
      })}
    </div>
  );
}

function AbaPontos() {
  const { selectedQuestions, selections, provaConfig, updateProvaConfig } = useProva();
  const numeracao = useMemo(() => numeracaoPrevista(selectedQuestions, selections), [selectedQuestions, selections]);
  const pontuacoes = provaConfig.pontuacoes ?? {};
  const preenchidos = numeracao.map((it) => pontuacoes[it.key]).filter((v): v is string => !!v);
  const total = preenchidos.length > 0 ? somarPontos(preenchidos) : null;

  const gravar = (key: string, texto: string) => {
    const atual = provaConfig.pontuacoes ?? {};
    const valor = texto.trim();
    if ((atual[key] ?? "") === valor) return;
    const next = { ...atual };
    if (valor) next[key] = valor;
    else delete next[key];
    updateProvaConfig({ pontuacoes: next });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Texto livre (ex.: &quot;1,5&quot; ou &quot;2 pts&quot;). Também dá pra digitar direto na caixa ao lado do número da questão no preview.
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {numeracao.map((it) => (
          <div key={it.key} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">Q{it.numero}</span>
            <CampoTexto value={pontuacoes[it.key] ?? ""} onCommit={(v) => gravar(it.key, v)} />
          </div>
        ))}
      </div>
      {preenchidos.length > 0 && (
        <div className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {total !== null ? (
            <>Total: <strong className="tabular-nums">{String(total).replace(".", ",")}</strong></>
          ) : (
            "Total indisponível (há pontuação sem número)"
          )}
          <span className="ml-2 text-xs text-slate-500">
            {preenchidos.length}/{numeracao.length} preenchidas
          </span>
        </div>
      )}
    </div>
  );
}

export default function DiagramarProvaPage() {
  const router = useRouter();
  const { provaConfig, updateProvaConfig, selectedQuestions } = useProva();
  const { isLoggedIn, defaultProfessor, defaultDisciplina, defaultInstituicao, defaultLogoUrl } = useAuth();
  const [aba, setAba] = useState<Aba>("prova");
  const [logoOpen, setLogoOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Trilha diagramar: ordem travada e numeração previsível também no /montar
  useEffect(() => {
    if (!provaConfig.numeracaoFixa) updateProvaConfig({ numeracaoFixa: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mesmo auto-preenchimento do selecionar-layout (só campos vazios)
  useEffect(() => {
    if (!mounted || !isLoggedIn) return;
    const patch: Partial<ProvaConfig> = {};
    if (!provaConfig.professor && defaultProfessor) patch.professor = defaultProfessor;
    if (!provaConfig.disciplina && defaultDisciplina) patch.disciplina = defaultDisciplina;
    if (!provaConfig.instituicao && defaultInstituicao) patch.instituicao = defaultInstituicao;
    if (!provaConfig.logoUrl && !provaConfig.logoPlaceholder && defaultLogoUrl) patch.logoUrl = defaultLogoUrl;
    if (Object.keys(patch).length > 0) updateProvaConfig(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isLoggedIn]);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="print:hidden fixed inset-y-0 left-0 z-40 flex w-[380px] flex-col border-r border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => router.push("/editor/questoes?from=montar")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Questões
          </Button>
          <span className="text-sm font-semibold text-slate-800">Diagramar</span>
          <Button size="sm" className="btn-primary" onClick={() => router.push("/editor/prova/montar")}>
            Montar
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-1 border-b border-slate-200 bg-white px-3 py-2">
          <OpcaoBotao ativo={aba === "prova"} onClick={() => setAba("prova")}>Prova</OpcaoBotao>
          <OpcaoBotao ativo={aba === "ordem"} onClick={() => setAba("ordem")}>Ordem ({selectedQuestions.length})</OpcaoBotao>
          <OpcaoBotao ativo={aba === "pontos"} onClick={() => setAba("pontos")}>Pontuação</OpcaoBotao>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {aba === "prova" ? (
            <AbaProva onAbrirLogo={() => setLogoOpen(true)} />
          ) : aba === "ordem" ? (
            <AbaOrdem />
          ) : (
            <AbaPontos />
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 pl-[380px] print:pl-0">
        <ProvaMontarView variant="diagramar" />
      </main>

      <LogoPicker
        open={logoOpen}
        onOpenChange={setLogoOpen}
        onLogoSelect={(url) => updateProvaConfig({ logoUrl: url })}
        instituicao={provaConfig.instituicao}
      />
    </div>
  );
}
