// src/Components/Questions/QuestionRendererProva.tsx
"use client";

import QuestionRendererBase from "./QuestionRendererBase";
import type { OptionPermutation } from "@/lib/GeraTiposDeProva";

type PMNode = {
  type: string;
  attrs?: any;
  text?: string;
  marks?: any[];
  content?: PMNode[];
};

type Props = {
  content: PMNode | string;
  fragmentRender?: {
    textBlocks?: number[];
    options?: number[];
  };
  permutation?: OptionPermutation | null;
  imageWidthProp?: Record<string, number>;
  onImageResizeCommit?: (id: string, width: number) => void;
  dataBoxWidthProp?: Record<string, number>;
  onDataBoxWidthCommit?: (key: string, width: number) => void;
  inlineOptions?: boolean;
  onToggleInlineOptions?: () => void;
};

export default function QuestionRendererProva({ content, fragmentRender, permutation, imageWidthProp, onImageResizeCommit, dataBoxWidthProp, onDataBoxWidthCommit, inlineOptions, onToggleInlineOptions }: Props) {
  return <QuestionRendererBase content={content} mode="prova" fragmentRender={fragmentRender} permutation={permutation} imageWidthProp={imageWidthProp} onImageResizeCommit={onImageResizeCommit} dataBoxWidthProp={dataBoxWidthProp} onDataBoxWidthCommit={onDataBoxWidthCommit} inlineOptions={inlineOptions} onToggleInlineOptions={onToggleInlineOptions} />;
}
