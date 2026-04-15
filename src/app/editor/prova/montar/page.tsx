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
import DevDebugTools from "@/components/dev/DevDebugTools";
import { LogoPicker } from "@/components/editor/LogoPicker";
import { ReorderModal } from "@/components/prova/ReorderModal";
import { SalvarProvaDialog } from "@/components/prova/SalvarProvaDialog";
import QuestionHeaderSvg from "@/components/prova/QuestaoHeaderSvg";
import PaginatedA4 from "@/components/prova/PaginatedA4";
import { usePagination } from "@/hooks/usePagination";
import { ProvaLayout } from "@/components/prova/layouts/ProvaLayout";
import { ExerciseLayout } from "@/components/prova/layouts/ExerciseLayout";
import { AccessibleLayout } from "@/components/prova/layouts/AccessibleLayout";
import { QuestionData, ColumnLayout } from "@/types/layout";
import Gabarito from "@/components/prova/Gabarito";
import GabaritoDiscursivoPages from "@/components/prova/GabaritoDiscursivoPages";
import TabelaPeriodica, { type TabelaSize } from "@/components/prova/TabelaPeriodica";
import {
  gerarTiposDeProva,
  aplicarPermutacaoGabarito,
  hashQuestionId,
  type ProvaTypeConfig,
  type Alt as AltGera,
} from "@/lib/GeraTiposDeProva";
import {
  measureQuestionHeights,
  calculateFirstPageCapacity,
  calculateOtherPageCapacity,
} from "@/lib/pagination";

