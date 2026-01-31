// src/Components/Questions/QuestionRenderer.tsx
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

export default function QuestionRenderer({ content }: Props) {
  let doc: PMNode | null = null;

  try {
    doc = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    return null;
  }

  if (!doc || doc.type !== "doc") return null;

  const blocks: React.ReactNode[] = [];
  const options: React.ReactNode[] = [];

  doc.content?.forEach((node, i) => {
    if (node.type !== "question") return;

    node.content?.forEach((qNode, j) => {
      if (qNode.type === "base_text" || qNode.type === "statement") {
        blocks.push(...renderBlock(qNode, `blk-${i}-${j}`));
      }

      if (qNode.type === "options") {
        options.push(...renderOptions(qNode));
      }
    });
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

/* ---------- helpers ---------- */

function renderBlock(node: PMNode, keyPrefix: string): React.ReactNode[] {
  return (
    node.content?.map((child, i) => {
      // child geralmente é paragraph
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
        <p
          key={`${keyPrefix}-${i}`}
          className="leading-snug"
          style={style}
        >
          {renderInline(child)}
        </p>
      );
    }) ?? []
  );
}

function renderOptions(node: PMNode): React.ReactNode[] {
  return (
    node.content?.map((opt, i) => {
      const letter = opt.attrs?.letter ?? "?";
      return (
        <div key={`opt-${i}`} className="flex items-center gap-2">
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
    const widthPx = Number(node.attrs?.width ?? 0);
    const align = node.attrs?.align as "left" | "center" | "right" | undefined;

    const style: React.CSSProperties = {
      width: widthPx ? `${widthPx}px` : "auto",
      height: "auto",
      display: "block",
    };

    if (align === "center") {
      style.marginLeft = "auto";
      style.marginRight = "auto";
    } else if (align === "right") {
      style.marginLeft = "auto";
      style.marginRight = "0";
    } else {
      style.marginLeft = "0";
      style.marginRight = "auto";
    }

    return <img src={node.attrs?.src} style={style} className="my-2" alt="" />;
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
    return acc;
  }, text);
}
