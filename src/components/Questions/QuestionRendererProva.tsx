// src/Components/Questions/QuestionRendererProva.tsx
"use client";

import QuestionRendererBase from "./QuestionRendererBase";
import type { OptionPermutation } from "@/lib/GeraTiposDeProva";
import type { CanonicalLineMap } from "@/lib/lineRefMeasure";

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
  baseTextSections?: Array<{
    id: string;
    tag: string;
    blockCount: number;
    hidden?: boolean;
  }>;
  onToggleBaseTextSection?: (id: string) => void;
  permutation?: OptionPermutation | null;
  imageWidthProp?: Record<string, number>;
  onImageResizeCommit?: (id: string, width: number) => void;
  dataBoxWidthProp?: Record<string, number>;
  onDataBoxWidthCommit?: (key: string, width: number) => void;
  inlineOptions?: boolean;
  onToggleInlineOptions?: () => void;
  lineMap?: CanonicalLineMap | null;
  layoutKey?: "2col" | "1col" | "acessivel";
};

export default function QuestionRendererProva({ content, fragmentRender, baseTextSections, onToggleBaseTextSection, permutation, imageWidthProp, onImageResizeCommit, dataBoxWidthProp, onDataBoxWidthCommit, inlineOptions, onToggleInlineOptions, lineMap, layoutKey }: Props) {
  return <QuestionRendererBase content={content} mode="prova" fragmentRender={fragmentRender} baseTextSections={baseTextSections} onToggleBaseTextSection={onToggleBaseTextSection} permutation={permutation} imageWidthProp={imageWidthProp} onImageResizeCommit={onImageResizeCommit} dataBoxWidthProp={dataBoxWidthProp} onDataBoxWidthCommit={onDataBoxWidthCommit} inlineOptions={inlineOptions} onToggleInlineOptions={onToggleInlineOptions} lineMap={lineMap} layoutKey={layoutKey} />;
}
