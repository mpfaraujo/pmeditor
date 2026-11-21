// src/components/editor/BlocosEditor.tsx
"use client";

// Editor de conteúdo "solto" (texto base, resposta-modelo, resolução).
// É o MESMO editor da questão: mesmos plugins (editorCore), mesma barra
// (EditorToolbar), mesma folha. Só esconde o que é exclusivo de questão
// (alternativas, tipo, conjunto, abrir/novo, informações).

import { useEffect, useRef, useState } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { schema } from "./schema";
import { EditorToolbar } from "./EditorToolbar";
import { MathInsert } from "./MathInsert";
import { ensureImageIds } from "./ensureImageIds";
import {
  buildEditorPlugins,
  editorNodeViews,
  mathAtDblClick,
  upsertMathInline,
  blocksToEditorDoc,
  editorDocToBlocks,
} from "./editorCore";
import "../../app/prosemirror.css";

type MathDialog = { open: false } | { open: true; pos: number | null; latex: string };

export interface BlocosEditorProps {
  /** Blocos iniciais (paragraph, poem, image…). O editor é recriado quando a referência muda. */
  blocks?: any[] | null;
  onChange?: (blocks: any[]) => void;
  /** Sem onSave, o botão Salvar não aparece. */
  onSave?: (blocks: any[]) => void;
  saving?: boolean;
  placeholder?: string;
  /** Classe extra no contêiner da folha. */
  className?: string;
}

export function BlocosEditor({ blocks, onChange, onSave, saving = false, placeholder, className }: BlocosEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const toolbarCallbackRef = useRef<(() => void) | null>(null);
  const [mathDialog, setMathDialog] = useState<MathDialog>({ open: false });

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!editorRef.current) return;

    let doc;
    try {
      doc = schema.nodeFromJSON(blocksToEditorDoc(blocks));
    } catch {
      doc = schema.nodeFromJSON(blocksToEditorDoc(null));
    }

    const plugins = buildEditorPlugins({
      placeholder: placeholder ?? "Digite aqui...",
      onMathShortcut: () => setMathDialog({ open: true, pos: null, latex: "" }),
      toolbarCallbackRef,
    });

    const ev = new EditorView(editorRef.current, {
      state: EditorState.create({ doc, plugins }),
      nodeViews: editorNodeViews,
      handleDOMEvents: {
        dblclick(v, e) {
          const hit = mathAtDblClick(v, e);
          if (!hit) return false;
          setMathDialog({ open: true, pos: hit.pos, latex: hit.latex });
          return true;
        },
      },
      dispatchTransaction(tr) {
        const ns = ev.state.apply(tr);
        ev.updateState(ns);
        if (tr.docChanged) onChangeRef.current?.(editorDocToBlocks(ns.doc.toJSON()));
      },
    });

    setView(ev);
    onChangeRef.current?.(editorDocToBlocks(ev.state.doc.toJSON()));

    return () => {
      ev.destroy();
      setView(null);
    };
    // placeholder é estável na prática; recria só quando o conteúdo inicial muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const handleSave = () => {
    if (!view || !onSave) return;
    const doc = ensureImageIds(view.state.doc, view.state.schema);
    onSave(editorDocToBlocks(doc.toJSON()));
  };

  return (
    <div className={className}>
      <div className="mb-2 bg-white rounded-lg shadow p-2 border-b border-blue-100 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <EditorToolbar
            view={view}
            variant="blocos"
            toolbarCallbackRef={toolbarCallbackRef}
            onOpenMath={() => setMathDialog({ open: true, pos: null, latex: "" })}
            onSave={onSave ? handleSave : undefined}
          />
        </div>
        {saving ? <span className="text-xs text-slate-500 shrink-0">Salvando…</span> : null}
      </div>

      <div className="overflow-x-auto pb-4">
        <div
          ref={editorRef}
          className="question-editor-sheet base-text-editor focus:outline-none shadow-2xl mx-auto bg-white"
          style={{ width: "210mm" }}
        />
      </div>

      <MathInsert
        open={mathDialog.open}
        onOpenChange={(o) => {
          if (!o) setMathDialog({ open: false });
        }}
        onInsert={(latex) => {
          if (view) upsertMathInline(view, latex, mathDialog.open ? mathDialog.pos : null);
          setMathDialog({ open: false });
        }}
        initialLatex={mathDialog.open ? mathDialog.latex : undefined}
        title={mathDialog.open && mathDialog.pos != null ? "Editar fórmula" : "Inserir fórmula"}
      />
    </div>
  );
}
