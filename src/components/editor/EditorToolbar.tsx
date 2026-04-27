// src/components/editor/EditorToolbar.tsx
"use client";

import { useState, useEffect } from "react";
import { EditorView } from "prosemirror-view";
import { toggleMark } from "prosemirror-commands";
import { undo as undoCommand, redo as redoCommand } from "prosemirror-history";
import { schema } from "./schema";
import { resolverRefs, injectLineNumbers } from "@/lib/lineRefMeasure";
import { ImageUpload } from "./ImageUpload";
import { SymbolPicker } from "./toolbar/SymbolPicker";
import { HorizontalToolbar } from "./toolbar/HorizontalToolbar";
import { createQuestion, getQuestion } from "@/lib/questions";
import { wrapInList } from "prosemirror-schema-list";
import { buildPoemFromSelection } from "./poemUtils";

interface EditorToolbarProps {
  view: EditorView | null;
  toolbarCallbackRef?: { current: (() => void) | null };
  onOpenMath?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  onNew?: () => void;
  onRecover?: () => void;
  onOpenMetadata?: () => void;
  metadata?: any;
  loadId?: string;
  onLoadedMetadata?: (nextMetadata: any) => void;

  // ações extras (tipo/largura/opções) tratadas fora da toolbar
  onAction?: (action: string) => void;
  onPreview?: () => void;

  // contagem real de opções (2..5); se não vier, deriva do container atual
  optionsCount?: number;

  // estado de conjunto
  isSetQuestions?: boolean;
  itemCount?: number;

