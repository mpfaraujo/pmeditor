"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { schema } from "@/components/editor/schema";
import { QuestionEditor } from "@/components/editor/QuestionEditor";
import {
  parseQuestionFromLatexText,
  buildQuestionNodeLatex,
  extractLatexAnswerKey,
} from "@/components/editor/plugins/smartPastePlugin";
import { normalizeGabaritoForTipo, type QuestionMetadataV1 } from "@/components/editor/QuestionMetaBar";
import { ChevronLeft, ChevronRight, SkipForward, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AssuntoCombobox } from "@/components/editor/AssuntoCombobox";

type YamlMeta = {
  tipo?: string;
  dificuldade?: string;
  disciplina?: string;
  assunto?: string;
  gabarito?: string;
  resposta?: string;
  tags?: string[];
  fonte?: string;
  concurso?: string;
  banca?: string;
  ano?: number;
  numero?: string;
  cargo?: string;
  prova?: string;
};

type ImportItem = {
  latex: string;
  tipo: "Múltipla Escolha" | "Discursiva";
  gabarito: string | null;
  meta?: YamlMeta;
};

type ImportSetItem = {
  isSet: true;
  baseLatex: string;
  items: Array<{
    latex: string;
    tipo: "Múltipla Escolha" | "Discursiva";
    gabarito: string | null;
    meta?: Pick<YamlMeta, "assunto" | "tags" | "gabarito" | "resposta">;
  }>;
  sharedMeta?: YamlMeta;
};

type QueueEntry = ImportItem | ImportSetItem;

/** Configuração aplicada a todas as questões do lote */
type BatchConfig = {
  assunto: string;
  dificuldade: "Fácil" | "Média" | "Difícil";
  tags: string[];
  source: {
    kind: "original" | "concurso";
    concurso?: string;
    banca?: string;
    ano?: number;
    cargo?: string;
  };
};

