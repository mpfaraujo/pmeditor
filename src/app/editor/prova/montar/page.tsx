// src/app/editor/prova/montar/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useProva } from "@/contexts/ProvaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import QuestionRenderer from "@/components/Questions/QuestionRendererProva";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Printer,
  ListOrdered,
  Settings,
  CheckSquare,
  Square,
  Save,
  RefreshCw,
} from "lucide-react";
import { LogoPicker } from "@/components/editor/LogoPicker";
import { ReorderModal } from "@/components/prova/ReorderModal";
import { SalvarProvaDialog } from "@/components/prova/SalvarProvaDialog";
import QuestionHeaderSvg from "@/components/prova/QuestaoHeaderSvg";
import PaginatedA4 from "@/components/prova/PaginatedA4";
import { usePagination } from "@/hooks/usePagination";
import { ProvaLayout } from "@/components/prova/layouts/ProvaLayout";
import { ExerciseLayout } from "@/components/prova/layouts/ExerciseLayout";
import { QuestionData, ColumnLayout } from "@/types/layout";
import Gabarito from "@/components/prova/Gabarito";
import GabaritoDiscursivoPages from "@/components/prova/GabaritoDiscursivoPages";
import {
  gerarTiposDeProva,
  aplicarPermutacaoGabarito,
  hashQuestionId,
  type ProvaTypeConfig,
  type Alt as AltGera,
} from "@/lib/GeraTiposDeProva";

import "./prova.css";

const PAGE_HEIGHT = 1183;
const SAFETY_PX = 100;

type Alt = "A" | "B" | "C" | "D" | "E";

function parseAlt(x: unknown): Alt | null {
  const s = (x ?? "").toString().trim().toUpperCase();
  if (s === "A" || s === "B" || s === "C" || s === "D" || s === "E") return s;
  return null;
}

function extractAltFromMetadata(meta: any): Alt | null {
  if (!meta) return null;

  const g = meta.gabarito;

  if (g && typeof g === "object") {
    const kind = (g.kind ?? "").toString();
    if (kind === "mcq") return parseAlt(g.correct);
    if (kind === "tf") return parseAlt(g.correct);
    if (kind === "essay") return null;
  }

  const direct = parseAlt(g);
  if (direct) return direct;

  const nested = parseAlt(g?.letra ?? g?.answer ?? g?.value ?? g?.correct);
  if (nested) return nested;

  return null;
}

function extractEssayRubric(meta: any): any | null {
  if (!meta) return null;
  const g = meta.gabarito;
  if (!g || typeof g !== "object") return null;
  if (g.kind !== "essay") return null;
  if (!g.rubric || typeof g.rubric !== "object" || g.rubric.type !== "doc") return null;
  return g.rubric;
}

/** Extrai rubrics dos question_items dentro do conteúdo de um set_questions */
function extractItemRubrics(content: any): any[] {
  try {
    const doc = typeof content === "string" ? JSON.parse(content) : content;
    if (!doc || doc.type !== "doc") return [];
    const setNode = doc.content?.find((n: any) => n?.type === "set_questions");
    if (!setNode) return [];
    const items = (setNode.content ?? []).filter((n: any) => n?.type === "question_item");
    const rubrics: any[] = [];
    for (const item of items) {
      const ak = item.attrs?.answerKey;
      if (ak && ak.kind === "essay" && ak.rubric && typeof ak.rubric === "object" && ak.rubric.type === "doc") {
        rubrics.push(ak.rubric);
      }
    }
    return rubrics;
  } catch {
    return [];
  }
}

type PMNode = {
  type: string;
  attrs?: any;
  content?: PMNode[];
  text?: string;
  marks?: any[];
};

function safeParseDoc(content: any): PMNode | null {
  try {
    const doc = typeof content === "string" ? JSON.parse(content) : content;
    if (!doc || typeof doc !== "object") return null;
    if (doc.type !== "doc") return null;
    return doc as PMNode;
  } catch {
    return null;
  }
}

function findSetNode(doc: PMNode | null): PMNode | null {
  return doc?.content?.find((n) => n?.type === "set_questions") ?? null;
}

function splitSetNode(setNode: PMNode | null): {
  baseText: PMNode | null;
  items: PMNode[];
} {
  const content = setNode?.content ?? [];
  const baseText = content.find((n) => n?.type === "base_text") ?? null;
  const items = content.filter((n) => n?.type === "question_item");
  return { baseText, items };
}

