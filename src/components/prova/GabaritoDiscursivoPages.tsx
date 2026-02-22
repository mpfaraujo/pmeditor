"use client";

import { useRef, useEffect, useState } from "react";
import QuestionRendererBase from "@/components/Questions/QuestionRendererBase";

/**
 * Encapsula um doc do miniSchema (doc > block+) num doc de questão
 * para o QuestionRendererBase conseguir renderizar.
 */
function wrapAsQuestionDoc(miniDoc: any): any {
  if (!miniDoc || miniDoc.type !== "doc") return null;
  return {
    type: "doc",
    content: [
      {
        type: "question",
        content: [
          {
            type: "statement",
            content: miniDoc.content ?? [],
          },
        ],
      },
    ],
  };
}

async function waitForFonts(signal: AbortSignal) {
  try {
    const fontsReady = (document as any).fonts?.ready;
    if (fontsReady && typeof fontsReady.then === "function") {
      await Promise.race([
        fontsReady,
        new Promise<void>((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
      ]);
    }
  } catch {
    // ignora
  }
}

async function waitForImages(root: HTMLElement, signal: AbortSignal) {
  const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
  if (imgs.length === 0) return;

  const waitOne = (img: HTMLImageElement) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Error("aborted"));
      const done = () => resolve();
      if (img.complete && img.naturalWidth > 0) {
        const anyImg = img as any;
        if (typeof anyImg.decode === "function") {
          anyImg.decode().then(done).catch(done);
        } else {
          done();
        }
        return;
      }
      const onAbort = () => reject(new Error("aborted"));
      const onLoad = () => {
        cleanup();
        const anyImg = img as any;
        if (typeof anyImg.decode === "function") {
          anyImg.decode().then(done).catch(done);
        } else {
          done();
        }
      };
      const onError = () => { cleanup(); done(); };
      const cleanup = () => {
        signal.removeEventListener("abort", onAbort);
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onError, { once: true });
    });

  await Promise.all(imgs.map(waitOne)).catch(() => {});
}

function raf(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const id = requestAnimationFrame(() => resolve());
    signal.addEventListener(
      "abort",
      () => { cancelAnimationFrame(id); reject(new Error("aborted")); },
      { once: true }
    );
  });
}

type Props = {
  respostas: Record<number, any[]>;
};

export default function GabaritoDiscursivoPages({ respostas }: Props) {
  const nums = Object.keys(respostas)
    .map(Number)
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  const measureRef = useRef<HTMLDivElement>(null);
  const pageHeightRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][]>([]);

  const numsKey = nums.join(",");

  useEffect(() => {
    if (nums.length === 0) return;

    const controller = new AbortController();
    const { signal } = controller;

    const run = async () => {
      // Aguarda refs prontos
      const t0 = Date.now();
      while ((!measureRef.current || !pageHeightRef.current) && Date.now() - t0 < 2000) {
        if (signal.aborted) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      if (!measureRef.current || !pageHeightRef.current) return;

      await waitForFonts(signal);
      await waitForImages(measureRef.current, signal);
      await raf(signal);
      await raf(signal);

      if (signal.aborted) return;

      // Altura disponível por página: altura real do .prova-page medido no DOM
      const pageContentHeight = pageHeightRef.current.getBoundingClientRect().height;
      const availableHeight = pageContentHeight > 100 ? pageContentHeight - 60 : 940;
      // 60px de folga para o título "Respostas — Questões Discursivas" na 1ª página

      const els = Array.from(
        measureRef.current.querySelectorAll("[data-measure-item]")
      ) as HTMLElement[];

      const pageGroups: number[][] = [];
      let currentPage: number[] = [];
      let usedHeight = 48; // altura do título na primeira página

      nums.forEach((n, i) => {
        const el = els[i];
        const h = (el ? el.getBoundingClientRect().height : 150) + 16; // 16px = margin-bottom
        if (usedHeight + h > availableHeight && currentPage.length > 0) {
          pageGroups.push(currentPage);
          currentPage = [n];
          usedHeight = h;
        } else {
          currentPage.push(n);
          usedHeight += h;
        }
      });

      if (currentPage.length > 0) pageGroups.push(currentPage);

      if (!signal.aborted && pageGroups.length > 0) {
        setPages(pageGroups);
      }
    };

    run().catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numsKey]);

  if (nums.length === 0) return null;

  const renderItem = (n: number) => {
    const rubrics = respostas[n];
    if (!rubrics || rubrics.length === 0) return null;
    return (
      <div key={n} className="gabarito-discursivo-item mb-4">
        <div className="font-semibold text-sm mb-1">Questão {n}:</div>
        <div className="pl-2 border-l-2 border-gray-300 space-y-2">
          {rubrics.map((rubric, i) => {
            const doc = wrapAsQuestionDoc(rubric);
            if (!doc) return null;
            return (
              <div key={i}>
                {rubrics.length > 1 && (
                  <div className="text-xs text-muted-foreground mb-0.5">
                    Item {String.fromCharCode(97 + i)})
                  </div>
                )}
                <QuestionRendererBase content={doc} mode="prova" />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Fallback antes de medir: todas numa página só
  const effectivePages = pages.length > 0 ? pages : [nums];

  return (
    <>
      {/* Referência oculta para medir a altura real da prova-page */}
      <div
        ref={pageHeightRef}
        className="prova-page"
        style={{
          position: "fixed",
          top: 0,
          left: "-9999px",
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
        aria-hidden
      />

      {/* Camada de medição dos itens (invisível) */}
      <div
        ref={measureRef}
        className="measure-layer"
        style={{
          position: "fixed",
          top: 0,
          left: "-9999px",
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
          width: "18cm",
          fontSize: "10pt",
          fontFamily: "Arial, sans-serif",
        }}
        aria-hidden
      >
        {nums.map((n) => (
          <div key={n} data-measure-item>
            {renderItem(n)}
          </div>
        ))}
      </div>

      {/* Páginas renderizadas */}
      {effectivePages.map((pageNums, pageIdx) => (
        <div
          key={pageIdx}
          className="a4-sheet bg-gray-100 print:bg-white py-20 print:py-0"
        >
          <div className="prova-page mx-auto bg-white shadow-lg print:shadow-none">
            <div className="gabarito-discursivo-wrap">
              {pageIdx === 0 && (
                <div className="text-center font-bold text-base mb-4">
                  Respostas — Questões Discursivas
                </div>
              )}
              {pageNums.map(renderItem)}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
