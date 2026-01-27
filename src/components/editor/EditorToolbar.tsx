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
}

const LETTERS = ["A", "B", "C", "D", "E"] as const;

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
}: EditorToolbarProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Detectar tamanho da tela
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const checkSize = () => setIsDesktop(window.innerWidth >= 1024);
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  if (!view) return null;

  const state = view.state;

  const getOptionsInfo = (): { pos: number | null; node: any | null } => {
    let pos: number | null = null;
    let node: any | null = null;
    state.doc.descendants((n, p) => {
      if (n.type === schema.nodes.options) {
        pos = p;
        node = n;
        return false;
      }
    });
    return { pos, node };
  };

  const getExistingOptionsByLetter = () => {
    const map = new Map<string, any>();
    state.doc.descendants((n) => {
      if (n.type === schema.nodes.option) {
        const letter = (n.attrs?.letter || "").toString();
        if (letter) map.set(letter, n);
      }
    });
    return map;
  };

  const hasOptionE = (() => {
    let found = false;
    state.doc.descendants((node) => {
      if (node.type === schema.nodes.option && node.attrs.letter === "E") {
        found = true;
        return false;
      }
    });
    return found;
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

const handleInsertBaseText = () => {
  let hasBaseText = false;
  state.doc.descendants((node) => {
    if (node.type === schema.nodes.base_text) {
      hasBaseText = true;
      return false;
    }
  });
  if (hasBaseText) return;

  const baseText = schema.nodes.base_text.create(null, [
    schema.nodes.paragraph.create(),  // SEM texto
  ]);

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

  const normalizeOptions = (targetCount: 4 | 5) => {
    const info = getOptionsInfo();
    const pos = info.pos;
    const optionsNode = info.node;
    if (pos == null || !optionsNode) return;

    const existing = getExistingOptionsByLetter();
    const children = (LETTERS.slice(0, targetCount) as readonly string[]).map((letter) => {
      const found = existing.get(letter);
      if (found) {
        return schema.nodes.option.create({ ...found.attrs, letter }, found.content);
      }
      return schema.nodes.option.create({ letter }, [
        schema.nodes.paragraph.create(null, [schema.text(`Opção ${letter}`)]),
      ]);
    });

    const newOptions = schema.nodes.options.create(optionsNode.attrs ?? null, children);
    const from = pos;
    const to = pos + (optionsNode.nodeSize as number);
    const tr = view.state.tr.replaceWith(from, to, newOptions);
    view.dispatch(tr);
    view.focus();
  };

  const handleSaveApi = async () => {
    const id = (metadata?.id as string | undefined) ?? (window.prompt("ID da questão (ex.: q_123):") ?? "").trim();
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
    if (res?.metadata && onLoadedMetadata) {
      onLoadedMetadata(res.metadata);
    }
    window.alert(`Carregado: ${id}`);
  };

  const handleAction = (action: string) => {
    // Marks
    if (action.startsWith("mark:")) {
      const markType = action.replace("mark:", "");
      handleToggleMark(markType);
      return;
    }

    // Actions
    switch (action) {
      case "new": onNew?.(); break;
      case "load": onLoad ? onLoad() : handleLoadApi(); break;
      case "save": onSave ? onSave() : handleSaveApi(); break;
      case "recover": onRecover?.(); break;
      case "metadata": onOpenMetadata?.(); break;
      case "undo": handleUndo(); break;
      case "redo": handleRedo(); break;
      case "image": setImageDialogOpen(true); break;
      case "math": onOpenMath?.(); break;
      case "codeblock": handleInsertCodeBlock(); break;
      case "basetext": handleInsertBaseText(); break;
      case "symbols": setSymbolPickerOpen(true); break;
      case "toggle-options": 
        const wantFour = !hasOptionE;
        normalizeOptions(wantFour ? 5 : 4); 
        break;
    }
  };

  return (
    <>
      {isDesktop ? (
        <DesktopSidebar onAction={handleAction} hasOptionE={hasOptionE} />
      ) : (
        <HorizontalToolbar onAction={handleAction} hasOptionE={hasOptionE} />
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