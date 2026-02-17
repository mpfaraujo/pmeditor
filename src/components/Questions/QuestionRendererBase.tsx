// src/Components/Questions/QuestionRendererBase.tsx
"use client";

import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";
import { essayPartLabel, shouldShowEssayPartLabels } from "@/lib/questionRules";

type PMNode = {
  type: string;
  attrs?: any;
  text?: string;
  marks?: any[];
  content?: PMNode[];
};

type Props = {
  content: PMNode | string;
  mode: "default" | "prova";
};

export default function QuestionRendererBase({ content, mode }: Props) {
  const [imageWidthOverrides, setImageWidthOverrides] = React.useState<
    Record<string, number>
  >({});
  const dragRef = React.useRef<{
    id: string;
    startX: number;
    startW: number;
  } | null>(null);

  const [imageAlignOverrides, setImageAlignOverrides] = React.useState<
    Record<string, "left" | "center" | "right">
  >({});

  // ===== persistência simples (print precisa recuperar o resize) =====
  const LS_W = "pm:imageWidthOverrides:v1";
  const LS_A = "pm:imageAlignOverrides:v1";

  React.useEffect(() => {
    try {
      const w = localStorage.getItem(LS_W);
      if (w) setImageWidthOverrides(JSON.parse(w));
    } catch {}
    try {
      const a = localStorage.getItem(LS_A);
      if (a) setImageAlignOverrides(JSON.parse(a));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(LS_W, JSON.stringify(imageWidthOverrides));
    } catch {}
  }, [imageWidthOverrides]);

  React.useEffect(() => {
    try {
      localStorage.setItem(LS_A, JSON.stringify(imageAlignOverrides));
    } catch {}
  }, [imageAlignOverrides]);
  // ================================================================

  let doc: PMNode | null = null;

  try {
    doc = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    return null;
  }

  if (!doc || doc.type !== "doc") return null;

  const rendered: React.ReactNode[] = [];

  // 1) set_questions direto no doc
  const directSet = findDirectSet(doc);
  if (directSet) {
    rendered.push(renderSetQuestions(directSet, "set-direct"));
    return <div className="question-readonly-root space-y-3">{rendered}</div>;
  }

  // 2) set_questions aninhado em question (doc -> question -> set_questions)
  const nested = findNestedSetInQuestion(doc);
  if (nested) {
    rendered.push(
      renderSetQuestions(nested.setNode, "set-nested", nested.questionNode?.attrs)
    );
    return <div className="question-readonly-root space-y-3">{rendered}</div>;
  }

  // 3) fallback: renderiza question(s) normais
  doc.content?.forEach((node, i) => {
    if (node.type === "question") {
      const isEssayQuestion = node.attrs?.tipo === "Discursiva";

      rendered.push(
        <React.Fragment key={`q-${i}`}>
          {isEssayQuestion ? (
            <div className="question-readonly">
              <div className="question-text space-y-2">
                {renderQuestionLike(node.content ?? [], `q-${i}`)}
              </div>
            </div>
          ) : (
            renderQuestionLike(node.content ?? [], `q-${i}`)
          )}
        </React.Fragment>
      );
    }
  });

  if (rendered.length === 0) return null;
  return <div className="question-readonly-root space-y-3">{rendered}</div>;

  /* ---------------- set_questions ---------------- */

  function findDirectSet(doc: PMNode): PMNode | null {
    return doc.content?.find((n) => n?.type === "set_questions") ?? null;
  }

  function findNestedSetInQuestion(
    doc: PMNode
  ): { setNode: PMNode; questionNode: PMNode } | null {
    const q = doc.content?.find((n) => n?.type === "question") ?? null;
    const setNode = q?.content?.find((n) => n?.type === "set_questions") ?? null;
    if (!q || !setNode) return null;
    return { setNode, questionNode: q };
  }

  function splitSetQuestions(setNode: PMNode): {
    baseTextNode: PMNode | null;
    items: PMNode[];
  } {
    const content = setNode.content ?? [];
    const baseTextNode = content.find((n) => n?.type === "base_text") ?? null;
    const items = content.filter((n) => n?.type === "question_item");
    return { baseTextNode, items };
  }

  function renderSetQuestions(
    setNode: PMNode,
    keyPrefix: string,
    parentQuestionAttrs?: any
  ): React.ReactNode {
    const { baseTextNode, items } = splitSetQuestions(setNode);

    // Discursiva multipartes: só ativa se o set vier marcado explicitamente.
    // Se não houver marcação, mantém o comportamento antigo (não quebra nada).
    const ak = setNode?.attrs?.answerKey ?? parentQuestionAttrs?.answerKey;

    const isEssaySet =
      setNode?.attrs?.mode === "essay" ||
      setNode?.attrs?.mode == null
        ? !items.some((it) =>
            (it.content ?? []).some((n) => n?.type === "options")
          )
        : false;

    if (isEssaySet) {
      const showLabels = shouldShowEssayPartLabels(items.length);

      return (
        <div key={keyPrefix} className="question-set-readonly space-y-3">
          {baseTextNode ? (
            <div className="question-readonly">
              <div className="question-text space-y-2">
                {renderBlock(baseTextNode, `${keyPrefix}-base`)}
              </div>
            </div>
          ) : null}

          {items.map((it, idx) => (
            <div
              key={`${keyPrefix}-essay-${idx}`}
              className="flex items-start gap-2"
            >
              {showLabels ? (
                <div className="font-semibold">{essayPartLabel(idx)}</div>
              ) : null}

              <div className="flex-1">
                {renderQuestionLike(it.content ?? [], `${keyPrefix}-essay-${idx}`)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Fallback: question_set com 1 question_item vira "questão normal"
    // enunciado = base_text + statement/options do item, sem banner
    if (items.length === 1) {
      const it = items[0];
      const mergedNodes: PMNode[] = [
        ...(baseTextNode ? [baseTextNode] : []),
        ...(it?.content ?? []),
      ];

      return (
        <div key={keyPrefix} className="question-set-readonly space-y-3">
          {renderQuestionLike(mergedNodes, `${keyPrefix}-single`)}
        </div>
      );
    }

    // comportamento antigo (set com 2+ itens)
    return (
      <div key={keyPrefix} className="question-set-readonly space-y-3">
        <div className="text-sm font-semibold">
          Use o texto a seguir para responder às próximas {items.length} questões.
        </div>

        {baseTextNode ? (
          <div className="question-readonly">
            <div className="question-text space-y-2">
              {renderBlock(baseTextNode, `${keyPrefix}-base`)}
            </div>
          </div>
        ) : null}

        {items.map((it, idx) => (
          <div key={`${keyPrefix}-it-${idx}`} className="question-set-item">
            {renderQuestionLike(it.content ?? [], `${keyPrefix}-it-${idx}`)}
          </div>
        ))}
      </div>
    );
  }

  /* ---------------- question-like rendering ---------------- */

  function renderQuestionLike(nodes: PMNode[], keyPrefix: string): React.ReactNode {
    const blocks: React.ReactNode[] = [];
    const options: React.ReactNode[] = [];

    nodes.forEach((qNode, j) => {
      if (qNode.type === "base_text" || qNode.type === "statement") {
        blocks.push(...renderBlock(qNode, `${keyPrefix}-blk-${j}`));
      }

      if (qNode.type === "options") {
        options.push(...renderOptions(qNode, `${keyPrefix}-opts-${j}`));
      }
    });

    return (
      <div className="question-readonly">
        <div className="question-text space-y-2">{blocks}</div>

        {options.length > 0 && (
          <div className="question-options mt-3 space-y-1">{options}</div>
        )}
      </div>
    );
  }

  function renderBlock(node: PMNode, keyPrefix: string): React.ReactNode[] {
    return (
      node.content?.map((child, i) => {
        const key = `${keyPrefix}-${i}`;

        if (child.type === "paragraph") {
          const align = child?.attrs?.textAlign as
            | "left"
            | "right"
            | "center"
            | "justify"
            | undefined;

          const style: React.CSSProperties | undefined = align
            ? { textAlign: align }
            : undefined;

          return (
            <p key={key} className="leading-snug" style={style}>
              {renderInline(child)}
            </p>
          );
        }

        if (child.type === "bullet_list" || child.type === "ordered_list") {
          return (
            <div key={key} className="leading-snug">
              {renderInline(child)}
            </div>
          );
        }

        return (
          <div key={key} className="leading-snug">
            {renderInline(child)}
          </div>
        );
      }) ?? []
    );
  }

  function renderOptions(node: PMNode, keyPrefix: string): React.ReactNode[] {
    return (
      node.content?.map((opt, i) => {
        const letter = opt.attrs?.letter ?? "?";
        return (
          <div key={`${keyPrefix}-opt-${i}`} className="flex items-start gap-2">
            <span>({letter})</span>
            <div className="flex-1">{renderInline(opt)}</div>
          </div>
        );
      }) ?? []
    );
  }

  function renderInline(node: PMNode): React.ReactNode {
    if (!node) return null;

    if (node.type === "text") {
      return applyMarks(node.text ?? "", node.marks);
    }

    if (node.type === "math_inline") {
      return (
        <span
          className="math-inline"
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(node.attrs?.latex ?? "", {
              throwOnError: false,
              displayMode: false,
            }),
          }}
        />
      );
    }

    if (node.type === "image") {
      // default mode: usa attrs direto
      if (mode === "default") {
        const widthPx = Number(node.attrs?.width ?? 0);
        const align = node.attrs?.align as "left" | "center" | "right" | undefined;

        const isSmall = !!widthPx && widthPx <= 280;

        const style: React.CSSProperties = {
          width: widthPx ? `${widthPx}px` : "auto",
          height: "auto",
          display: isSmall ? "inline-block" : "block",
          verticalAlign: isSmall ? "top" : undefined,
        };

        if (align === "center") {
          style.marginLeft = "auto";
          style.marginRight = "auto";
        } else if (align === "right") {
          style.marginLeft = "auto";
          style.marginRight = "0";
        } else {
          style.marginLeft = "0";
          style.marginRight = isSmall ? "8px" : "auto";
        }

        return (
          <img
            src={node.attrs?.src}
            style={style}
            className="my-2"
            alt=""
            data-id={node.attrs?.id || undefined}
          />
        );
      }

      // prova mode: resize + centralizar override (persistido via localStorage)
      const id = node.attrs?.id as string | undefined;
      const baseWidthPx = Number(node.attrs?.width ?? 0);
      const widthPx = (id ? imageWidthOverrides[id] : undefined) ?? baseWidthPx;

      const baseAlign = node.attrs?.align as "left" | "center" | "right" | undefined;
      const overrideAlign = id ? imageAlignOverrides[id] : undefined;
      const align = (overrideAlign ?? baseAlign) as
        | "left"
        | "center"
        | "right"
        | undefined;

      const isSmall = !!widthPx && widthPx <= 280;

      const style: React.CSSProperties = {
        width: widthPx ? `${widthPx}px` : "auto",
        height: "auto",
        display: isSmall ? "inline-block" : "block",
        verticalAlign: isSmall ? "top" : undefined,
      };

      if (align === "center") {
        style.marginLeft = "auto";
        style.marginRight = "auto";
      } else if (align === "right") {
        style.marginLeft = "auto";
        style.marginRight = "0";
      } else {
        style.marginLeft = "0";
        style.marginRight = isSmall ? "8px" : "auto";
      }

      const onPointerDown = (e: React.PointerEvent) => {
        if (!id) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = {
          id,
          startX: e.clientX,
          startW: widthPx || baseWidthPx || 0,
        };
      };

      const onPointerMove = (e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = e.clientX - d.startX;
        const next = Math.max(40, Math.round(d.startW + dx));
        setImageWidthOverrides((prev) =>
          prev[d.id] === next ? prev : { ...prev, [d.id]: next }
        );
      };

      const onPointerUp = (e: React.PointerEvent) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}
      };

      return (
        <span
          style={{
            position: "relative",
            display:
              align === "center" || align === "right" ? "table" : "inline-block",
            marginLeft: align === "center" || align === "right" ? "auto" : undefined,
            marginRight:
              align === "center" ? "auto" : align === "right" ? 0 : undefined,
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img
            src={node.attrs?.src}
            style={style}
            className="my-2"
            alt=""
            data-id={id || undefined}
          />

          {id ? (
            <button
              className="no-print"
              type="button"
              onClick={() =>
                setImageAlignOverrides((prev) => {
                  const cur = prev[id];
                  const next = cur === "center" ? undefined : "center";
                  const copy = { ...prev };
                  if (next) copy[id] = next;
                  else delete copy[id];
                  return copy;
                })
              }
              style={{
                position: "absolute",
                left: -6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 18,
                height: 18,
                fontSize: 12,
                lineHeight: "18px",
                textAlign: "center",
                borderRadius: 4,
                background: "rgba(0,0,0,0.08)",
                cursor: "pointer",
                border: "none",
                userSelect: "none",
              }}
              title="Centralizar"
            >
              C
            </button>
          ) : null}

          {id ? (
            <span
              className="no-print"
              onPointerDown={onPointerDown}
              style={{
                position: "absolute",
                right: -6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 12,
                height: 24,
                cursor: "ew-resize",
                background: "rgba(0,0,0,0.08)",
                borderRadius: 4,
              }}
              title="Arraste para redimensionar"
            />
          ) : null}
        </span>
      );
    }

    if (node.type === "bullet_list") {
      return (
        <ul>
          {node.content?.map((li, i) => (
            <React.Fragment key={i}>{renderInline(li)}</React.Fragment>
          ))}
        </ul>
      );
    }

    if (node.type === "ordered_list") {
      return (
        <ol>
          {node.content?.map((li, i) => (
            <React.Fragment key={i}>{renderInline(li)}</React.Fragment>
          ))}
        </ol>
      );
    }

    if (node.type === "list_item") {
      return (
        <li>
          {node.content?.map((c, i) => (
            <React.Fragment key={i}>{renderInline(c)}</React.Fragment>
          ))}
        </li>
      );
    }

    if (node.content) {
      return node.content.map((c, i) => <span key={i}>{renderInline(c)}</span>);
    }

    return null;
  }

  function applyMarks(text: string, marks?: any[]) {
    if (!marks || marks.length === 0) return text;

    return marks.reduce<React.ReactNode>((acc, mark) => {
      if (mark.type === "strong") return <strong>{acc}</strong>;
      if (mark.type === "em") return <em>{acc}</em>;
      if (mark.type === "underline") return <u>{acc}</u>;
      if (mark.type === "code") return <code>{acc}</code>;
      if (mark.type === "subscript") return <sub>{acc}</sub>;
      if (mark.type === "superscript") return <sup>{acc}</sup>;
      return acc;
    }, text);
  }
}