  // lista de âncoras disponíveis (ex.: textos-base vinculados)
  availableAnchors?: string[];
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function cmToPx(cm: number) {
  return Math.round(cm * 37.8);
}

function pxToCm(px: number) {
  return px ? px / 37.8 : 0;
}

export function EditorToolbar({
  view,
  toolbarCallbackRef,
  onOpenMath,
  onSave,
  onLoad,
  onNew,
  onRecover,
  onOpenMetadata,
  metadata,
  loadId,
  onLoadedMetadata,
  onAction,
  onPreview,
  optionsCount: optionsCountProp,
  isSetQuestions,
  itemCount,
  availableAnchors,
}: EditorToolbarProps) {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!toolbarCallbackRef) return;
    toolbarCallbackRef.current = () => forceUpdate((n) => n + 1);
    return () => { toolbarCallbackRef.current = null; };
  }, [toolbarCallbackRef]);

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkSize = () => setIsDesktop(window.innerWidth >= 1024);
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  if (!view) return null;

  const state = view.state;

  // ===== ÚNICA ALTERAÇÃO REAL =====
  // Antes: contava options no doc inteiro
  // Agora: conta options APENAS no container atual (question ou question_item)
  const optionsCountFromDoc = (() => {
    const $from = state.selection.$from;

    let container: any | null = null;
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.type === schema.nodes.question_item || n.type === schema.nodes.question) {
        container = n;
        break;
      }
    }

    if (!container) return 0;

    let count = 0;
    container.descendants((node: any) => {
      if (node.type === schema.nodes.option) count += 1;
    });
    return count;
  })();

  const optionsCount = Number.isFinite(optionsCountProp as number)
    ? Math.max(0, Math.min(5, Math.floor(optionsCountProp as number)))
    : optionsCountFromDoc;

  // Detecta contexto do cursor para habilitar botões contextuais
  const isInPoem = (() => {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === schema.nodes.poem) return true;
    }
    return false;
  })();

  const isInBaseText = (() => {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === schema.nodes.base_text) return true;
    }
    return false;
  })();

  const isInStatement = (() => {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === schema.nodes.statement) return true;
    }
    return false;
  })();

  const isInTitle = (() => {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === schema.nodes.title) return true;
    }
    return false;
  })();

  const hasMark = (markType: string): boolean => {
    const type = schema.marks[markType];
    if (!type) return false;

    const { from, to, empty, $from } = state.selection;
    if (empty) return !!type.isInSet(state.storedMarks || $from.marks());

    let found = false;
    state.doc.nodesBetween(from, to, (node) => {
      if (type.isInSet(node.marks)) {
        found = true;
        return false;
      }
      return true;
    });
    return found;
  };

  const isNumbered = (() => {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (
        node.type === schema.nodes.poem ||
        node.type === schema.nodes.base_text ||
        node.type === schema.nodes.statement
      ) {
        return !!node.attrs?.numbered;
      }
    }
    return false;
  })();

  const currentTextAlign = (() => {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (node.type === schema.nodes.paragraph) {
        return (node.attrs?.textAlign as "left" | "center" | "right" | "justify" | null) ?? null;
      }
      if (node.type === schema.nodes.title) return "center" as const;
    }
    return null;
  })();

  const handleToggleMark = (markType: string) => {
    const type = schema.marks[markType];
    if (!type) return;
    toggleMark(type)(view.state, view.dispatch);
    view.focus();
  };

  const handleInsertCodeBlock = () => {
    const codeBlock = schema.nodes.code_block.create();
    view.dispatch(view.state.tr.replaceSelectionWith(codeBlock));
    view.focus();
  };

  const handleInsertDataBox = () => {
    if (!view) return;
    const para = schema.nodes.paragraph.create();
    const dataBox = schema.nodes.data_box.create(null, [para]);
    view.dispatch(view.state.tr.replaceSelectionWith(dataBox));
    view.focus();
  };

  const handleTogglePoem = () => {
    const { $from } = view.state.selection;

    // Se cursor está dentro de poem → desfaz: cada verse vira paragraph
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.type === schema.nodes.poem) {
        const pos = $from.before(d);
        const paragraphs: ReturnType<typeof schema.nodes.paragraph.create>[] = [];
        n.forEach((verse) => {
          paragraphs.push(schema.nodes.paragraph.create(null, verse.content));
        });
        view.dispatch(view.state.tr.replaceWith(pos, pos + n.nodeSize, paragraphs));
        view.focus();
        return;
      }
    }

    // Não está em poem → converte / insere
    const selectionPoem = buildPoemFromSelection(view.state, schema);
    if (selectionPoem) {
      view.dispatch(view.state.tr.replaceSelectionWith(selectionPoem));
      view.focus();
      return;
    }

    // Sem seleção: converte o textblock atual inteiro em poem+verse
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.isTextblock) {
        const blockStart = $from.before(d);
        const verse = schema.nodes.verse.create(null, n.content);
        const poem = schema.nodes.poem.create(null, [verse]);
        view.dispatch(view.state.tr.replaceWith(blockStart, blockStart + n.nodeSize, poem));
        view.focus();
        return;
      }
    }

    // Fallback: insere poem vazio
    const verse = schema.nodes.verse.create();
    const poem = schema.nodes.poem.create(null, [verse]);
    view.dispatch(view.state.tr.replaceSelectionWith(poem));
    view.focus();
  };

  // Remove o mark text_anchor da seleção (ou do trecho marcado sob o cursor)
  const handleRemoveAnchor = () => {
    const { from, to, empty } = view.state.selection;

    if (empty) {
      // Sem seleção: expande até os limites do mark sob o cursor
      const $pos = view.state.doc.resolve(from);
      const mark = $pos.marks().find((m) => m.type === schema.marks.text_anchor);
      if (!mark) {
        window.alert("Cursor não está sobre uma expressão marcada.");
        return;
      }
      // Busca início e fim do mark contíguo
      let start = from;
      let end = from;
      view.state.doc.nodesBetween(0, view.state.doc.content.size, (node, pos) => {
        if (node.isText && node.marks.some((m) => m.type === schema.marks.text_anchor && m.attrs.id === mark.attrs.id)) {
          start = Math.min(start, pos);
          end = Math.max(end, pos + node.nodeSize);
        }
      });
      view.dispatch(view.state.tr.removeMark(start, end, schema.marks.text_anchor));
    } else {
      view.dispatch(view.state.tr.removeMark(from, to, schema.marks.text_anchor));
    }
    view.focus();
  };

  // Marca o texto selecionado como âncora de linha (text_anchor mark)
  const handleMarkAnchor = () => {
    const { from, to } = view.state.selection;
    if (from === to) {
      window.alert("Selecione o texto que deseja marcar como referência de linha.");
      return;
    }
    const selectedText = view.state.doc.textBetween(from, to);
    const suggested = selectedText
      .slice(0, 40)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const id = window.prompt("Nome da referência (ID):", suggested);
    if (!id?.trim()) return;
    const mark = schema.marks.text_anchor.create({ id: id.trim() });
    view.dispatch(view.state.tr.addMark(from, to, mark));
    view.focus();
  };

  // Insere um node line_ref na posição do cursor
  const handleInsertLineRef = () => {
    // Coleta âncoras disponíveis: props externas + âncoras do próprio doc
    const fromProp = availableAnchors ?? [];
    const fromDoc: string[] = [];
    view.state.doc.descendants((node) => {
      node.marks?.forEach((mark) => {
        if (
          mark.type === schema.marks.text_anchor &&
          mark.attrs.id &&
          !fromDoc.includes(mark.attrs.id)
        ) {
          fromDoc.push(mark.attrs.id);
        }
      });
    });
    const anchors = Array.from(new Set([...fromProp, ...fromDoc]));

    if (anchors.length === 0) {
      window.alert(
        "Nenhuma expressão marcada encontrada.\nMarque uma expressão no texto-base primeiro."
      );
      return;
    }

    const choices = anchors.map((a, i) => `${i + 1}. ${a}`).join("\n");
    const input = window.prompt(`Qual referência inserir?\n\n${choices}\n\nDigite o número ou o ID:`);
    if (!input?.trim()) return;

    const num = parseInt(input.trim());
    const anchorId =
      Number.isFinite(num) && num >= 1 && num <= anchors.length
        ? anchors[num - 1]
        : input.trim();

    const lineRef = schema.nodes.line_ref.create({ anchorId });
    view.dispatch(view.state.tr.replaceSelectionWith(lineRef));
    view.focus();
  };

  const handleInsertCredits = () => {
    const { $from } = view.state.selection;
    // Converte o textblock atual em credits
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.isTextblock) {
        const blockStart = $from.before(d);
        const credits = schema.nodes.credits.create(null, n.content);
        view.dispatch(view.state.tr.replaceWith(blockStart, blockStart + n.nodeSize, credits));
        view.focus();
        return;
      }
    }
    // Fallback: insere credits vazio
    const credits = schema.nodes.credits.create();
    view.dispatch(view.state.tr.replaceSelectionWith(credits));
    view.focus();
  };

  const handleToggleNumbered = () => {
    const $from = view.state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (
        node.type === schema.nodes.poem ||
        node.type === schema.nodes.base_text ||
        node.type === schema.nodes.statement
      ) {
        const pos = $from.before(d);
        const newNumbered = !node.attrs.numbered;
        view.dispatch(
          view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, numbered: newNumbered })
        );
        // Injeta/remove labels de linha no editor após o layout estabilizar
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolverRefs(view.dom as HTMLElement);
            injectLineNumbers(view.dom as HTMLElement);
          });
        });
        view.focus();
        return;
      }
    }
  };

  // Toggle título: converte parágrafo corrente ↔ title
  const handleToggleTitle = () => {
    const $from = view.state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      const pos = $from.before(d);
      if (node.type === schema.nodes.title) {
        // title → paragraph
        view.dispatch(
          view.state.tr.setNodeMarkup(pos, schema.nodes.paragraph, {
            textAlign: "center",
          })
        );
        view.focus();
        return;
      }
      if (node.isTextblock) {
        // paragraph/verse → title
        view.dispatch(
          view.state.tr.setNodeMarkup(pos, schema.nodes.title, {})
        );
        view.focus();
        return;
      }
    }
  };

  const handleInsertBaseText = () => {
    let hasBaseText = false;
    state.doc.descendants((node) => {
      if (node.type === schema.nodes.base_text) {
        hasBaseText = true;
        return false;
      }
    });
    if (hasBaseText) return;

    const baseText = schema.nodes.base_text.create(null, [schema.nodes.paragraph.create()]);
    view.dispatch(view.state.tr.insert(1, baseText));
    view.focus();
  };

  const handleUndo = () => {
    undoCommand(view.state, view.dispatch);
    view.focus();
  };

  const handleRedo = () => {
    redoCommand(view.state, view.dispatch);
    view.focus();
  };

