"use client";

/**
 * BaseTextMeasurer
 *
 * Renderiza o conteúdo de um texto base em 3 containers ocultos com as
 * larguras canônicas dos layouts da prova. Após cada atualização de conteúdo
 * (debounced), mede em que linha cada text_anchor cai em cada layout e
 * chama onMeasure com o CanonicalLineMap resultante.
 *
 * Larguras canônicas (de prova.css):
 *   2col      → 8.5cm   (--col-width)
 *   1col      → 18cm    (--questoes-width)
 *   acessivel → 17cm    (max-width do .accessible-page .coluna)
 *
 * Tipografia canônica:
 *   2col / 1col → Arial 10pt, line-height normal (igual ao .prova-page)
 *   acessivel   → Arial 12.5pt, line-height 1.5  (igual ao .accessible-page)
 */

import { useEffect, useRef } from "react";
import { measureAnchors, type CanonicalLineMap } from "@/lib/lineRefMeasure";
import { renderBaseTextDoc } from "./renderBaseTextDoc";

type Props = {
  content: any; // ProseMirror doc JSON
  onMeasure: (map: CanonicalLineMap) => void;
  debounceMs?: number;
};

export function BaseTextMeasurer({ content, onMeasure, debounceMs = 350 }: Props) {
  const ref2col = useRef<HTMLDivElement>(null);
  const ref1col = useRef<HTMLDivElement>(null);
  const refAcessivel = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const el2col = ref2col.current;
      const el1col = ref1col.current;
      const elAcess = refAcessivel.current;
      if (!el2col || !el1col || !elAcess) return;

      onMeasure({
        "2col": measureAnchors(el2col),
        "1col": measureAnchors(el1col),
        "acessivel": measureAnchors(elAcess),
      });
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, debounceMs, onMeasure]);

  const rendered = renderBaseTextDoc(content);

  return (
    <div aria-hidden style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* 2 colunas: 8.5cm, Arial 10pt */}
      <div
        ref={ref2col}
        style={{ width: "8.5cm", fontFamily: "Arial, sans-serif", fontSize: "10pt", lineHeight: "normal" }}
      >
        {rendered}
      </div>

      {/* 1 coluna: 18cm, Arial 10pt */}
      <div
        ref={ref1col}
        style={{ width: "18cm", fontFamily: "Arial, sans-serif", fontSize: "10pt", lineHeight: "normal" }}
      >
        {rendered}
      </div>

      {/* Acessível: 17cm, Arial 12.5pt, line-height 1.5 */}
      <div
        ref={refAcessivel}
        style={{ width: "17cm", fontFamily: "Arial, sans-serif", fontSize: "12.5pt", lineHeight: "1.5" }}
      >
        {rendered}
      </div>
    </div>
  );
}
