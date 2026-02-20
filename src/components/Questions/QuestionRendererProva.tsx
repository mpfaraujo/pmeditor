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
};

export default function QuestionRendererProva({ content, fragmentRender, permutation }: Props) {
  return <QuestionRendererBase content={content} mode="prova" fragmentRender={fragmentRender} permutation={permutation} />;
}
