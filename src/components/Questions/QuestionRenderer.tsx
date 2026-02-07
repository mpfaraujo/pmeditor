// src/Components/Questions/QuestionRenderer.tsx
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
};

export default function QuestionRenderer({ content }: Props) {
  return <QuestionRendererBase content={content} mode="default" />;
}
