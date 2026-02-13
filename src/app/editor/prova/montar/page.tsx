// src/app/editor/prova/montar/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useProva } from "@/contexts/ProvaContext";
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
  Scissors,
} from "lucide-react";
import { ImageUpload } from "@/components/editor/ImageUpload";
import { ReorderModal } from "@/components/prova/ReorderModal";
import QuestionHeaderSvg from "@/components/prova/QuestaoHeaderSvg";
import PaginatedA4 from "@/components/prova/PaginatedA4";
import { usePagination } from "@/hooks/usePagination";
import { ProvaLayout } from "@/components/prova/layouts/ProvaLayout";
import { ExerciseLayout } from "@/components/prova/layouts/ExerciseLayout";
import { QuestionData, ColumnLayout } from "@/types/layout";
import Gabarito from "@/components/prova/Gabarito";
import GabaritoDiscursivo from "@/components/prova/GabaritoDiscursivo";

import "./prova.css";

const PAGE_HEIGHT = 1183;
const SAFETY_PX = 120;

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

  const [setPickerOpen, setSetPickerOpen] = useState(false);
  const [setPickerSetId, setSetPickerSetId] = useState<string>("");
  const [setPickerSelected, setSetPickerSelected] = useState<number[]>([]);

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

  // orderedQuestions agora vem da lista linear
  const orderedQuestions = useMemo(() => {
    return [...orderedList];
  }, [orderedList]);

  const setCandidates = useMemo(() => {
    const out: { id: string; n: number; selected: number[] }[] = [];

    for (const q of orderedQuestions as any[]) {
      const id = q?.metadata?.id;
      if (!id) continue;

      const sel = selections.find((s) => s.id === id);
      if (!sel || sel.kind !== "set") continue;

      const doc = safeParseDoc(q.content);
      const setNode = findSetNode(doc);
      const { items } = splitSetNode(setNode);
      const n = items.length;

      const chosen = Array.isArray(sel.itemIndexes) ? sel.itemIndexes : [];
      const valid = chosen
        .filter((x) => Number.isInteger(x) && x >= 0 && x < n)
        .sort((a, b) => a - b);

      out.push({ id, n, selected: valid });
    }

    return out;
  }, [orderedQuestions, selections]);

  const openSetPicker = () => {
    if (setCandidates.length === 0) return;

    const first = setCandidates[0];
    setSetPickerSetId(first.id);
    setSetPickerSelected(
      first.selected.length
        ? first.selected
        : Array.from({ length: first.n }, (_, i) => i)
    );
    setSetPickerOpen(true);
  };

  const currentSetCandidate = useMemo(() => {
    return setCandidates.find((x) => x.id === setPickerSetId) ?? null;
  }, [setCandidates, setPickerSetId]);

  const toggleSetItem = (idx: number) => {
    setSetPickerSelected((prev) => {
      const has = prev.includes(idx);
      if (has) return prev.filter((x) => x !== idx).sort((a, b) => a - b);
      return [...prev, idx].sort((a, b) => a - b);
    });
  };

  const canSaveSetPicker = setPickerSelected.length >= 2;

  const saveSetPicker = () => {
    if (!setPickerSetId) return;
    if (!canSaveSetPicker) return;

    setSetSelection(setPickerSetId, setPickerSelected);
    setSetPickerOpen(false);
  };

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

  // Calcula os índices de __setBase para o bin-packing
  const setBaseIndexes = useMemo(() => {
    return expandedQuestions
      .map((q: any, i) => ((q as any)?.__setBase ? i : -1))
      .filter((i) => i >= 0);
  }, [expandedQuestions]);

