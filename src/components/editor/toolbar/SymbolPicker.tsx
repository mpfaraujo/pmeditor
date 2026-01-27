"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SYMBOLS, SYMBOL_LABELS, type SymbolCategory } from "./toolbar-config";

interface SymbolPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (symbol: string) => void;
}

export function SymbolPicker({ open, onOpenChange, onSelect }: SymbolPickerProps) {
  const handleSelect = (symbol: string) => {
    onSelect(symbol);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inserir Símbolo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {(Object.keys(SYMBOLS) as SymbolCategory[]).map((category) => (
            <div key={category}>
              <h3 className="text-sm font-medium mb-2">{SYMBOL_LABELS[category]}</h3>
              <div className="flex flex-wrap gap-1">
                {SYMBOLS[category].map((symbol) => (
                  <Button
                    key={symbol}
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 text-lg"
                    onClick={() => handleSelect(symbol)}
                  >
                    {symbol}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