function wrapAsQuestionDoc(nodes: PMNode[]): PMNode {
  return {
    type: "doc",
    content: [
      {
        type: "question",
        content: nodes,
      },
    ],
  };
}

function buildBaseDoc(baseText: PMNode | null): PMNode | null {
  if (!baseText) return null;
  return wrapAsQuestionDoc([baseText]);
}

function buildItemDoc(item: PMNode | null): PMNode | null {
  if (!item) return null;

  const nodes: PMNode[] = [];
  (item.content ?? []).forEach((n) => {
    if (n.type === "statement" || n.type === "options") nodes.push(n);
  });

  if (nodes.length === 0) return null;
  return wrapAsQuestionDoc(nodes);
}

export default function MontarProvaPage() {

  const router = useRouter();
  const { user } = useAuth();
  const {
    selectedQuestions: initialQuestions,
    selections,
    setSetSelection,
    updateColumnLayout,
    provaConfig,
    updateProvaConfig,
  } = useProva();
  const columns = (Number(provaConfig.columns) === 2 ? 2 : 1) as 1 | 2;

  // Lista linear de questões (sem divisão coluna1/coluna2)
  const [orderedList, setOrderedList] = useState<QuestionData[]>(() => {
    return [...initialQuestions];
  });

  // Flag: professor reordenou manualmente → desativa bin-packing
  const [manualOrder, setManualOrder] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(provaConfig.logoUrl);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [salvarDialogOpen, setSalvarDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Estados para tipos de prova
  const [numTipos, setNumTipos] = useState<number>(2);
  const [tiposGerados, setTiposGerados] = useState<ProvaTypeConfig[] | null>(null);
  const [tipoAtual, setTipoAtual] = useState<number>(1);

  // Spacers arrastáveis entre questões
  // spacers: visual em tempo real (pointermove)
  // committedSpacers: dispara re-paginação (pointerup)
  const [spacers, setSpacers] = useState<Map<string, number>>(new Map());
  const [committedSpacers, setCommittedSpacers] = useState<Map<string, number>>(new Map());

  const handleSpacerChange = (key: string, h: number) =>
    setSpacers(prev => new Map(prev).set(key, h));

  const handleSpacerCommit = (key: string, h: number) =>
    setCommittedSpacers(prev => new Map(prev).set(key, h));

  // Serializar committedSpacers para dependências do usePagination
  const committedSpacersKey = useMemo(() =>
    JSON.stringify([...committedSpacers.entries()].sort()),
    [committedSpacers]
  );

  // Larguras de imagens comprometidas (dispara re-paginação no pointerup)
  const [committedImageWidths, setCommittedImageWidths] = useState<Record<string, number>>({});

  const handleImageResizeCommit = (id: string, width: number) =>
    setCommittedImageWidths(prev => ({ ...prev, [id]: width }));

  const committedImageWidthsKey = useMemo(() =>
    JSON.stringify(committedImageWidths),
    [committedImageWidths]
  );

  // Versão manual de re-paginação (imagem resize não re-pagina automaticamente)
  const [repaginateVersion, setRepaginateVersion] = useState(0);

  // Questões com opções em linha (oneparchoices)
  const [inlineOptionsSet, setInlineOptionsSet] = useState<Set<string>>(new Set());

  const handleToggleInlineOptions = (id: string) =>
    setInlineOptionsSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ReorderModal: professor aplicou ordem manual
  const handleReorderApply = (reordered: QuestionData[]) => {
    setOrderedList(reordered);
    setManualOrder(true);
    // Mantém compatibilidade com updateColumnLayout do contexto
    updateColumnLayout({
      coluna1: reordered,
      coluna2: [],
    });
  };

  // ReorderModal: professor resetou → volta pro algoritmo
  const handleReorderReset = () => {
    setOrderedList([...initialQuestions]);
    setManualOrder(false);
    updateColumnLayout({
      coluna1: initialQuestions,
      coluna2: [],
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEditarConfiguracao = () => {
    router.push("/editor/prova/selecionar-layout");
  };

  // Handlers de tipos de prova
  const handleGerarTipos = () => {
    // Usa hash do googleId do usuário como seed base
    // Visitantes (não logados) usam seed 0
    const userSeed = user?.googleId ? hashQuestionId(user.googleId) : 0;

    const tipos = gerarTiposDeProva(orderedList, numTipos, userSeed);
    setTiposGerados(tipos);
    setTipoAtual(1);
  };

  const handleReiniciarTipos = () => {
    setTiposGerados(null);
    setTipoAtual(1);
  };

  // orderedQuestions agora vem da lista linear
  const orderedQuestions = useMemo(() => {
    return [...orderedList];
  }, [orderedList]);


  const expandedQuestions = useMemo(() => {
    const out: any[] = [];

    for (const q of orderedQuestions as any[]) {
      const id = q?.metadata?.id;
      if (!id) continue;

      const sel = selections.find((s) => s.id === id);

      if (!sel || sel.kind === "question") {
        out.push(q);
        continue;
      }

      const doc = safeParseDoc(q.content);
      const setNode = findSetNode(doc);
      const { baseText, items } = splitSetNode(setNode);

      const isEssaySet =
        (setNode as any)?.attrs?.mode === "essay" ||
        !items.some((it) => (it.content ?? []).some((n) => n?.type === "options"));

      if (isEssaySet) {
        out.push(q);
        continue;
      }

      const baseDoc = buildBaseDoc(baseText);
      const selectedIdxs = Array.isArray(sel.itemIndexes) ? sel.itemIndexes : [];
      const validIdxs = selectedIdxs
        .filter((n) => Number.isInteger(n) && n >= 0 && n < items.length)
        .sort((a, b) => a - b);

      if (validIdxs.length < 2) {
        out.push(q);
        continue;
      }

      const headerText = `Use o texto a seguir para responder às próximas ${validIdxs.length} questões.`;

      // ✅ item sintético do texto base (fragmentável)
      if (baseDoc) {
        out.push({
          ...q,
          metadata: {
            ...(q.metadata ?? {}),
            id: `${id}#base`,
            // sem gabarito
          },
          content: baseDoc,
          __setBase: {
            parentId: id,
            headerText,
          },
        });
      }

      // itens do conjunto viram questões normais (sem carregar o base junto)
      validIdxs.forEach((itemIdx) => {
        const itemNode = items[itemIdx] ?? null;
        const itemDoc = buildItemDoc(itemNode);

        if (!itemDoc) return;

        const itemMetaGabarito =
          itemNode?.attrs?.gabarito ??
          itemNode?.attrs?.answerKey ??
          itemNode?.attrs?.correct ??
          undefined;

        const synthetic = {
          ...q,
          metadata: {
            ...(q.metadata ?? {}),
            id: `${id}#${itemIdx + 1}`,
            ...(itemMetaGabarito ? { gabarito: itemMetaGabarito } : null),
          },
          content: itemDoc,
          __set: {
            parentId: id,
          },
        };

        out.push(synthetic);
      });
    }

    return out as QuestionData[];
  }, [orderedQuestions, selections]);

  // Reset dos spacers ao mudar o conjunto de questões (IDs mudam → spacers zerados)
  const expandedQuestionsKey = useMemo(() =>
    expandedQuestions.map((q: any) => q.metadata?.id ?? "").join(","),
    [expandedQuestions]
  );
  useEffect(() => {
    setSpacers(new Map());
    setCommittedSpacers(new Map());
    setCommittedImageWidths({});
    setInlineOptionsSet(new Set());
  }, [expandedQuestionsKey]);

  // Monta grupos explícitos de set (base + itens) pelo parentId
  const setGroups = useMemo(() => {
    const baseMap = new Map<string, number>(); // parentId → baseIndex
    const itemMap = new Map<string, number[]>(); // parentId → itemIndexes[]

    expandedQuestions.forEach((q: any, i) => {
      const baseInfo = (q as any)?.__setBase;
      if (baseInfo?.parentId) {
        baseMap.set(baseInfo.parentId, i);
        if (!itemMap.has(baseInfo.parentId)) itemMap.set(baseInfo.parentId, []);
      }
      const setInfo = (q as any)?.__set;
      if (setInfo?.parentId) {
        const arr = itemMap.get(setInfo.parentId) ?? [];
        arr.push(i);
        itemMap.set(setInfo.parentId, arr);
      }
    });

    const groups: { baseIndex: number; itemIndexes: number[] }[] = [];
    for (const [parentId, baseIndex] of baseMap) {
      groups.push({ baseIndex, itemIndexes: itemMap.get(parentId) ?? [] });
    }
    return groups;
  }, [expandedQuestions]);

const { pages, refs } = usePagination({
  config: {
    pageHeight: PAGE_HEIGHT,
    safetyMargin: SAFETY_PX,
    columns,
    optimizeLayout: !manualOrder,
    setGroups,
    spacers: committedSpacers,
  },
  questionCount: expandedQuestions.length,
  dependencies: [
    expandedQuestions,
    logoUrl,
    columns,
    provaConfig.layoutType,
    (provaConfig as any).headerLayout,
    (provaConfig as any).questionHeaderVariant,
    manualOrder,
    setGroups,
    committedSpacersKey,
    repaginateVersion,
  ],
});

  // Mapa: índice original (q) → número impresso (1-based, ignorando setBase)
  // Baseado na ordem real de aparição nos pages (após bin-packing)
  const printNumberMap = useMemo(() => {
    const map = new Map<number, number>();
    let counter = 0;

    for (const p of pages) {
      for (const col of [(p as any).coluna1, (p as any).coluna2]) {
        for (const it of (col ?? [])) {
          const q = (it as any).q;
          if (q === undefined || map.has(q)) continue;

          const isBase = !!(expandedQuestions[q] as any)?.__setBase;
          if (isBase) {
            map.set(q, -1); // setBase não tem número
          } else {
            counter++;
            map.set(q, counter);
          }
        }
      }
    }

    return map;
  }, [pages, expandedQuestions]);

  const respostas = useMemo(() => {
    const out: Record<number, Alt> = {};
    expandedQuestions.forEach((q: any, idx) => {
      if ((q as any)?.__setBase) return;
      const alt = extractAltFromMetadata((q as any)?.metadata);
      const printNum = printNumberMap.get(idx);
      if (alt && printNum && printNum > 0) out[printNum] = alt;
    });
    return out;
  }, [expandedQuestions, printNumberMap]);

  // Respostas permutadas conforme tipo de prova selecionado
  const respostasPermutadas = useMemo(() => {
    if (!tiposGerados || tipoAtual === 1) return respostas;

    const tipoConfig = tiposGerados[tipoAtual - 1];
    if (!tipoConfig) return respostas;

    return aplicarPermutacaoGabarito(respostas, tipoConfig.permutations, orderedList);
  }, [respostas, tiposGerados, tipoAtual, orderedList]);

  const respostasDiscursivas = useMemo(() => {
    const out: Record<number, any[]> = {};
    expandedQuestions.forEach((q: any, idx) => {
      if ((q as any)?.__setBase) return;
      const printNum = printNumberMap.get(idx);
      if (!printNum || printNum <= 0) return;

      // Questão simples com rubric no metadata
      const rubric = extractEssayRubric((q as any)?.metadata);
      if (rubric) {
        out[printNum] = [rubric];
        return;
      }

      // Set_questions: rubrics nos question_items
      const itemRubrics = extractItemRubrics((q as any)?.content);
      if (itemRubrics.length > 0) {
        out[printNum] = itemRubrics;
      }
    });
    return out;
  }, [expandedQuestions, printNumberMap]);

  const totalQuestoes = expandedQuestions.filter((q: any) => !(q as any)?.__setBase).length;

  const renderQuestion = (
    question: QuestionData | undefined,
    globalIndex: number,
    frag?: { kind: "frag"; from: number; to: number; first: boolean; textBlockCount?: number }
  ) => {
    if (!question) return null;
    const printedIndex = (printNumberMap.get(globalIndex) ?? 1) - 1;


    const isSetBase = !!(question as any).__setBase;
    const setBaseMeta = (question as any).__setBase as
      | { parentId: string; headerText: string }
      | undefined;

    const baseKey = (question as any).metadata?.id ?? printedIndex;
    const fragKey =
      frag?.kind === "frag"
        ? `${baseKey}__frag_${frag.from}_${frag.to}_${frag.first ? 1 : 0}`
        : `${baseKey}`;

    // Buscar permutação para esta questão
    const questionId = (question as any).metadata?.id;
    const permutation = tiposGerados && questionId
      ? tiposGerados[tipoAtual - 1]?.permutations.find(p => p.questionId === questionId)?.permutation ?? null
      : null;

    // Calcula quais blocos/opções renderizar (TypeScript, não CSS!)
    const fragmentRender = (() => {
      if (!frag) return undefined;

      const N = frag.textBlockCount;
      const { from, to } = frag;

      if (N != null && (from > N || to > N)) {
        // Opções foram expandidas: índices abrangem .question-text (1..N) + .question-options > * (N+1..)
        const textFrom = Math.max(from, 1);
        const textTo = Math.min(to, N);
        const hasText = textFrom <= N;

        const optFrom = Math.max(from - N, 1);
        const optTo = to - N;
        const hasOpts = optTo >= 1;

        return {
          textBlocks: hasText ? Array.from({ length: textTo - textFrom + 1 }, (_, i) => textFrom + i) : [],
          options: hasOpts ? Array.from({ length: optTo - optFrom + 1 }, (_, i) => optFrom + i) : [],
        };
      } else {
        // Sem opções expandidas: só renderiza no primeiro fragmento
        if (frag.first) {
          return undefined; // renderiza tudo
        } else {
          return { textBlocks: [], options: [] }; // renderiza nada
        }
      }
    })();

    return (
      <div
        key={fragKey}
        className="questao-item-wrapper allow-break"
        data-frag-info={frag ? `from=${frag.from} to=${frag.to} N=${frag.textBlockCount ?? 'none'} first=${frag.first}` : undefined}
      >
        {/* ✅ item do texto base: banner + conteúdo, sem cabeçalho de questão */}
{isSetBase ? (
  <div className="mb-3 space-y-2">
    {( !frag || frag.first ) && (
      <div className="text-sm font-semibold">{setBaseMeta?.headerText}</div>
    )}

    <div
      className="
        questao-conteudo
        [&_p]:!m-0
        [&_p]:!p-0
        [&_img]:!my-0
      "
    >
      <QuestionRenderer content={(question as any).content} fragmentRender={fragmentRender} permutation={permutation} imageWidthProp={committedImageWidths} onImageResizeCommit={handleImageResizeCommit} inlineOptions={inlineOptionsSet.has(questionId ?? "")} onToggleInlineOptions={questionId ? () => handleToggleInlineOptions(questionId) : undefined} />
    </div>
  </div>
) : (
          <div className="questao-item">
            {(!frag || frag.first) && (
              <div className="questao-header-linha">
                <QuestionHeaderSvg
                  numero={printedIndex + 1}
                  totalMm={columns === 2 ? 85 : 180}
                  boxMm={28}
                  variant={provaConfig.questionHeaderVariant ?? 0}
                />
                <span
                  contentEditable
                  suppressContentEditableWarning
                  className="pontos-editavel"
                />
              </div>
            )}

            <div
              className="
                questao-conteudo
                [&_p]:!m-0
                [&_p]:!p-0
                [&_img]:!my-0
              "
            >
              <QuestionRenderer content={(question as any).content} fragmentRender={fragmentRender} permutation={permutation} imageWidthProp={committedImageWidths} onImageResizeCommit={handleImageResizeCommit} inlineOptions={inlineOptionsSet.has(questionId ?? "")} onToggleInlineOptions={questionId ? () => handleToggleInlineOptions(questionId) : undefined} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const LayoutComponent =
    provaConfig.layoutType === "exercicio" ? ExerciseLayout : ProvaLayout;
    const logoPlaceholder = provaConfig.logoPlaceholder;

  // Evita hidratação incompatível - só renderiza após montar no cliente
  if (!isMounted) {
    return null;
  }

  // Estado vazio
  if (initialQuestions.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Nenhuma questão selecionada</p>
        <Button onClick={() => router.push("/editor/questoes")}>
          Voltar para seleção
        </Button>
      </div>
    );
  }

  return (
    <>
      <PaginatedA4 className="SEU_WRAPPER_ATUAL_DO_A4">
        <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex gap-2 justify-between brand-header border-b px-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/editor/questoes")} className="bg-amber-50 hover:bg-amber-100 border-amber-200">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            <Button variant="outline" onClick={handleEditarConfiguracao} className="bg-amber-50 hover:bg-amber-100 border-amber-200">
              <Settings className="h-4 w-4 mr-2" />
              Configuração
            </Button>
          </div>

          <div className="flex gap-2">

            <Button
              variant="outline"
              onClick={() => updateProvaConfig({ showGabarito: !provaConfig.showGabarito })}
              className="bg-amber-50 hover:bg-amber-100 border-amber-200"
            >
              {provaConfig.showGabarito ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Gabarito
            </Button>

            <Button variant="outline" onClick={() => setReorderModalOpen(true)} className="bg-amber-50 hover:bg-amber-100 border-amber-200">
              <ListOrdered className="h-4 w-4 mr-2" />
              Reordenar
              {manualOrder && (
                <span className="ml-1 text-[9px] text-amber-600">(manual)</span>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => setSalvarDialogOpen(true)}
              disabled={initialQuestions.length === 0}
              className="bg-amber-50 hover:bg-amber-100 border-amber-200"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar Prova
            </Button>

            {/* Tipos de prova */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md">
              {!tiposGerados && (
                <>
                  <label className="text-xs font-medium text-purple-700">Gerar</label>
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={numTipos}
                    onChange={(e) => setNumTipos(parseInt(e.target.value) || 2)}
                    className="w-12 px-1.5 py-0.5 border rounded text-center text-xs"
                  />
                  <span className="text-xs text-purple-700">tipos</span>
                  <Button onClick={handleGerarTipos} variant="ghost" size="sm" className="h-6 text-xs px-2">
                    OK
                  </Button>
                </>
              )}

              {tiposGerados && (
                <>
                  <select
                    value={tipoAtual}
                    onChange={(e) => setTipoAtual(parseInt(e.target.value))}
                    className="px-2 py-0.5 border rounded text-xs font-medium"
                  >
                    {Array.from({ length: numTipos }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>
                        Tipo {n} {n === 1 ? "(Original)" : ""}
                      </option>
                    ))}
                  </select>
                  <Button onClick={handleReiniciarTipos} variant="ghost" size="sm" className="h-6 text-xs px-2">
                    Reiniciar
                  </Button>
                </>
              )}
            </div>

            {(Object.keys(committedImageWidths).length > 0 || inlineOptionsSet.size > 0) && (
              <Button
                variant="outline"
                onClick={() => setRepaginateVersion(v => v + 1)}
                className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                title="Re-paginar com os tamanhos de imagem atuais"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Repaginar
              </Button>
            )}

            <Button onClick={handlePrint} className="btn-primary">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        <LayoutComponent
          pages={pages as any}
          orderedQuestions={expandedQuestions as any}
          logoUrl={logoUrl}
          logoPlaceholder={logoPlaceholder}
          onLogoClick={() => setLogoDialogOpen(true)}
          renderQuestion={renderQuestion as any}
          refs={refs}
          columns={columns}
          tipoAtual={tipoAtual}
          numTipos={tiposGerados ? numTipos : undefined}
          permutations={tiposGerados?.[tipoAtual - 1]?.permutations ?? null}
          spacers={spacers}
          committedSpacers={committedSpacers}
          onSpacerChange={handleSpacerChange}
          onSpacerCommit={handleSpacerCommit}
        />

        {provaConfig.showGabarito && totalQuestoes > 0 && (
          <>
            {Object.keys(respostasPermutadas).length > 0 && (
              <div className="a4-sheet bg-gray-100 print:bg-white py-20 print:py-0">
                <div className="prova-page mx-auto bg-white shadow-lg print:shadow-none">
                  <Gabarito
                    totalQuestoes={totalQuestoes}
                    respostas={respostasPermutadas}
                    titulo={tiposGerados ? `GABARITO - TIPO ${tipoAtual}` : "QUESTÕES / RESPOSTAS"}
                  />
                </div>
              </div>
            )}
            {Object.keys(respostasDiscursivas).length > 0 && (
              <GabaritoDiscursivoPages respostas={respostasDiscursivas} />
            )}
          </>
        )}

        <LogoPicker
          open={logoDialogOpen}
          onOpenChange={setLogoDialogOpen}
          onLogoSelect={(url) => {
            setLogoUrl(url);
            updateProvaConfig({ logoUrl: url });
          }}
        />

        <ReorderModal
          open={reorderModalOpen}
          onOpenChange={setReorderModalOpen}
          questions={expandedQuestions as any}
          onApply={handleReorderApply}
          onReset={handleReorderReset}
          isManualOrder={manualOrder}
        />

        <SalvarProvaDialog
          open={salvarDialogOpen}
          onOpenChange={setSalvarDialogOpen}
          selections={selections}
          onSaved={(prova) => {
            setSalvarDialogOpen(false);
          }}
        />
      </PaginatedA4>

    </>
  );
}