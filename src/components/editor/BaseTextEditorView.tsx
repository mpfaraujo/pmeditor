"use client";

// Editor de texto base = o editor único (BlocosEditor) com conversão de/para o
// node base_text que vai pro banco. Não tem barra nem plugins próprios.

import { useCallback, useMemo } from "react";
import { BlocosEditor } from "./BlocosEditor";

/** doc do editor (doc > question > statement) → base_text para salvar. Mantido por compatibilidade. */
export function docToBaseTextContent(doc: any): any {
  const blocks = doc?.content?.[0]?.content?.[0]?.content ?? [];
  return { type: "base_text", content: blocks };
}

interface BaseTextEditorViewProps {
  /** base_text node JSON (content armazenado no banco) */
  value?: any;
  onSave: (baseTextContent: any) => void;
  onChange?: (baseTextContent: any) => void;
  closeAfterSave?: boolean;
  saving?: boolean;
}

export function BaseTextEditorView({ value, onSave, onChange, saving = false }: BaseTextEditorViewProps) {
  // Referência estável: o editor só é recriado quando o conteúdo de origem muda
  const blocks = useMemo(() => (value?.content ?? null) as any[] | null, [value]);

  const handleChange = useCallback(
    (b: any[]) => onChange?.({ type: "base_text", content: b }),
    [onChange],
  );

  return (
    <BlocosEditor
      blocks={blocks}
      onChange={onChange ? handleChange : undefined}
      onSave={(b) => onSave({ type: "base_text", content: b })}
      saving={saving}
      placeholder="Conteúdo do texto base…"
    />
  );
}
