"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QuestionRenderer from "@/components/Questions/QuestionRendererProva";
import QuestionHeaderSvg from "@/components/prova/QuestaoHeaderSvg";
import Gabarito from "@/components/prova/Gabarito";
import { ProvaLayout } from "@/components/prova/layouts/ProvaLayout";
import { ExerciseLayout } from "@/components/prova/layouts/ExerciseLayout";


import "../montar/prova.css"; // IMPORTANTE: usa o MESMO CSS do montar (ajuste se o path for outro)

export const PROVA_PRINT_STORAGE_KEY = "__PROVA_PRINT_SNAPSHOT__";

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

export default function ProvaPrintPage() {
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(PROVA_PRINT_STORAGE_KEY);
    if (!raw) return setSnapshot(null);
    try {
      setSnapshot(JSON.parse(raw));
    } catch {
      setSnapshot(null);
    }
  }, []);

  const provaConfig = snapshot?.provaConfig ?? null;
  const logoUrl = snapshot?.logoUrl ?? null;
  const questions = (snapshot?.questions ?? []) as any[];

  const respostas = useMemo(() => {
    const out: Record<number, Alt> = {};
    questions.forEach((q: any, idx: number) => {
      const alt = extractAltFromMetadata(q?.metadata);
      if (alt) out[idx + 1] = alt;
    });
    return out;
  }, [questions]);

  const renderQuestion = (question: any | undefined, globalIndex: number) => {
    if (!question) return null;

    const setMeta = (question as any).__set as
      | {
          parentId: string;
          isFirst: boolean;
          headerText: string;
          baseDoc: any | null;
        }
      | undefined;

    return (
      <div
        key={(question as any).metadata?.id ?? globalIndex}
        className="questao-item-wrapper allow-break"
      >
        {setMeta?.isFirst && (
          <div className="mb-3 space-y-2">
            <div className="text-sm font-semibold">{setMeta.headerText}</div>
            {setMeta.baseDoc ? (
              <div
                className="
                  questao-conteudo
                  [&_p]:!m-0
                  [&_p]:!p-0
                  [&_img]:!my-0
                "
              >
                <QuestionRenderer content={setMeta.baseDoc} />
              </div>
            ) : null}
          </div>
        )}

        <div className="questao-item">
          <div className="questao-header-linha">
            <QuestionHeaderSvg
              numero={globalIndex + 1}
              totalMm={(provaConfig?.columns ?? 2) === 2 ? 85 : 180}
              boxMm={28}
              variant={provaConfig?.questionHeaderVariant ?? 0}
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
      </div>
    );
  };

  useEffect(() => {
    if (!snapshot) return;
    if (runningRef.current) return;
    runningRef.current = true;

    (async () => {
      await import("pagedjs");

      try {
        // @ts-ignore
        if (document.fonts?.ready) await (document as any).fonts.ready;
      } catch {}

      const imgs = Array.from(document.images || []);
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            })
        )
      );

      // @ts-ignore
      if (window.PagedPolyfill?.preview) {
        // @ts-ignore
        await window.PagedPolyfill.preview();
      }

      setReady(true);
    })();
  }, [snapshot]);

  if (!snapshot || !provaConfig) {
    return (
      <div style={{ padding: 16, fontFamily: "Calibri, Arial, sans-serif" }}>
        Snapshot não encontrado. Volte para /editor/prova/montar e clique em Imprimir.
      </div>
    );
  }

  const totalQuestoes = questions.length;

  return (
    <>
      {/* força print-friendly; não “trava” altura */}
      <style>{`
        @page { size: A4; margin: 1.5cm; }
        html, body { margin: 0; padding: 0; }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: Calibri, Arial, sans-serif;
          font-size: 10pt;
          background: #fff;
        }

        .print-controls { position: fixed; top: 12px; right: 12px; z-index: 9999; }
        @media print { .print-controls { display: none !important; } }

        /* ESTE é o fluxo contínuo que o Paged vai paginar */
.print-flow {
  width: auto;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

        .questoes-flow.columns-1 {
          column-count: 1;
          column-gap: 0;
          column-fill: auto;
        }

        .questoes-flow.columns-2 {
          column-count: 2;
          column-gap: 1cm;
          column-fill: auto;
          column-rule: 1px solid #000;
        }
          .questoes-flow.columns-2,
.questoes-flow.columns-1 {
  width: 18cm;
  margin: 0 auto;
}
        /* para columns: cada questão vira bloco dentro da coluna */
        .questoes-flow > .questao-item-wrapper {
          display: inline-block;
          width: 100%;
          break-inside: avoid;
        }

        .questoes-flow > .questao-item-wrapper.allow-break {
          break-inside: auto;
        }
      `}</style>

      <div className="print-controls">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!ready}
          style={{
            padding: "8px 12px",
            fontSize: 12,
            cursor: ready ? "pointer" : "not-allowed",
          }}
        >
          Imprimir
        </button>
      </div>

      <div className="print-flow">
        <div className={`questoes-flow ${provaConfig.columns === 2 ? "columns-2" : "columns-1"}`}>
          {questions.map((q, i) => renderQuestion(q, i))}
        </div>

        {provaConfig.showGabarito && totalQuestoes > 0 && (
          <div style={{ breakBefore: "page", pageBreakBefore: "always", marginTop: "1cm" }}>
            <Gabarito totalQuestoes={totalQuestoes} respostas={respostas} />
          </div>
        )}
      </div>
    </>
  );
}