const handleImageInsert = (url: string, widthCm: number, id?: string) => {
  const widthPx = cmToPx(widthCm);
  const image = schema.nodes.image.create({
    id: id ?? null,
    src: url,
    width: widthPx.toString(),
  });
  view.dispatch(view.state.tr.replaceSelectionWith(image));
  view.focus();
};


  const handleSymbolInsert = (symbol: string) => {
    const text = schema.text(symbol);
    view.dispatch(view.state.tr.replaceSelectionWith(text));
    view.focus();
  };

  const handleSaveApi = async () => {
    const id =
      (metadata?.id as string | undefined) ??
      (window.prompt("ID da questão (ex.: q_123):") ?? "").trim();
    if (!id) return;
    const payload = { metadata: metadata ?? { id }, content: view.state.doc.toJSON() };
    const res = await createQuestion(payload);
    window.alert(`Salvo: ${res?.id ?? id}`);
  };

  const handleLoadApi = async () => {
    const id =
      (loadId as string | undefined) ??
      (window.prompt("ID para carregar:") ?? "").trim();
    if (!id) return;

    const res: any = await getQuestion(id);

    // FIX: backend get.php responde { success:true, item:{ metadata, content, ... } }
    // mantém compatibilidade se getQuestion já "achatar" para { metadata, content }
    const item = (res && typeof res === "object" && "item" in res ? (res as any).item : res) as any;

    const content = item?.content ?? null;
    if (!content) {
      window.alert("Resposta sem content.");
      return;
    }

    const node = schema.nodeFromJSON(content);

    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, node.content);
    view.dispatch(tr);
    view.focus();

    const nextMeta = item?.metadata ?? null;
    if (nextMeta && onLoadedMetadata) onLoadedMetadata(nextMeta);

    window.alert(`Carregado: ${id}`);
  };

  // ---------- helpers: localizar imagem selecionada ----------
  const findSelectedImage = (): { pos: number; node: any } | null => {
    const { selection } = view.state;
    const { from, to } = selection;

    let found: { pos: number; node: any } | null = null;

    view.state.doc.nodesBetween(from, to, (node, pos) => {
      if (found) return false;
      if (node.type === schema.nodes.image) {
        found = { pos, node };
        return false;
      }
      return true;
    });

    if (!found && from === to) {
      const $pos = view.state.doc.resolve(from);
      const after = $pos.nodeAfter;
      const before = $pos.nodeBefore;

      if (after && after.type === schema.nodes.image) found = { pos: from, node: after };
      else if (before && before.type === schema.nodes.image)
        found = { pos: from - before.nodeSize, node: before };
    }

    return found;
  };

  // ---------- imagem: largura 1..8 cm ----------
  const adjustSelectedImageWidth = (deltaCm: number) => {
    const img = findSelectedImage();
    if (!img) return;

    const curPx = Number(img.node.attrs?.width ?? 0);
    const curCm = curPx ? pxToCm(curPx) : 0;

    const nextCm = clampInt((curCm || 1) + deltaCm, 1, 8);
    const nextPx = cmToPx(nextCm);

    const tr = view.state.tr.setNodeMarkup(img.pos, undefined, {
      ...img.node.attrs,
      width: String(nextPx),
    });

    view.dispatch(tr);
    view.focus();
  };

  // ---------- alinhamento: imagem OU parágrafos ----------
  const applyAlign = (align: "left" | "center" | "right" | "justify") => {
    const img = findSelectedImage();
    if (img) {
      if (align === "justify") return;
      const tr = view.state.tr.setNodeMarkup(img.pos, undefined, {
        ...img.node.attrs,
        align,
      });
      view.dispatch(tr);
      view.focus();
      return;
    }

    const { from, to } = view.state.selection;
    let tr = view.state.tr;
    let changed = false;

    view.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type === schema.nodes.paragraph) {
        if (node.attrs?.textAlign !== align) {
          tr = tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            textAlign: align,
          });
          changed = true;
        }
      }
      return true;
    });

    if (!changed && from === to) {
      const $pos = view.state.doc.resolve(from);
      for (let d = $pos.depth; d > 0; d--) {
        const n = $pos.node(d);
        if (n.type === schema.nodes.paragraph) {
          const pos = $pos.before(d);
          tr = tr.setNodeMarkup(pos, undefined, {
            ...n.attrs,
            textAlign: align,
          });
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      view.dispatch(tr);
      view.focus();
    }
  };

  const handleAction = (action: string) => {
    // ações externas (tipo/largura/opções)
    if (
      action === "set-type-discursiva" ||
      action === "set-type-multipla" ||
      action === "set-width-narrow" ||
      action === "set-width-wide" ||
      action === "inc-options" ||
      action === "dec-options" ||
      action === "toggle-options" ||
      action === "convert-to-setquestions" ||
      action === "add-question-item" ||
      action === "remove-question-item"
    ) {
      onAction?.(action);
      return;
    }

    if (action === "img-w-dec") {
      adjustSelectedImageWidth(-1);
      return;
    }
    if (action === "img-w-inc") {
      adjustSelectedImageWidth(1);
      return;
    }

    if (
      action === "align-left" ||
      action === "align-center" ||
      action === "align-right" ||
      action === "align-justify"
    ) {
      applyAlign(action.replace("align-", "") as any);
      return;
    }

    if (action.startsWith("mark:")) {
      handleToggleMark(action.replace("mark:", ""));
      return;
    }

    switch (action) {
      case "new":
        onNew?.();
        break;
      case "load":
        onLoad ? onLoad() : void handleLoadApi();
        break;
      case "save":
        onSave ? onSave() : void handleSaveApi();
        break;
      case "recover":
        onRecover?.();
        break;
      case "metadata":
        onOpenMetadata?.();
        break;
      case "undo":
        handleUndo();
        break;
      case "redo":
        handleRedo();
        break;
      case "image":
        setImageDialogOpen(true);
        break;
      case "math":
        onOpenMath?.();
        break;
      case "codeblock":
        handleInsertCodeBlock();
        break;
      case "basetext":
        onAction?.("basetext");
        break;
      case "symbols":
        setSymbolPickerOpen(true);
        break;
      case "insert-poem":
        handleTogglePoem();
        break;
      case "mark-anchor":
        handleMarkAnchor();
        break;
      case "remove-anchor":
        handleRemoveAnchor();
        break;
      case "insert-line-ref":
        handleInsertLineRef();
        break;
      case "insert-credits":
        handleInsertCredits();
        break;
      case "insert-databox":
        handleInsertDataBox();
        break;
      case "toggle-numbered":
        handleToggleNumbered();
        break;
      case "toggle-title":
        handleToggleTitle();
        break;
      case "preview":
        onPreview?.();
        break;
      case "insert-bullet-list":
        wrapInList(schema.nodes.bullet_list)(view.state, view.dispatch);
        view.focus();
        break;
      case "insert-ordered-list":
        wrapInList(schema.nodes.ordered_list)(view.state, view.dispatch);
        view.focus();
        break;
      case "insert-roman-list":
        wrapInList(schema.nodes.roman_list)(view.state, view.dispatch);
        view.focus();
        break;
      case "insert-alpha-list":
        wrapInList(schema.nodes.alpha_list)(view.state, view.dispatch);
        view.focus();
        break;
      case "insert-assertive-list":
        wrapInList(schema.nodes.assertive_list)(view.state, view.dispatch);
        view.focus();
        break;
    }
  };

  return (
    <>
          <HorizontalToolbar
            onAction={handleAction}
            optionsCount={optionsCount}
            isSetQuestions={isSetQuestions ?? false}
            itemCount={itemCount ?? 0}
            isInPoem={isInPoem}
            isInBaseText={isInBaseText || isInStatement}
            isInTitle={isInTitle}
            isNumbered={isNumbered}
            textAlign={currentTextAlign}
            activeMarks={{
              strong: hasMark("strong"),
              em: hasMark("em"),
              underline: hasMark("underline"),
              superscript: hasMark("superscript"),
              subscript: hasMark("subscript"),
            }}
          />


      <ImageUpload
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onImageInsert={handleImageInsert}
      />

      <SymbolPicker
        open={symbolPickerOpen}
        onOpenChange={setSymbolPickerOpen}
        onSelect={handleSymbolInsert}
      />
    </>
  );
}
