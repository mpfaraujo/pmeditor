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

  // contagem real de opções (2..5); se não vier, deriva do doc
  optionsCount?: number;
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

  const optionsCountFromDoc = (() => {
    let n = 0;
    state.doc.descendants((node) => {
      if (node.type === schema.nodes.option) n += 1;
    });
    return n;
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
    const widthPx = Math.round(widthCm * 37.8);
    const image = schema.nodes.image.create({ src: url, width: widthPx.toString() });
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
    const id = (loadId as string | undefined) ?? (window.prompt("ID para carregar:") ?? "").trim();
    if (!id) return;
    const res = await getQuestion(id);
    if (!res?.content) {
      window.alert("Resposta sem content.");
      return;
    }
    const node = schema.nodeFromJSON(res.content);
    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, node.content);
    view.dispatch(tr);
    view.focus();
    if (res?.metadata && onLoadedMetadata) onLoadedMetadata(res.metadata);
    window.alert(`Carregado: ${id}`);
  };

  const handleAction = (action: string) => {
    // ações externas (tipo/largura/opções)
    if (
      action === "set-type-discursiva" ||
      action === "set-type-multipla" ||
      action === "set-width-narrow" ||
      action === "set-width-wide" ||
      action === "inc-options" ||
      action === "dec-options"
    ) {
      onAction?.(action);
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