function newId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Cria um doc ProseMirror mínimo com um parágrafo de texto puro */
function makeTextDoc(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function buildInitial(
  item: ImportItem,
  batch: BatchConfig,
  author?: { id?: string; name?: string },
): { metadata: QuestionMetadataV1; content: any } {
  const fallbackContent = {
    type: "doc",
    content: [
      {
        type: "question",
        content: [
          {
            type: "statement",
            content: [{ type: "paragraph", content: [{ type: "text", text: item.latex }] }],
          },
        ],
      },
    ],
  };

  let parsed;
  try {
    const t0 = performance.now();
    parsed = parseQuestionFromLatexText(item.latex);
    const t1 = performance.now();
    console.log("[importar] parse ms =", (t1 - t0).toFixed(1), "tipo =", JSON.stringify(item.tipo));
  } catch (e) {
    console.error("[importar] parseQuestionFromLatexText FAILED", e);
    parsed = null;
  }

  let content: any;
  if (parsed) {
    try {
      const node = buildQuestionNodeLatex(schema, parsed);
      content = { type: "doc", content: [node.toJSON()] };
    } catch (e) {
      console.error("[importar] buildQuestionNodeLatex FAILED", e);
      content = fallbackContent;
    }
  } else {
    content = fallbackContent;
  }

  const now = new Date().toISOString();

  // YAML por questão sobrescreve batchConfig quando disponível
  const m = item.meta;

  const rawKey = parsed ? extractLatexAnswerKey(parsed) : null;
  let gabarito: any;
  if (item.tipo === "Múltipla Escolha") {
    const letter = rawKey?.correct ?? item.gabarito;
    gabarito = letter
      ? { kind: "mcq" as const, correct: letter as "A" | "B" | "C" | "D" | "E" }
      : null;
  } else {
    // Discursiva: usa campo resposta: do YAML se disponível
    gabarito = m?.resposta?.trim()
      ? { kind: "essay" as const, rubric: makeTextDoc(m.resposta.trim()) }
      : null;
  }

  const VALID_DIFICULDADES = ["Fácil", "Média", "Difícil"] as const;
  const dificuldade = (
    m?.dificuldade && VALID_DIFICULDADES.find(d => d.toLowerCase() === m.dificuldade!.toLowerCase())
  ) || batch.dificuldade;

  const source = m?.concurso || m?.banca || m?.ano || m?.fonte
    ? {
        kind: (m.fonte === "concurso" ? "concurso" : "original") as "original" | "concurso",
        concurso: m.concurso || batch.source.concurso,
        banca: m.banca || batch.source.banca,
        ano: m.ano || batch.source.ano,
        cargo: m.cargo || batch.source.cargo,
        numero: m.numero || undefined,
        prova: m.prova || undefined,
      }
    : { ...batch.source };

  const tags = m?.tags?.length ? [...m.tags] : batch.tags.length ? [...batch.tags] : [];

  const metadata: QuestionMetadataV1 = {
    schemaVersion: 1,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    tipo: item.tipo,
    disciplina: m?.disciplina || "Matemática",
    assunto: m?.assunto || batch.assunto || undefined,
    dificuldade,
    gabarito: gabarito ?? normalizeGabaritoForTipo(item.tipo as any),
    tags,
    source,
    author,
  };

  return { metadata, content };
}

/** Extrai o nó statement de um texto/LaTeX usando o parser existente */
function parseToStatementNode(text: string) {
  try {
    const parsed = parseQuestionFromLatexText("\\question " + text);
    if (parsed) {
      const questionNode = buildQuestionNodeLatex(schema, parsed);
      // firstChild de question é o statement
      const stmt = questionNode.firstChild;
      if (stmt && stmt.type === schema.nodes.statement) return stmt;
    }
  } catch {
    // fallback
  }
  // Fallback: statement com um parágrafo de texto puro
  return schema.nodes.statement.create(null, [
    schema.nodes.paragraph.create(null, text.trim() ? [schema.text(text.trim())] : []),
  ]);
}

function buildInitialSet(
  item: ImportSetItem,
  batch: BatchConfig,
  author?: { id?: string; name?: string },
): { metadata: any; content: any } {
  const now = new Date().toISOString();
  const m = item.sharedMeta;

  const VALID_DIFICULDADES = ["Fácil", "Média", "Difícil"] as const;
  const dificuldade = (
    m?.dificuldade && VALID_DIFICULDADES.find(d => d.toLowerCase() === m.dificuldade!.toLowerCase())
  ) || batch.dificuldade;

  const source = m?.concurso || m?.banca || m?.ano || m?.fonte
    ? {
        kind: (m!.fonte === "concurso" ? "concurso" : "original") as "original" | "concurso",
        concurso: m!.concurso || batch.source.concurso,
        banca: m!.banca || batch.source.banca,
        ano: m!.ano || batch.source.ano,
        cargo: m!.cargo || batch.source.cargo,
        numero: m!.numero || undefined,
        prova: m!.prova || undefined,
      }
    : { ...batch.source };

  const sharedTipo = m?.tipo ?? "Discursiva";

  // Monta nó base_text com conteúdo real
  const baseStmt = parseToStatementNode(item.baseLatex);
  const baseTextNode = schema.nodes.base_text.create(null, baseStmt.content);

  // Monta question_item nodes usando a API do ProseMirror (garante schema válido)
  const questionItemNodes = item.items.map((it) => {
    const answerKey = it.gabarito && it.tipo === "Múltipla Escolha"
      ? { kind: "mcq", correct: it.gabarito }
      : it.meta?.resposta?.trim()
        ? { kind: "essay", rubric: makeTextDoc(it.meta.resposta.trim()) }
        : { kind: "essay" };

    const stmtNode = parseToStatementNode(it.latex);
    return schema.nodes.question_item.create({
      answerKey,
      assunto: it.meta?.assunto ?? null,
      tags: it.meta?.tags ?? null,
    }, [stmtNode]);
  });

  // Constrói o doc via API do ProseMirror para garantir validade do schema
  // mode: null → discursiva com partes a/b/c (isEssaySet = true no renderer)
  // mode: "set" → MCQ com texto-base (isEssaySet = false, mostra banner "use o texto...")
  const hasChoices = item.items.some(it => it.tipo === "Múltipla Escolha");
  const setNode = schema.nodes.set_questions.create({ mode: hasChoices ? "set" : null }, [baseTextNode, ...questionItemNodes]);
  const doc = schema.nodes.doc.create(null, [setNode]);
  const content = doc.toJSON();

  // Assunto: usa sharedMeta.assunto ou o assunto do primeiro item
  const assunto = m?.assunto || item.items[0]?.meta?.assunto || batch.assunto || undefined;

  // Tags: mescla todas as tags dos itens (sem duplicatas), com fallback para sharedMeta ou batch
  const allItemTags = item.items.flatMap(it => it.meta?.tags ?? []);
  const mergedTags = m?.tags?.length
    ? [...m.tags]
    : allItemTags.length
    ? [...new Set(allItemTags)]
    : batch.tags.length
    ? [...batch.tags]
    : [];

  const metadata = {
    schemaVersion: 1,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    tipo: sharedTipo,
    disciplina: m?.disciplina || batch.assunto || "Matemática",
    dificuldade,
    assunto,
    gabarito: null,
    tags: mergedTags,
    source,
    author,
  };

  return { metadata, content };
}

/* ======================== Tela de config do lote ======================== */

function BatchConfigForm({
  onStart,
}: {
  onStart: (cfg: BatchConfig) => void;
}) {
  const [assunto, setAssunto] = useState("");
  const [dificuldade, setDificuldade] = useState<BatchConfig["dificuldade"]>("Média");
  const [tagsStr, setTagsStr] = useState("");
  const [sourceKind, setSourceKind] = useState<"original" | "concurso">("original");
  const [concurso, setConcurso] = useState("");
  const [banca, setBanca] = useState("");
  const [ano, setAno] = useState("");
  const [cargo, setCargo] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    onStart({
      assunto,
      dificuldade,
      tags,
      source:
        sourceKind === "concurso"
          ? {
              kind: "concurso",
              concurso: concurso || undefined,
              banca: banca || undefined,
              ano: ano ? Number(ano) : undefined,
              cargo: cargo || undefined,
            }
          : { kind: "original" },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow w-full max-w-md space-y-4"
      >
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin/gerenciar" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Gerenciar
          </Link>
        </div>
        <h1 className="text-xl font-bold">Configurar importação</h1>
        <p className="text-sm text-gray-500">
          Esses dados serão aplicados a todas as questões do lote.
          Você pode ajustar individualmente no editor.
        </p>

        {/* Disciplina fixa */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Disciplina</label>
          <input
            type="text"
            value="Matemática"
            disabled
            className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-500"
          />
        </div>

        {/* Assunto */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
          <AssuntoCombobox
            value={assunto}
            onChange={setAssunto}
            placeholder="Ex: Álgebra Linear, Trigonometria..."
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* Dificuldade */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dificuldade</label>
          <select
            value={dificuldade}
            onChange={(e) => setDificuldade(e.target.value as BatchConfig["dificuldade"])}
            className="w-full border rounded px-3 py-2"
          >
            <option value="Fácil">Fácil</option>
            <option value="Média">Média</option>
            <option value="Difícil">Difícil</option>
          </select>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags (separadas por vírgula)</label>
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="Ex: ENEM, 2024"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* Fonte */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fonte</label>
          <select
            value={sourceKind}
            onChange={(e) => setSourceKind(e.target.value as "original" | "concurso")}
            className="w-full border rounded px-3 py-2"
          >
            <option value="original">Original</option>
            <option value="concurso">Concurso</option>
          </select>
        </div>

        {sourceKind === "concurso" && (
          <div className="space-y-3 pl-3 border-l-2 border-blue-200">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Concurso</label>
              <input
                type="text"
                value={concurso}
                onChange={(e) => setConcurso(e.target.value)}
                placeholder="Ex: ENEM"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Banca</label>
              <input
                type="text"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="Ex: INEP"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Ano</label>
                <input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                  placeholder="2024"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Cargo/Tipo</label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Tipo 1"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          Começar importação
        </button>
      </form>
    </div>
  );
}

/* ======================== Página principal ======================== */

export default function ImportarPage() {
  const { isAdmin, user } = useAuth();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchConfig, setBatchConfig] = useState<BatchConfig | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [editorKey, setEditorKey] = useState(0);
  const [showLatex, setShowLatex] = useState(false);

  useEffect(() => {
    fetch("/data/import-queue.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: QueueEntry[]) => {
        setQueue(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // useMemo ANTES de qualquer return condicional (Rules of Hooks)
  const item = queue.length > 0 && currentIdx < queue.length ? queue[currentIdx] : null;
  const initial = useMemo(() => {
    if (!item || !batchConfig) return null;
    const author = user ? { id: user.googleId, name: user.nome } : undefined;
    if ("isSet" in item && item.isSet) {
      return buildInitialSet(item, batchConfig, author);
    }
    return buildInitial(item as ImportItem, batchConfig, author);
  }, [item, batchConfig, user]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Acesso restrito</h1>
          <p className="text-gray-600">Essa página é exclusiva para administradores.</p>
          <Link href="/minha-area" className="mt-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Minha Área
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Carregando fila de importação...</p>
      </div>
    );
  }

  if (error || !queue.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <h1 className="text-xl font-bold mb-2">Importar Questões</h1>
          <p className="text-gray-600">
            {error
              ? `Erro ao carregar: ${error}`
              : "Nenhuma questão na fila. Execute o script parse-tex.ts primeiro."}
          </p>
          <pre className="mt-4 text-xs text-left bg-gray-50 p-3 rounded">
            pnpm tsx scripts/parse-tex.ts arquivo.tex
          </pre>
          <Link href="/admin/gerenciar" className="mt-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Gerenciar
          </Link>
        </div>
      </div>
    );
  }

  // Etapa 1: config do lote
  if (!batchConfig) {
    return <BatchConfigForm onStart={setBatchConfig} />;
  }

  // Etapa 2: fila terminada
  if (currentIdx >= queue.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <h1 className="text-xl font-bold text-green-600 mb-2">Importação concluída!</h1>
          <p className="text-gray-600">
            Todas as {queue.length} questões foram processadas.
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              onClick={() => { setCurrentIdx(0); setEditorKey((k) => k + 1); }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Recomeçar
            </button>
            <Link href="/admin/gerenciar" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Gerenciar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Etapa 3: editor
  const handleNext = () => {
    setCurrentIdx((i) => i + 1);
    setEditorKey((k) => k + 1);
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1);
      setEditorKey((k) => k + 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#d3d3d3]">
      {/* Header de navegação */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-[210mm] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/gerenciar" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-bold whitespace-nowrap">Importar Questões</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Questão {currentIdx + 1} de {queue.length}
            </span>

            {"isSet" in item! && item!.isSet ? (
              <>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  Conjunto ({(item as ImportSetItem).items.length} itens)
                </span>
                {(item as ImportSetItem).sharedMeta?.numero && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    #{(item as ImportSetItem).sharedMeta!.numero}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  {(item as ImportItem).tipo}
                </span>
                {(item as ImportItem).gabarito && (
                  <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                    Gab: {(item as ImportItem).gabarito}
                  </span>
                )}
                {((item as ImportItem).meta?.assunto || batchConfig.assunto) && (
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                    {(item as ImportItem).meta?.assunto || batchConfig.assunto}
                  </span>
                )}
                {(item as ImportItem).meta?.numero && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    #{(item as ImportItem).meta!.numero}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowLatex((s) => !s)}
              className="p-2 rounded hover:bg-gray-100 text-gray-500"
              title="Ver LaTeX bruto"
            >
              <FileText size={18} />
            </button>

            <button
              onClick={handlePrev}
              disabled={currentIdx === 0}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
              title="Anterior"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              onClick={handleNext}
              className="p-2 rounded hover:bg-gray-100 text-orange-600"
              title="Pular"
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={handleNext}
              disabled={currentIdx >= queue.length}
              className="p-2 rounded hover:bg-gray-100"
              title="Próxima"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* LaTeX bruto colapsável */}
        {showLatex && (
          <div className="max-w-[210mm] mx-auto px-4 pb-3">
            <pre className="text-xs bg-gray-50 border rounded p-3 max-h-48 overflow-auto whitespace-pre-wrap">
              {"isSet" in item! && item!.isSet
                ? `[base]\n${(item as ImportSetItem).baseLatex}\n\n` +
                  (item as ImportSetItem).items.map((it, i) => `[item ${i + 1}]\n${it.latex}`).join("\n\n")
                : (item as ImportItem).latex}
            </pre>
          </div>
        )}
      </div>

      {/* Editor */}
      <QuestionEditor
        key={editorKey}
        initial={initial!}
        onSaved={handleNext}
      />
    </div>
  );
}
