"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function insert(textarea: HTMLTextAreaElement | null, value: string, latex: string, set: (v:string)=>void) {
  if (!textarea) return set(value + latex);
  const s = textarea.selectionStart;
  const e = textarea.selectionEnd;
  const next = value.slice(0, s) + latex + value.slice(e);
  set(next);
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
        <Button variant="outline" className="h-6 w-6 p-0 text-xs">
          ▦
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 text-xs space-y-1">
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
