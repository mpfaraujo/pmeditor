"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { schema } from "@/components/editor/schema";
import { QuestionEditor } from "@/components/editor/QuestionEditor";
import {
  parseQuestionFromLatexText,
  buildQuestionNodeLatex,
  extractLatexAnswerKey,
} from "@/components/editor/plugins/smartPastePlugin";
import { normalizeGabaritoForTipo, type QuestionMetadataV1 } from "@/components/editor/QuestionMetaBar";
import { ChevronLeft, ChevronRight, SkipForward, FileText } from "lucide-react";

type ImportItem = {
  latex: string;
  tipo: "Múltipla Escolha" | "Discursiva";
  gabarito: string | null;
};

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

function buildInitial(
  item: ImportItem,
  batch: BatchConfig,
  author?: { id?: string; name?: string },
): { metadata: QuestionMetadataV1; content: any } {
  const parsed = parseQuestionFromLatexText(item.latex);

  let content: any;
  if (parsed) {
    const node = buildQuestionNodeLatex(schema, parsed);
    content = { type: "doc", content: [node.toJSON()] };
  } else {
    content = {
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
  }

  const now = new Date().toISOString();
  const rawKey = parsed ? extractLatexAnswerKey(parsed) : null;
  const gabarito = rawKey
    ? { kind: "mcq" as const, correct: rawKey.correct as "A" | "B" | "C" | "D" | "E" }
    : item.gabarito
      ? { kind: "mcq" as const, correct: item.gabarito as "A" | "B" | "C" | "D" | "E" }
      : null;

  const metadata: QuestionMetadataV1 = {
    schemaVersion: 1,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    tipo: item.tipo,
    disciplina: "Matemática",
    assunto: batch.assunto || undefined,
    dificuldade: batch.dificuldade,
    gabarito: gabarito ?? normalizeGabaritoForTipo(item.tipo as any),
    tags: batch.tags.length ? [...batch.tags] : [],
    source: batch.source,
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
          <input
            type="text"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Ex: Álgebra Linear, Trigonometria..."
            className="w-full border rounded px-3 py-2"
            autoFocus
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
  const [queue, setQueue] = useState<ImportItem[]>([]);
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
      .then((data: ImportItem[]) => {
        setQueue(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Acesso restrito</h1>
          <p className="text-gray-600">Essa página é exclusiva para administradores.</p>
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
          <button
            onClick={() => { setCurrentIdx(0); setEditorKey((k) => k + 1); }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Recomeçar
          </button>
        </div>
      </div>
    );
  }

  // Etapa 3: editor
  const item = queue[currentIdx];
  const author = user ? { id: user.googleId, name: user.nome } : undefined;
  const initial = buildInitial(item, batchConfig, author);

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
          <h1 className="text-lg font-bold whitespace-nowrap">Importar Questões</h1>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Questão {currentIdx + 1} de {queue.length}
            </span>

            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
              {item.tipo}
            </span>

            {item.gabarito && (
              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                Gab: {item.gabarito}
              </span>
            )}

            {batchConfig.assunto && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                {batchConfig.assunto}
              </span>
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
              {item.latex}
            </pre>
          </div>
        )}
      </div>

      {/* Editor */}
      <QuestionEditor
        key={editorKey}
        initial={initial}
        onSaved={handleNext}
      />
    </div>
  );
}
