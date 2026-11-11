"use client";

import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mathPalette } from "./mathPalette";
import katex from "katex";
import "katex/contrib/mhchem";
import MatrixDropdown from "../MatrixDropdown";

interface Props {
  value: string;
  onChange: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

function MathPaletteIcon({ latex }: { latex: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
        strict: "ignore",
      }),
    [latex]
  );

  return (
    <span
      className="pointer-events-none flex h-full items-center justify-center overflow-hidden text-[10px] leading-none [&_.katex]:text-[10px] [&_.katex-display]:m-0 [&_.katex]:leading-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function MathToolbar({ value, onChange, textareaRef }: Props) {
  return (
    <Tabs defaultValue="basic" className="mt-1">
      <TabsList className="h-7 w-full justify-start gap-px overflow-x-auto rounded-sm border border-[var(--ws-line,#dce2de)] bg-[var(--ws-bg,#edf0ee)] px-px py-px">
        {mathPalette.map(g => (
          <TabsTrigger
            key={g.id}
            value={g.id}
            className="h-6 rounded-none px-1.5 text-[10px] font-medium text-[var(--ws-muted,#5e7069)] data-[state=active]:bg-[var(--ws-brand,#e6c76a)] data-[state=active]:text-[var(--ws-brand-ink,#302b1d)] data-[state=active]:shadow-none"
          >
            {g.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {mathPalette.map(group => (
        <TabsContent key={group.id} value={group.id} className="mt-1">
          <ScrollArea className="h-[54px] rounded-sm border border-[var(--ws-line,#dce2de)] bg-[var(--ws-bg,#edf0ee)]">
            <div className="flex flex-wrap content-start gap-px bg-[var(--ws-line,#dce2de)] p-px">
              {group.items.map(item => {
                if (item.id === "matrix") {
                  return (
                    <MatrixDropdown
                      key="matrix"
                      value={value}
                      onChange={onChange}
                      textarea={textareaRef.current}
                    />
                  );
                }

                const btn = (
                  <Button
                    key={item.id}
                    type="button"
                    variant="outline"
                    className="h-6 w-6 rounded-none border-0 bg-white p-0 text-[10px] text-[var(--ws-ink,#263433)] shadow-none hover:bg-[var(--ws-soft,#fbf4df)]"
                    onClick={() =>
                      item.insert({
                        value,
                        setValue: onChange,
                        textarea: textareaRef.current,
                      })
                    }
                  >
                    {item.iconLatex ? <MathPaletteIcon latex={item.iconLatex} /> : item.icon}
                  </Button>
                );

                return item.tooltip ? (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent className="text-xs">
                      {item.tooltip}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  btn
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  );
}
