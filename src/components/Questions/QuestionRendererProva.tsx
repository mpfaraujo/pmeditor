// src/Components/Questions/QuestionRendererProva.tsx
"use client";

import QuestionRendererBase from "./QuestionRendererBase";

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
};

export default function QuestionRendererProva({ content, fragmentRender }: Props) {
  return <QuestionRendererBase content={content} mode="prova" fragmentRender={fragmentRender} />;
}
