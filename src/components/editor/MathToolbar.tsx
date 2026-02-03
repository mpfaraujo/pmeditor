"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mathPalette } from "./mathPalette";
import  MatrixDropdown  from "../MatrixDropdown";

interface Props {
  value: string;
  onChange: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export default function MathToolbar({ value, onChange, textareaRef }: Props) {
  return (
    <Tabs defaultValue="G1" className="mt-1">
      <TabsList className="h-7">
        {mathPalette.map(g => (
          <TabsTrigger key={g.id} value={g.id} className="text-xs px-2">
            {g.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {mathPalette.map(group => (
        <TabsContent key={group.id} value={group.id} className="mt-1">
          <ScrollArea className="h-[96px]">
            <div className="grid grid-cols-8 gap-1 p-1">
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
      variant="outline"
      className="h-6 w-6 p-0 text-[11px]"
      onClick={() =>
        item.insert({
          value,
          setValue: onChange,
          textarea: textareaRef.current,
        })
      }
    >
      {item.icon}
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