import { getBaseText } from "@/lib/baseTexts";
import { resolveMountedLineRefs, injectLineNumbers } from "@/lib/lineRefMeasure";
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
    const items: any[] = [];
    for (const child of (setNode.content ?? [])) {
      if (child.type === "question_item") items.push(child);
      else if (child.type === "question_group")
        (child.content ?? []).forEach((qi: any) => { if (qi.type === "question_item") items.push(qi); });
    }
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
  groups: PMNode[] | null;
} {
  const content = setNode?.content ?? [];
  const baseText = content.find((n) => n?.type === "base_text") ?? null;
  const hasGroups = content.some((n) => n?.type === "question_group");
  const items: PMNode[] = [];
  const groups: PMNode[] = [];
  for (const child of content) {
    if (child.type === "question_item") items.push(child);
    else if (child.type === "question_group") {
      groups.push(child);
      (child.content ?? []).forEach((qi: PMNode) => { if (qi.type === "question_item") items.push(qi); });
    }
  }
  return { baseText, items, groups: hasGroups ? groups : null };
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

function stripBaseTextFromQuestionDoc(content: any): PMNode | null {
  const doc = safeParseDoc(content);
  if (!doc) return null;
  return {
    type: "doc",
    content: (doc.content ?? []).map((n) => {
      if (n.type !== "question") return n;
      return {
        ...n,
        content: (n.content ?? []).filter((child) => child?.type !== "base_text"),
      };
    }),
  };
}

function buildCombinedBaseTextNode(
  ids: string[],
  cache: Map<string, PMNode>
): PMNode | null {
  const combinedContent: PMNode[] = [];
  for (const id of ids) {
    const bt = cache.get(id);
    if (!bt) return null;
    const btContent = (bt as any).content ?? bt;
    const nodes: PMNode[] = Array.isArray(btContent.content) ? btContent.content : [];
    combinedContent.push(...nodes);
  }
  if (combinedContent.length === 0) return null;
  return { type: "base_text", content: combinedContent };
}

type BaseTextSection = {
  id: string;
  tag: string;
  blockCount: number;
};

function buildBaseTextSections(
  ids: string[],
  cache: Map<string, PMNode>
): BaseTextSection[] {
  return ids.flatMap((id) => {
    const bt = cache.get(id);
    if (!bt) return [];
    const btContent = (bt as any).content ?? bt;
    const nodes: PMNode[] = Array.isArray(btContent.content) ? btContent.content : [];
    const tag = (bt as any).tag;
    if (!tag || nodes.length === 0) return [];
    return [{ id, tag, blockCount: nodes.length }];
  });
}

function injectBaseTextIntoSetDoc(content: any, baseTextNode: PMNode): PMNode | null {
  const doc = safeParseDoc(content);
  if (!doc) return null;
  return {
    type: "doc",
    content: (doc.content ?? []).map((n) => {
      if (n.type !== "set_questions") return n;
      const withoutBase = (n.content ?? []).filter((child) => child?.type !== "base_text");
      return { ...n, content: [baseTextNode, ...withoutBase] };
    }),
  };
}

function stripBaseTextFromSetDoc(content: any): PMNode | null {
  const doc = safeParseDoc(content);
  if (!doc) return null;
  return {
    type: "doc",
    content: (doc.content ?? []).map((n) => {
      if (n.type !== "set_questions") return n;
      return { ...n, content: (n.content ?? []).filter((child) => child?.type !== "base_text") };
    }),
  };
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
  const columns = (provaConfig.layoutType === "acessivel" ? 1 : Number(provaConfig.columns) === 2 ? 2 : 1) as 1 | 2;
  const layoutKey = (provaConfig.layoutType === "acessivel" ? "acessivel" : columns === 2 ? "2col" : "1col") as "2col" | "1col" | "acessivel";

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
  const [devMontarDebugEnabled, setDevMontarDebugEnabled] = useState(false);
  const [lineRefRuntimeSnapshot, setLineRefRuntimeSnapshot] = useState<any | null>(null);

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

  // Larguras de imagens comprometidas (dispara re-paginação no pointerup)
  const [committedImageWidths, setCommittedImageWidths] = useState<Record<string, number>>({});
  const [hiddenBaseTextLabels, setHiddenBaseTextLabels] = useState<Set<string>>(new Set());
  const makeBaseTextLabelKey = (scopeKey: string, textId: string) => `${scopeKey}::${textId}`;
  const toggleBaseTextLabel = (scopeKey: string, textId: string) =>
    setHiddenBaseTextLabels(prev => {
      const next = new Set(prev);
      const key = makeBaseTextLabelKey(scopeKey, textId);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleImageResizeCommit = (id: string, width: number) =>
    setCommittedImageWidths(prev => ({ ...prev, [id]: width }));

  const committedImageWidthsKey = useMemo(() =>
    JSON.stringify(committedImageWidths),
    [committedImageWidths]
  );

  // Larguras (%) das caixas de dados — chave: `${questionId}:${boxKey}`
  const [committedDataBoxWidths, setCommittedDataBoxWidths] = useState<Record<string, number>>({});
  const makeDataBoxWidthCommit = (questionId: string) => (key: string, width: number) =>
    setCommittedDataBoxWidths(prev => ({ ...prev, [`${questionId}:${key}`]: width }));
  const getDataBoxWidthProp = (questionId: string): Record<string, number> =>
    Object.fromEntries(
      Object.entries(committedDataBoxWidths)
        .filter(([k]) => k.startsWith(`${questionId}:`))
        .map(([k, v]) => [k.slice(questionId.length + 1), v])
    );

  // Versão manual de re-paginação (imagem resize não re-pagina automaticamente)
  const [repaginateVersion, setRepaginateVersion] = useState(0);

  // Questões com opções em linha (oneparchoices)
  const [inlineOptionsSet, setInlineOptionsSet] = useState<Set<string>>(new Set());

  // Cache de textos base (baseTextId → conteúdo PMNode)
  const [baseTextCache, setBaseTextCache] = useState<Map<string, PMNode>>(new Map());

  // Carrega textos base de questões individuais com baseTextIds[] (ou baseTextId legado)
  useEffect(() => {
    const ids = new Set<string>();
    for (const q of orderedList as any[]) {
      const meta = q?.metadata ?? {};
      const btIds: string[] = Array.isArray(meta.baseTextIds)
        ? meta.baseTextIds
        : (meta.baseTextId ? [meta.baseTextId] : []);
      for (const id of btIds) if (id && typeof id === "string") ids.add(id);
    }
    // Busca apenas os que ainda não estão no cache
    const missing = [...ids].filter(id => !baseTextCache.has(id));
    if (missing.length === 0) return;

    Promise.all(
      missing.map(id => getBaseText(id).then(bt => ({ id, bt })))
    ).then(results => {
      setBaseTextCache(prev => {
        const next = new Map(prev);
        for (const { id, bt } of results) {
          if (bt?.content) next.set(id, bt as any);
        }
        return next;
      });
    });
  }, [orderedList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tabela Periódica
  const [showTabelaPeriodica, setShowTabelaPeriodica] = useState(false);
  const [tabelaPeriodicaSize, setTabelaPeriodicaSize] = useState<TabelaSize>("a4-landscape");

  // Detecta se há questões de Química entre as selecionadas
  const isQuimica = useMemo(() => {
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return orderedList.some((q: any) => {
      const d = q?.metadata?.disciplina ?? "";
      return norm(d) === "quimica";
    });
  }, [orderedList]);

  const handleToggleInlineOptions = (id: string) => {
    setInlineOptionsSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Não dispara repaginação automática — usuário pressiona Repaginar quando quiser
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ReorderModal: professor aplicou ordem manual
  const handleReorderApply = (reordered: QuestionData[]) => {
    const originalById = new Map<string, QuestionData>();
    (orderedList as any[]).forEach((q) => {
      const id = q?.metadata?.id;
      if (id) originalById.set(id, q);
    });

    const nextOrdered: QuestionData[] = [];
    const seen = new Set<string>();

    (reordered as any[]).forEach((q) => {
      if ((q as any)?.__setBase) return;

      const setParentId = (q as any)?.__set?.parentId;
      if (setParentId && originalById.has(setParentId)) {
        if (!seen.has(setParentId)) {
          nextOrdered.push(originalById.get(setParentId)!);
          seen.add(setParentId);
        }
        return;
      }

      const id = q?.metadata?.id;
      if (id && originalById.has(id) && !seen.has(id)) {
        nextOrdered.push(originalById.get(id)!);
        seen.add(id);
      }
    });

    setOrderedList(nextOrdered);
    setManualOrder(true);
    // Mantém compatibilidade com updateColumnLayout do contexto
    updateColumnLayout({
      coluna1: nextOrdered,
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

    // Usa expandedQuestions (itens individuais) para que cada question_item de um
    // set_questions receba sua própria permutação. Com orderedList, getLetrasOpcoes
    // encontraria as opções de TODOS os itens do conjunto numa única chamada.
    // Filtra setBase (sem opções) para não distorcer a contagem de balanceamento.
    const questoesParaTipos = (expandedQuestions as any[]).filter((q: any) => !q.__setBase);
    const tipos = gerarTiposDeProva(questoesParaTipos, numTipos, userSeed);
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
    const qs = orderedQuestions as any[];
    const processed = new Set<number>();

    for (let i = 0; i < qs.length; i++) {
      if (processed.has(i)) continue;

      const q = qs[i];
      const id = q?.metadata?.id;
      if (!id) continue;

      // baseTextIds[] com fallback para legado baseTextId
      const metaQ = q?.metadata ?? {};
      const btIds: string[] = Array.isArray(metaQ.baseTextIds)
        ? metaQ.baseTextIds.filter((id: any) => typeof id === "string" && id !== "")
        : (metaQ.baseTextId ? [metaQ.baseTextId] : []);
      const btKey = btIds.join(","); // chave canônica de agrupamento
      const isIndividual = !findSetNode(safeParseDoc(q?.content));

      // ── Questões individuais com baseTextIds ─────────────────────────────────
      if (btKey && isIndividual) {
        // Coleta TODAS as questões com mesmo conjunto de textos base
        const group: number[] = [i];
        for (let j = i + 1; j < qs.length; j++) {
          if (processed.has(j)) continue;
          const next = qs[j];
          const nextMeta = next?.metadata ?? {};
          const nextBtIds: string[] = Array.isArray(nextMeta.baseTextIds)
            ? nextMeta.baseTextIds.filter((id: any) => typeof id === "string" && id !== "")
            : (nextMeta.baseTextId ? [nextMeta.baseTextId] : []);
          const nextIsIndividual = !findSetNode(safeParseDoc(next?.content));
          if (nextBtIds.join(",") === btKey && nextIsIndividual) group.push(j);
        }

        group.forEach(idx => processed.add(idx));

        // Verifica se TODOS os textos base já estão no cache
        const allLoaded = btIds.every(id => baseTextCache.has(id));

        if (allLoaded) {
          const baseTextNode = buildCombinedBaseTextNode(btIds, baseTextCache);
          const baseTextSections = buildBaseTextSections(btIds, baseTextCache);

          if (baseTextNode && group.length >= 2) {
            // 2+ questões: __setBase separado com banner + questões individuais
            const baseDoc: PMNode = {
              type: "doc",
              content: [{ type: "question", content: [baseTextNode] }],
            };
            out.push({
              ...qs[group[0]],
              metadata: { ...(qs[group[0]]?.metadata ?? {}), id: `${btKey}#base` },
              content: baseDoc,
              __setBase: {
                parentId: btKey,
                headerText: `Use o texto a seguir para responder às próximas ${group.length} questões.`,
                textSections: baseTextSections,
              },
            });
            for (const idx of group) {
              const strippedDoc = stripBaseTextFromQuestionDoc(qs[idx]?.content);
              out.push({
                ...qs[idx],
                content: strippedDoc ?? qs[idx]?.content,
                __set: { parentId: btKey },
              });
            }
          } else if (baseTextNode) {
            // 1 questão: base_text dentro do doc → atômico
            const q0 = qs[group[0]];
            const doc0 = stripBaseTextFromQuestionDoc(q0?.content) ?? safeParseDoc(q0?.content);
            const newDoc: PMNode = {
              type: "doc",
              content: (doc0?.content ?? []).map((n) => {
                if (n.type !== "question") return n;
                return { ...n, content: [baseTextNode, ...(n.content ?? [])] };
              }),
            };
            out.push({ ...q0, content: newDoc, __baseTextSections: baseTextSections });
          } else {
            for (const idx of group) out.push(qs[idx]);
          }
        } else {
          // Cache ainda não carregou — passa sem texto base, memo re-executa quando chegar
          for (const idx of group) out.push(qs[idx]);
        }
        continue;
      }

      const doc = safeParseDoc(q.content);
      const setNode = findSetNode(doc);
      const { baseText, items, groups } = splitSetNode(setNode);

      const sel = selections.find((s) => s.id === id);

      if (!sel || sel.kind === "question") {
        out.push(q);
        continue;
      }

      const tipoMeta = (q.metadata as any)?.tipo ?? "";
      const isEssaySet = tipoMeta.toLowerCase().includes("discursiva") ||
        (!tipoMeta && !items.some((it) => (it.content ?? []).some((n) => n?.type === "options")));

      const baseDoc = buildBaseDoc(baseText);
      const selectedIdxs = Array.isArray(sel.itemIndexes) ? sel.itemIndexes : [];
      const validIdxs = selectedIdxs
        .filter((n) => Number.isInteger(n) && n >= 0 && n < items.length)
        .sort((a, b) => a - b);

      if (btKey && isEssaySet) {
        const group: number[] = [i];
        for (let j = i + 1; j < qs.length; j++) {
          if (processed.has(j)) continue;
          const next = qs[j];
          const nextId = next?.metadata?.id;
          if (!nextId) continue;
          const nextSel = selections.find((s) => s.id === nextId);
          if (!nextSel || nextSel.kind !== "set") continue;
          const nextMeta = next?.metadata ?? {};
          const nextBtIds: string[] = Array.isArray(nextMeta.baseTextIds)
            ? nextMeta.baseTextIds.filter((id: any) => typeof id === "string" && id !== "")
            : (nextMeta.baseTextId ? [nextMeta.baseTextId] : []);
          if (nextBtIds.join(",") !== btKey) continue;

          const nextDoc = safeParseDoc(next?.content);
          const nextSetNode = findSetNode(nextDoc);
          const { items: nextItems } = splitSetNode(nextSetNode);
          const nextTipoMeta = (next.metadata as any)?.tipo ?? "";
          const nextIsEssaySet = nextTipoMeta.toLowerCase().includes("discursiva") ||
            (!nextTipoMeta && !nextItems.some((it) => (it.content ?? []).some((n) => n?.type === "options")));
          if (!nextIsEssaySet) continue;

          group.push(j);
        }

        if (group.length >= 2) {
          group.forEach((idx) => processed.add(idx));

          const allLoaded = btIds.every((id) => baseTextCache.has(id));
          if (!allLoaded) {
            for (const idx of group) out.push(qs[idx]);
            continue;
          }

          const baseTextNode = buildCombinedBaseTextNode(btIds, baseTextCache);
          const baseTextSections = buildBaseTextSections(btIds, baseTextCache);
          const sharedBaseDoc = buildBaseDoc(baseTextNode);

          if (sharedBaseDoc) {
            out.push({
              ...qs[group[0]],
              metadata: { ...(qs[group[0]]?.metadata ?? {}), id: `${btKey}#base` },
              content: sharedBaseDoc,
              __setBase: {
                parentId: btKey,
                headerText: `Use o texto a seguir para responder às próximas ${group.length} questões.`,
                textSections: baseTextSections,
              },
            });
          }

          for (const idx of group) {
            const groupedQuestion = qs[idx];
            const strippedDoc = stripBaseTextFromSetDoc(groupedQuestion?.content);
            out.push({
              ...groupedQuestion,
              content: strippedDoc ?? groupedQuestion?.content,
              __set: { parentId: btKey },
            });
          }
          continue;
        }
      }

      if (isEssaySet) {
        // Conjuntos discursivos: unidade atômica
        // Se o base_text foi removido do doc pela migração mas existe no cache,
        // reinjeta dentro do set_questions para o renderer funcionar como antes
        const essayMeta = q.metadata as any;
        const essayBtIds: string[] = Array.isArray(essayMeta?.baseTextIds)
          ? essayMeta.baseTextIds.filter((id: any) => typeof id === "string" && id !== "")
          : (essayMeta?.baseTextId ? [essayMeta.baseTextId] : []);
        if (!baseText && essayBtIds.length > 0) {
          const allEssayLoaded = essayBtIds.every((id: string) => baseTextCache.has(id));
          if (allEssayLoaded) {
            const baseTextNode = buildCombinedBaseTextNode(essayBtIds, baseTextCache);
            const baseTextSections = buildBaseTextSections(essayBtIds, baseTextCache);
            const newDoc = baseTextNode ? injectBaseTextIntoSetDoc(q.content, baseTextNode) : null;
            out.push({ ...q, content: newDoc, __baseTextSections: baseTextSections });
            continue;
          }
        }
        out.push({ ...q, __baseTextSections: buildBaseTextSections(essayBtIds, baseTextCache) });
        continue;
      }

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
  }, [orderedQuestions, selections, baseTextCache]);

  // Reset dos spacers ao mudar o conjunto de questões (IDs mudam → spacers zerados)
  const expandedQuestionsKey = useMemo(() =>
    expandedQuestions.map((q: any) => q.metadata?.id ?? "").join(","),
    [expandedQuestions]
  );
  const expandedQuestionsContentKey = useMemo(() =>
    expandedQuestions.map((q: any) => {
      const id = q?.metadata?.id ?? "";
      const kind = q?.__setBase ? "base" : q?.__set ? "item" : "single";
      const content = typeof q?.content === "string" ? q.content : JSON.stringify(q?.content ?? null);
      return `${id}:${kind}:${content}`;
    }).join("|"),
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
    repaginateVersion,
    expandedQuestionsContentKey,
  ],
});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sheets = Array.from(document.querySelectorAll<HTMLElement>(".a4-sheet"));
    if (sheets.length === 0) return;
    const root = sheets[0].parentElement as HTMLElement | null;
    if (!root) return;
    let raf1 = 0;
    let raf2 = 0;
    const timeoutId = window.setTimeout(() => {
      setLineRefRuntimeSnapshot(resolveMountedLineRefs(root) ?? null);
    }, 120);
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setLineRefRuntimeSnapshot(resolveMountedLineRefs(root) ?? null);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timeoutId);
    };
  }, [pages, columns, provaConfig.layoutType]);

  // Injeta numeração de linhas depois que resolveMountedLineRefs atualizou o estado
  // (useEffect separado garante que a re-render do snapshot já aconteceu)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sheets = Array.from(document.querySelectorAll<HTMLElement>(".a4-sheet"));
    if (sheets.length === 0) return;
    const root = sheets[0].parentElement as HTMLElement | null;
    if (!root) return;
    const id = requestAnimationFrame(() => {
      injectLineNumbers(root);
    });
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineRefRuntimeSnapshot]);

  useEffect(() => {
    if (!devMontarDebugEnabled || typeof window === "undefined") return;

    const rawHeights = refs.measureItemsRef.current
      ? measureQuestionHeights(refs.measureItemsRef.current)
      : [];
    const questionHeights = rawHeights.map((h, i) => h + (committedSpacers.get(`q${i}`) ?? 0));
    const wrapperDebug = refs.measureItemsRef.current
      ? Array.from(refs.measureItemsRef.current.querySelectorAll(".questao-item-wrapper")).map((wrapper, idx) => {
          const el = wrapper as HTMLElement;
          const content = el.querySelector(".questao-conteudo") as HTMLElement | null;
          const qTexts = content
            ? Array.from(content.querySelectorAll(".question-text")) as HTMLElement[]
            : [];
          const qOptions = content?.querySelector(".question-options") as HTMLElement | null;
          const questionTextBlocks = qTexts.map((qt, textIdx) => ({
            textIdx,
            children: Array.from(qt.children).map((child, childIdx) => {
              const childEl = child as HTMLElement;
              const rect = childEl.getBoundingClientRect();
              return {
                childIdx,
                tagName: childEl.tagName,
                top: Math.ceil(rect.top),
                bottom: Math.ceil(rect.bottom),
                height: Math.ceil(rect.height),
                text: (childEl.textContent ?? "").trim().slice(0, 80),
              };
            }),
          }));
          return {
            idx,
            offsetHeight: el.offsetHeight,
            scrollHeight: el.scrollHeight,
            rectHeight: Math.ceil(el.getBoundingClientRect().height),
            contentHeight: content ? Math.ceil(content.getBoundingClientRect().height) : null,
            questionTextCount: qTexts.length,
            questionTextChildrenCounts: qTexts.map((qt) => qt.children.length),
            questionTextBlocks,
            hasQuestionOptions: !!qOptions,
            questionOptionsChildrenCount: qOptions ? qOptions.children.length : 0,
          };
        })
      : [];
    const firstPageCapacity =
      refs.measureFirstPageRef.current && refs.measureFirstQuestoesRef.current
        ? calculateFirstPageCapacity(
            refs.measureFirstPageRef.current,
            refs.measureFirstQuestoesRef.current,
            PAGE_HEIGHT,
            SAFETY_PX
          )
        : null;
    const otherPageCapacity =
      refs.measureOtherPageRef.current && refs.measureOtherQuestoesRef.current
        ? calculateOtherPageCapacity(
            refs.measureOtherPageRef.current,
            refs.measureOtherQuestoesRef.current,
            PAGE_HEIGHT,
            SAFETY_PX
          )
        : null;
    const renderedPagesDebug = Array.from(
      document.querySelectorAll(".a4-sheet .prova-page")
    )
      .map((pageEl, pageIndex) => {
        const page = pageEl as HTMLElement;
        const questionsContainer = page.querySelector(".questoes-container") as HTMLElement | null;
        const footer = page.querySelector(".prova-footer") as HTMLElement | null;
        if (!questionsContainer || !footer || !questionsContainer.querySelector(".questao-item-wrapper")) {
          return null;
        }

        const pageRect = page.getBoundingClientRect();
        const footerRect = footer.getBoundingClientRect();
        const containerRect = questionsContainer.getBoundingClientRect();
        const footerTop = Math.ceil(footerRect.top - pageRect.top);

        const columnsDebug = Array.from(
          questionsContainer.querySelectorAll(":scope > .coluna")
        ).map((colEl, colIndex) => {
          const col = colEl as HTMLElement;
          const colRect = col.getBoundingClientRect();
          const items = Array.from(col.querySelectorAll(":scope > .questao-item-wrapper")).map((itemEl, itemIndex) => {
            const item = itemEl as HTMLElement;
            const itemRect = item.getBoundingClientRect();
            const header = item.querySelector(".questao-header-linha") as HTMLElement | null;
            const bottom = Math.ceil(itemRect.bottom - pageRect.top);
            const overflowPastFooter = Math.max(0, bottom - footerTop);
            return {
              itemIndex,
              qIndex: item.dataset.qIndex ? Number(item.dataset.qIndex) : null,
              qId: item.dataset.qId ?? null,
              isSetBase: item.dataset.isSetBase === "1",
              fragKind: item.dataset.fragKind ?? null,
              fragFrom: item.dataset.fragFrom ? Number(item.dataset.fragFrom) : null,
              fragTo: item.dataset.fragTo ? Number(item.dataset.fragTo) : null,
              fragFirst: item.dataset.fragFirst === "1",
              hasQuestionHeader: !!header,
              questionHeaderText: header ? (header.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80) : null,
              top: Math.ceil(itemRect.top - pageRect.top),
              bottom,
              height: Math.ceil(itemRect.height),
              overflowPastFooter,
            };
          });

          return {
            colIndex,
            top: Math.ceil(colRect.top - pageRect.top),
            bottom: Math.ceil(colRect.bottom - pageRect.top),
            itemCount: items.length,
            maxOverflowPastFooter: items.reduce(
              (max, item) => Math.max(max, item.overflowPastFooter),
              0
            ),
            items,
          };
        });

        return {
          pageIndex,
          footerTop,
          footerHeight: Math.ceil(footerRect.height),
          containerTop: Math.ceil(containerRect.top - pageRect.top),
          containerBottom: Math.ceil(containerRect.bottom - pageRect.top),
          columns: columnsDebug,
        };
      })
      .filter(Boolean);

    const lineRefDebug = {
      measure: Array.from(
        document.querySelectorAll<HTMLElement>(".measure-layer .questao-item-wrapper[data-q-id]")
      ).map((wrapper) => ({
        qId: wrapper.dataset.qId ?? "",
        parentId: wrapper.dataset.setParentId ?? null,
        isSetBase: wrapper.dataset.isSetBase === "1",
        anchorCount: wrapper.querySelectorAll("[data-anchor-id]").length,
        anchorIds: Array.from(wrapper.querySelectorAll<HTMLElement>("[data-anchor-id]"))
          .map((el) => el.dataset.anchorId ?? "")
          .filter(Boolean),
        lineScopeCount: wrapper.querySelectorAll("[data-line-scope]").length,
      })),
      visible: Array.from(
        document.querySelectorAll<HTMLElement>(".a4-sheet .questao-item-wrapper[data-q-id]")
      ).map((wrapper) => ({
        qId: wrapper.dataset.qId ?? "",
        parentId: wrapper.dataset.setParentId ?? null,
        isSetBase: wrapper.dataset.isSetBase === "1",
        lineRefCount: wrapper.querySelectorAll("[data-line-ref]").length,
        lineRefs: Array.from(wrapper.querySelectorAll<HTMLElement>("[data-line-ref]")).map((el) => ({
          anchorId: el.dataset.lineRef ?? "",
          text: (el.textContent ?? "").trim(),
        })),
      })),
    };

    const payload = {
      firstPageCapacity,
      otherPageCapacity,
      rawHeights,
      questionHeights,
      wrapperDebug,
      renderedPagesDebug,
      lineRefDebug,
      lineRefRuntimeDebug: lineRefRuntimeSnapshot,
      selections: selections.map((s: any) => ({
        kind: s.kind,
        id: s.id,
        itemIndexes: Array.isArray(s.itemIndexes) ? [...s.itemIndexes] : undefined,
      })),
      expandedQuestions: expandedQuestions.map((q: any, idx) => ({
        idx,
        id: q?.metadata?.id ?? "",
        tipo: q?.metadata?.tipo ?? "",
        isSetBase: !!q?.__setBase,
        isSetItem: !!q?.__set,
        parentId: q?.__setBase?.parentId ?? q?.__set?.parentId ?? null,
        baseTextSections: q?.__setBase?.textSections ?? q?.__baseTextSections ?? [],
      })),
      setGroups,
      pages: pages.map((p: any, pageIndex: number) => ({
        pageIndex,
        coluna1: (p.coluna1 ?? []).map((it: any) =>
          typeof it === "number"
            ? { kind: "number", q: it }
            : { kind: it.kind, q: it.q, first: it.first, from: it.from, to: it.to, textBlockCount: it.textBlockCount }
        ),
        coluna2: (p.coluna2 ?? []).map((it: any) =>
          typeof it === "number"
            ? { kind: "number", q: it }
            : { kind: it.kind, q: it.q, first: it.first, from: it.from, to: it.to, textBlockCount: it.textBlockCount }
        ),
      })),
    };

    (window as any).__PMEDITOR_MONTAR_DEBUG__ = payload;
    console.log("[montar-debug]", payload);
  }, [devMontarDebugEnabled, selections, expandedQuestions, setGroups, pages, refs, committedSpacers, lineRefRuntimeSnapshot]);

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

  // Mapa de printNum → questão (correto mesmo com set_questions expandidos)
  const questoesPorNumero = useMemo(() => {
    const map: Record<number, any> = {};
    expandedQuestions.forEach((q: any, idx) => {
      const printNum = printNumberMap.get(idx);
      if (printNum && printNum > 0) map[printNum] = q;
    });
    return map;
  }, [expandedQuestions, printNumberMap]);

  // Respostas permutadas conforme tipo de prova selecionado
  const respostasPermutadas = useMemo(() => {
    if (!tiposGerados || tipoAtual === 1) return respostas;

    const tipoConfig = tiposGerados[tipoAtual - 1];
    if (!tipoConfig) return respostas;

    return aplicarPermutacaoGabarito(respostas, tipoConfig.permutations, questoesPorNumero);
  }, [respostas, tiposGerados, tipoAtual, questoesPorNumero]);

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
      | { parentId: string; headerText: string; textSections?: BaseTextSection[] }
      | undefined;
    const baseTextSectionsMeta = ((question as any).__baseTextSections ?? []) as BaseTextSection[];
    const baseKey = (question as any).metadata?.id ?? printedIndex;

    const isSetItem = !!(question as any).__set; // questão filha — botão fica só no __setBase
    const setParentId = setBaseMeta?.parentId ?? (question as any).__set?.parentId ?? null;

    // Seções de texto para toggles individuais
    const textSections: BaseTextSection[] = isSetBase
      ? (setBaseMeta?.textSections ?? [])
      : baseTextSectionsMeta;

    const labelScopeKey = isSetBase
      ? setBaseMeta?.parentId ?? String(baseKey)
      : String((question as any).metadata?.id ?? baseKey);

    const baseTextSectionsForRender = textSections.map((section) => ({
      ...section,
      hidden: hiddenBaseTextLabels.has(makeBaseTextLabelKey(labelScopeKey, section.id)),
    }));

    const canToggleBaseTextSections = textSections.length > 0 && !isSetItem;
    const handleToggleBaseTextSection = canToggleBaseTextSections
      ? (textId: string) => toggleBaseTextLabel(labelScopeKey, textId)
      : undefined;

    const fragKey =
      frag?.kind === "frag"
        ? `${baseKey}__frag_${frag.from}_${frag.to}_${frag.first ? 1 : 0}`
        : `${baseKey}`;

    // Buscar permutação para esta questão
    const questionId = (question as any).metadata?.id;
    const permutation = tiposGerados && questionId
      ? tiposGerados[tipoAtual - 1]?.permutations.find(p => p.questionId === questionId)?.permutation ?? null
      : null;

    // Mesclar lineMaps de todos os textos base associados a esta questão
    const questionLineMap = (() => {
      const btIds: string[] = (() => {
        const meta = (question as any).metadata ?? {};
        if (Array.isArray(meta.baseTextIds)) return meta.baseTextIds;
        if (meta.baseTextId) return [meta.baseTextId];
        // Para setBase, pegar IDs das textSections
        return textSections.map((s) => s.id);
      })();
      if (btIds.length === 0) return null;
      const merged = { "2col": {} as Record<string, number>, "1col": {} as Record<string, number>, "acessivel": {} as Record<string, number> };
      for (const btId of btIds) {
        const bt = baseTextCache.get(btId) as any;
        const lm = bt?.lineMap;
        if (!lm) continue;
        for (const key of ["2col", "1col", "acessivel"] as const) {
          if (lm[key]) Object.assign(merged[key], lm[key]);
        }
      }
      return merged;
    })();

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
      } else if (N != null) {
        // Blocos de texto apenas (sem opções neste fragmento): texto base, discursiva, etc.
        return {
          textBlocks: Array.from({ length: to - from + 1 }, (_, i) => from + i),
          options: [],
        };
      } else {
        // N indefinido: no primeiro fragmento renderiza tudo; nos seguintes usa from/to como índices de texto
        if (frag.first) {
          return undefined;
        } else {
          return {
            textBlocks: Array.from({ length: to - from + 1 }, (_, i) => from + i),
            options: [],
          };
        }
      }
    })();

    return (
      <div
        key={fragKey}
        className="questao-item-wrapper allow-break"
        data-q-index={globalIndex}
        data-q-id={questionId ?? ""}
        data-set-parent-id={setParentId ?? undefined}
        data-is-set-base={isSetBase ? "1" : "0"}
        data-frag-kind={frag?.kind ?? "full"}
        data-frag-from={frag?.from}
        data-frag-to={frag?.to}
        data-frag-first={frag?.first ? "1" : "0"}
        data-frag-info={frag ? `from=${frag.from} to=${frag.to} N=${frag.textBlockCount ?? 'none'} first=${frag.first}` : undefined}
      >
        {/* ✅ item do texto base: banner + conteúdo, sem cabeçalho de questão */}
{isSetBase ? (
  <div className="mb-3 space-y-2">
    {( !frag || frag.first ) && setBaseMeta?.headerText && (
      <div className="text-sm font-semibold print:block">{setBaseMeta.headerText}</div>
    )}

    <div
      className="
        questao-conteudo
        [&_p]:!m-0
        [&_p]:!p-0
        [&_img]:!my-0
      "
    >
      <QuestionRenderer content={(question as any).content} fragmentRender={fragmentRender} permutation={permutation} imageWidthProp={committedImageWidths} onImageResizeCommit={handleImageResizeCommit} dataBoxWidthProp={questionId ? getDataBoxWidthProp(questionId) : {}} onDataBoxWidthCommit={questionId ? makeDataBoxWidthCommit(questionId) : undefined} inlineOptions={inlineOptionsSet.has(questionId ?? "")} onToggleInlineOptions={questionId ? () => handleToggleInlineOptions(questionId) : undefined} baseTextSections={baseTextSectionsForRender} onToggleBaseTextSection={handleToggleBaseTextSection} lineMap={questionLineMap} layoutKey={layoutKey} />
    </div>
  </div>
) : (
          <div className="questao-item">
            {(!frag || frag.first) && (
              <div className="questao-header-linha">
                {provaConfig.layoutType === "acessivel" ? (
                  <div className="accessible-question-number">
                    QUESTÃO {printedIndex + 1}
                  </div>
                ) : (
                  <QuestionHeaderSvg
                    numero={printedIndex + 1}
                    totalMm={columns === 2 ? 85 : 180}
                    boxMm={28}
                    variant={provaConfig.questionHeaderVariant ?? 0}
                  />
                )}
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
              <QuestionRenderer content={(question as any).content} fragmentRender={fragmentRender} permutation={permutation} imageWidthProp={committedImageWidths} onImageResizeCommit={handleImageResizeCommit} dataBoxWidthProp={questionId ? getDataBoxWidthProp(questionId) : {}} onDataBoxWidthCommit={questionId ? makeDataBoxWidthCommit(questionId) : undefined} inlineOptions={inlineOptionsSet.has(questionId ?? "")} onToggleInlineOptions={questionId ? () => handleToggleInlineOptions(questionId) : undefined} baseTextSections={baseTextSectionsForRender} onToggleBaseTextSection={handleToggleBaseTextSection} lineMap={questionLineMap} layoutKey={layoutKey} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const LayoutComponent =
    provaConfig.layoutType === "acessivel" ? AccessibleLayout :
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
        <Button onClick={() => router.push("/editor/questoes?from=montar")}>
          Voltar para seleção
        </Button>
      </div>
    );
  }

  return (
    <>
      <PaginatedA4 className="SEU_WRAPPER_ATUAL_DO_A4">
        <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex flex-wrap items-center gap-x-2 gap-y-2 justify-between border-b px-4 py-3" style={{ background: 'var(--yellow-brand)' }}>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/editor/questoes?from=montar")} className="bg-white hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            <Button variant="outline" onClick={handleEditarConfiguracao} className="bg-white hover:bg-slate-50">
              <Settings className="h-4 w-4 mr-2" />
              Configuração
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">

            {isQuimica && (
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-md">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTabelaPeriodica((v) => !v)}
                  className={`h-6 text-xs px-2 ${showTabelaPeriodica ? "bg-emerald-200" : ""}`}
                >
                  {showTabelaPeriodica ? <CheckSquare className="h-3 w-3 mr-1" /> : <Square className="h-3 w-3 mr-1" />}
                  Tab. Periódica
                </Button>
                {showTabelaPeriodica && (
                  <select
                    value={tabelaPeriodicaSize}
                    onChange={(e) => setTabelaPeriodicaSize(e.target.value as TabelaSize)}
                    className="px-1.5 py-0.5 border rounded text-xs"
                  >
                    <option value="a4-landscape">A4 paisagem</option>
                    <option value="meia-folha">Meia folha</option>
                  </select>
                )}
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => updateProvaConfig({ showGabarito: !provaConfig.showGabarito })}
              className="bg-white hover:bg-slate-50"
            >
              {provaConfig.showGabarito ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Gabarito
            </Button>

            <Button variant="outline" onClick={() => setReorderModalOpen(true)} className="bg-white hover:bg-slate-50">
              <ListOrdered className="h-4 w-4 mr-2" />
              Reordenar
              {manualOrder && (
                <span className="ml-1 text-[9px] text-slate-500">(manual)</span>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => setSalvarDialogOpen(true)}
              disabled={initialQuestions.length === 0}
              className="bg-white hover:bg-slate-50"
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

            <Button
              variant="outline"
              onClick={() => setRepaginateVersion(v => v + 1)}
              className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
              title="Re-paginar"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Repaginar
            </Button>

            <DevDebugTools
              enabled={devMontarDebugEnabled}
              onEnabledChange={setDevMontarDebugEnabled}
              storageKey="pmeditor:montar-debug"
              snapshotKey="__PMEDITOR_MONTAR_DEBUG__"
              filePrefix="montar-debug"
              title="Debug do montar"
            />

            <Button onClick={handlePrint} className="btn-primary">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        <div className="print:hidden h-[130px] sm:h-[104px] lg:h-[60px]" />

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

        {showTabelaPeriodica && (
          <div className={tabelaPeriodicaSize === "a4-landscape" ? "a4-sheet bg-gray-100 print:bg-white py-4 print:py-0" : "a4-sheet bg-gray-100 print:bg-white py-4 print:py-0 flex justify-center"}>
            <TabelaPeriodica size={tabelaPeriodicaSize} />
          </div>
        )}

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
