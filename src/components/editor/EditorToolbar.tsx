// src/components/editor/EditorToolbar.tsx
"use client";

import { useState, useEffect } from "react";
import { EditorView } from "prosemirror-view";
import { toggleMark } from "prosemirror-commands";
import { undo as undoCommand, redo as redoCommand } from "prosemirror-history";
import { schema } from "./schema";
import { ImageUpload } from "./ImageUpload";
import { SymbolPicker } from "./toolbar/SymbolPicker";
import { DesktopSidebar } from "./toolbar/DesktopSidebar";
import { HorizontalToolbar } from "./toolbar/HorizontalToolbar";
import { createQuestion, getQuestion } from "@/lib/questions";

interface EditorToolbarProps {
  view: EditorView | null;
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

  // contagem real de opções (2..5); se não vier, deriva do container atual
  optionsCount?: number;
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
  optionsCount: optionsCountProp,
}: EditorToolbarProps) {
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

  const handleImageInsert = (url: string, widthCm: number) => {
    const widthPx = cmToPx(widthCm);
    const image = schema.nodes.image.create({
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
        handleInsertBaseText();
        break;
      case "symbols":
        setSymbolPickerOpen(true);
        break;
    }
  };

  return (
    <>
      {isDesktop ? (
        <DesktopSidebar onAction={handleAction} optionsCount={optionsCount} />
      ) : (
        <HorizontalToolbar onAction={handleAction} optionsCount={optionsCount} />
      )}

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
