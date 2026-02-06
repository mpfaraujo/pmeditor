"use client";

import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

type PMNode = {
  type: string;
  attrs?: any;
  text?: string;
  marks?: any[];
  content?: PMNode[];
};

type Props = {
  content: PMNode | string;
};

export default function QuestionRendererProva({ content }: Props) {
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
  const nestedSet = findNestedSetInQuestion(doc);
  if (nestedSet) {
    rendered.push(renderSetQuestions(nestedSet, "set-nested"));
    return <div className="question-readonly-root space-y-3">{rendered}</div>;
  }

  // 3) fallback: renderiza question(s) normais
  doc.content?.forEach((node, i) => {
    if (node.type === "question") {
      rendered.push(
        <React.Fragment key={`q-${i}`}>
          {renderQuestionLike(node.content ?? [], `q-${i}`)}
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

  function findNestedSetInQuestion(doc: PMNode): PMNode | null {
    const q = doc.content?.find((n) => n?.type === "question") ?? null;
    return q?.content?.find((n) => n?.type === "set_questions") ?? null;
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

  function renderSetQuestions(setNode: PMNode, keyPrefix: string): React.ReactNode {
    const { baseTextNode, items } = splitSetQuestions(setNode);

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
    display: align === "center" || align === "right" ? "table" : "inline-block",
    marginLeft: align === "center" || align === "right" ? "auto" : undefined,
    marginRight: align === "center" ? "auto" : align === "right" ? 0 : undefined,
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
