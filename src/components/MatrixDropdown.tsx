"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import katex from "katex";

function insert(textarea: HTMLTextAreaElement | null, value: string, latex: string, set: (v:string)=>void) {
  if (!textarea) return set(value + latex);
  const s = textarea.selectionStart;
  const e = textarea.selectionEnd;
  const next = value.slice(0, s) + latex + value.slice(e);
  set(next);
}

function MatrixTriggerIcon() {
  const html = useMemo(
    () =>
      katex.renderToString(
        "\\left[\\begin{smallmatrix}a&b\\\\ c&d\\end{smallmatrix}\\right]",
        {
          throwOnError: false,
          displayMode: false,
          strict: "ignore",
        }
      ),
    []
  );

  return (
    <span
      className="pointer-events-none flex h-full items-center justify-center overflow-hidden text-[10px] leading-none [&_.katex]:text-[10px] [&_.katex-display]:m-0 [&_.katex]:leading-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function MatrixDropdown({
  value,
  onChange,
  textarea,
}: {
  value: string;
  onChange: (v: string) => void;
  textarea: HTMLTextAreaElement | null;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-6 w-6 rounded-none border-0 bg-[#F2E6C8] p-0 text-[#241E12] shadow-none hover:bg-[#E8D7AE]"
        >
          <MatrixTriggerIcon />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 space-y-1 text-xs">
        <div className="font-medium">Matrizes</div>

        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() =>
            insert(
              textarea,
              value,
              "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
              onChange
            )
          }
        >
          2×2 ( )
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() =>
            insert(
              textarea,
              value,
              "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}",
              onChange
            )
          }
        >
          2×2 [ ]
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() =>
            insert(
              textarea,
              value,
              "\\left|\\begin{matrix} a & b \\\\ c & d \\end{matrix}\\right|",
              onChange
            )
          }
        >
          det 2×2
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() =>
            insert(
              textarea,
              value,
              "\\begin{pmatrix} a&b&c \\\\ d&e&f \\\\ g&h&i \\end{pmatrix}",
              onChange
            )
          }
        >
          3×3 ( )
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() =>
            insert(
              textarea,
              value,
              "\\begin{bmatrix} a&b&c \\\\ d&e&f \\\\ g&h&i \\end{bmatrix}",
              onChange
            )
          }
        >
          3×3 [ ]
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() =>
            insert(
              textarea,
              value,
              "\\left|\\begin{matrix} a&b&c \\\\ d&e&f \\\\ g&h&i \\end{matrix}\\right|",
              onChange
            )
          }
        >
          det 3×3
        </Button>
      </PopoverContent>
    </Popover>
  );
}