const { pages, refs } = usePagination({
  config: {
    pageHeight: PAGE_HEIGHT,
    safetyMargin: SAFETY_PX,
    columns,
    allowPageBreak: true,
    optimizeLayout: !manualOrder,
    setBaseIndexes,
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
    setBaseIndexes,
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
    frag?: { kind: "frag"; from: number; to: number; first: boolean }
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

    const fragId =
      frag?.kind === "frag"
        ? `frag-${String(baseKey).replace(/[^a-zA-Z0-9_-]/g, "_")}-${frag.from}-${frag.to}-${frag.first ? 1 : 0}`
        : null;

    return (
      <div
        key={fragKey}
        id={fragId ?? undefined}
        className={`questao-item-wrapper${provaConfig.allowPageBreak ? " allow-break" : ""}`}
      >
        {fragId && frag && (
          <style>{`
  /* Se existir .question-text, NÃO pode esconder .questao-conteudo > * (senão mata o wrapper) */
  #${fragId} .questao-conteudo:has(.question-text) .question-text > * { display: none; }
  #${fragId} .questao-conteudo:has(.question-text) .question-text > *:nth-child(n+${frag.from}):nth-child(-n+${frag.to}) { display: block; }

  /* Só aplica Caso 1/2 quando NÃO houver .question-text */
  #${fragId} .questao-conteudo:not(:has(.question-text)) > * { display: none; }
  #${fragId} .questao-conteudo:not(:has(.question-text)) > *:nth-child(n+${frag.from}):nth-child(-n+${frag.to}) { display: block; }

  #${fragId} .questao-conteudo:not(:has(.question-text)) > :first-child > * { display: none; }
  #${fragId} .questao-conteudo:not(:has(.question-text)) > :first-child > *:nth-child(n+${frag.from}):nth-child(-n+${frag.to}) { display: block; }

  ${frag.first ? "" : `#${fragId} .questao-header-linha { display: none; }`}
`}</style>

        )}

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
      <QuestionRenderer content={(question as any).content} />
    </div>
  </div>
) : (
          <div className="questao-item">
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

            <div
              className="
                questao-conteudo
                [&_p]:!m-0
                [&_p]:!p-0
                [&_img]:!my-0
              "
            >
              <QuestionRenderer content={(question as any).content} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const LayoutComponent =
    provaConfig.layoutType === "exercicio" ? ExerciseLayout : ProvaLayout;
    const logoPlaceholder = provaConfig.logoPlaceholder;



  return (
    <>
      <PaginatedA4 className="SEU_WRAPPER_ATUAL_DO_A4">
        <div className="print:hidden fixed top-4 left-4 right-4 z-50 flex gap-2 justify-between bg-white p-4 border rounded-lg shadow-lg">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/editor/questoes")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            <Button variant="outline" onClick={handleEditarConfiguracao}>
              <Settings className="h-4 w-4 mr-2" />
              Configuração
            </Button>
          </div>

          <div className="flex gap-2">
            {setCandidates.length > 0 && (
              <Button variant="outline" onClick={openSetPicker}>
                Itens do conjunto
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => updateProvaConfig({ showGabarito: !provaConfig.showGabarito })}
            >
              {provaConfig.showGabarito ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Gabarito
            </Button>

            <Button variant="outline" onClick={() => setReorderModalOpen(true)}>
              <ListOrdered className="h-4 w-4 mr-2" />
              Reordenar
              {manualOrder && (
                <span className="ml-1 text-[9px] text-amber-600">(manual)</span>
              )}
            </Button>

            <Button onClick={handlePrint}>
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
        />

        {provaConfig.showGabarito && totalQuestoes > 0 && (
          <div className="a4-sheet bg-gray-100 print:bg-white py-20 print:py-0">
            <div className="prova-page mx-auto bg-white shadow-lg print:shadow-none">
              <Gabarito totalQuestoes={totalQuestoes} respostas={respostas} />
              {Object.keys(respostasDiscursivas).length > 0 && (
                <div className="mt-8">
                  <GabaritoDiscursivo respostas={respostasDiscursivas} />
                </div>
              )}
            </div>
          </div>
        )}

        <ImageUpload
          open={logoDialogOpen}
          onOpenChange={setLogoDialogOpen}
          onImageInsert={(url) => {
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
      </PaginatedA4>

      {setPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 print:hidden">
          <div className="w-[min(720px,calc(100vw-24px))] rounded-lg bg-white shadow-xl border p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <div className="text-base font-semibold">Selecionar itens do conjunto</div>
                <div className="text-xs text-muted-foreground">
                  Regra: selecione no mínimo 2 itens.
                </div>
              </div>

              <Button variant="outline" onClick={() => setSetPickerOpen(false)}>
                Fechar
              </Button>
            </div>

            {setCandidates.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhum conjunto selecionado na prova.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2 mb-3">
                  <label className="text-xs text-muted-foreground">Conjunto</label>
                  <select
                    className="border rounded-md h-9 px-2 text-sm"
                    value={setPickerSetId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSetPickerSetId(nextId);

                      const cand = setCandidates.find((x) => x.id === nextId);
                      if (!cand) return;

                      setSetPickerSelected(
                        cand.selected.length
                          ? cand.selected
                          : Array.from({ length: cand.n }, (_, i) => i)
                      );
                    }}
                  >
                    {setCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} ({c.n} itens)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border rounded-md p-3 max-h-[50vh] overflow-auto">
                  {currentSetCandidate ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {Array.from({ length: currentSetCandidate.n }, (_, i) => {
                        const checked = setPickerSelected.includes(i);
                        return (
                          <label
                            key={i}
                            className="flex items-center gap-2 text-sm border rounded-md px-2 py-2 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSetItem(i)}
                            />
                            <span>Item {i + 1}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Selecione um conjunto.
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    Selecionados:{" "}
                    <span className="font-medium">{setPickerSelected.length}</span>
                    {!canSaveSetPicker && (
                      <span className="ml-2 text-red-600">(mínimo 2)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setSetPickerOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={saveSetPicker} disabled={!canSaveSetPicker}>
                      Aplicar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}