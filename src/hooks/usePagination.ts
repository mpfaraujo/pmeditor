// src/hooks/usePagination.ts
/**
 * Custom hook para gerenciar a paginação de provas
 * - Garante medição estável (fonts + imagens carregadas)
 * - Agenda layout em rAF (evita medir DOM em transição)
 * - Recalcula quando dependencies mudarem (chave estável)
 * - Reexecuta paginação em beforeprint/afterprint (métrica print)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculatePageLayout,
  PageLayout,
  PaginationConfig,
} from "@/lib/pagination";

export interface UsePaginationProps {
  config: PaginationConfig;
  questionCount: number;
  dependencies: any[];
}

function stableStringify(value: any): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "function") return "[fn]";
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();

    if (v && typeof v === "object") {
      if (seen.has(v)) return "[circular]";
      seen.add(v);
    }

    return v;
  });
}

async function waitForFonts(signal: AbortSignal) {
  try {
    // @ts-ignore
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
          anyImg
            .decode()
            .then(() => resolve())
            .catch(() => resolve());
        } else {
          resolve();
        }
        return;
      }

      const onAbort = () => reject(new Error("aborted"));
      const onLoad = () => {
        cleanup();
        const anyImg = img as any;
        if (typeof anyImg.decode === "function") {
          anyImg
            .decode()
            .then(() => done())
            .catch(() => done());
        } else {
          done();
        }
      };
      const onError = () => {
        cleanup();
        done();
      };

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
      () => {
        cancelAnimationFrame(id);
        reject(new Error("aborted"));
      },
      { once: true }
    );
  });
}

export function usePagination({
  config,
  questionCount,
  dependencies,
}: UsePaginationProps) {
  const measureItemsRef = useRef<HTMLDivElement | null>(null);
  const measureFirstPageRef = useRef<HTMLDivElement | null>(null);
  const measureFirstQuestoesRef = useRef<HTMLDivElement | null>(null);
  const measureOtherPageRef = useRef<HTMLDivElement | null>(null);
  const measureOtherQuestoesRef = useRef<HTMLDivElement | null>(null);

  const [pages, setPages] = useState<PageLayout[]>([]);
  const [printEpoch, setPrintEpoch] = useState(0);

  const depsKey = useMemo(() => stableStringify(dependencies), [dependencies]);

  const pageHeight = config.pageHeight;
  const safetyMargin = config.safetyMargin;
  const columns = config.columns;
  const allowPageBreak = config.allowPageBreak ?? false;

  // Reexecuta paginação ao entrar/sair de print (para pegar métrica real do print)
  useEffect(() => {
    const onBeforePrint = () => setPrintEpoch((x) => x + 1);
    const onAfterPrint = () => setPrintEpoch((x) => x + 1);

    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    const mql = window.matchMedia?.("print");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) onBeforePrint();
      else onAfterPrint();
    };

    if (mql) {
      if ("addEventListener" in mql) mql.addEventListener("change", onChange);
      else (mql as any).addListener(onChange);
    }

    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      if (mql) {
        if ("removeEventListener" in mql)
          mql.removeEventListener("change", onChange);
        else (mql as any).removeListener(onChange);
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const run = async () => {
      if (
        !measureItemsRef.current ||
        !measureFirstPageRef.current ||
        !measureFirstQuestoesRef.current ||
        !measureOtherPageRef.current ||
        !measureOtherQuestoesRef.current
      ) {
        setPages([]);
        return;
      }

      await waitForFonts(signal);
      await waitForImages(measureItemsRef.current, signal);

      await raf(signal);
      await raf(signal);

      const maxAttempts = 6;
      for (let i = 0; i < maxAttempts; i++) {
        if (signal.aborted) return;

        const layout = calculatePageLayout(
          { pageHeight, safetyMargin, columns, allowPageBreak },
          {
            firstPageRef: measureFirstPageRef.current,
            firstQuestoesRef: measureFirstQuestoesRef.current,
            otherPageRef: measureOtherPageRef.current,
            otherQuestoesRef: measureOtherQuestoesRef.current,
            measureItemsRef: measureItemsRef.current,
          },
          questionCount
        );

        if (layout) {
          setPages(layout);
          return;
        }

        await raf(signal);
      }

      setPages([]);
    };

    run().catch(() => {});

    return () => controller.abort();
  }, [
    depsKey,
    pageHeight,
    safetyMargin,
    columns,
    allowPageBreak,
    questionCount,
    printEpoch,
  ]);

  return {
    pages,
    refs: {
      measureItemsRef,
      measureFirstPageRef,
      measureFirstQuestoesRef,
      measureOtherPageRef,
      measureOtherQuestoesRef,
    },
  };
}
