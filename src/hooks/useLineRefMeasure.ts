import { useEffect, useRef } from "react";
import { resolverRefs, injectLineNumbers } from "@/lib/lineRefMeasure";

/**
 * Hook que executa resolverRefs no container referenciado sempre que `open`
 * muda para true (ex: dialog abre).
 *
 * A numeração visual de linhas (5, 10, 15...) é feita pelo CSS via
 * counter-increment em p[data-numbered="true"] e .verse[data-numbered="true"]
 * — não precisa de JS para isso.
 *
 * Aguarda 250ms antes de medir para garantir que animações de abertura
 * do Dialog (shadcn/Radix) terminaram e o DOM está totalmente pintado.
 *
 * Uso:
 *   const ref = useLineRefMeasure(!!previewItem);
 *   <div ref={ref}>...</div>
 */
export function useLineRefMeasure<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraDeps: any[] = []
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (ref.current) {
        resolverRefs(ref.current);
        injectLineNumbers(ref.current);
      }
    }, 250);
    return () => clearTimeout(timer);
  // extraDeps é espalhado intencionalmente para re-disparar quando muda
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...extraDeps]);

  return ref;
}
