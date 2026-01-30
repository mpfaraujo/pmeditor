"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus } from "lucide-react";
import * as Icons from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TOOLBAR_GROUPS } from "./toolbar-config";

interface HorizontalToolbarProps {
  onAction: (action: string) => void;
  optionsCount: number; // NOVO (2..5)
}

export function HorizontalToolbar({ onAction, optionsCount }: HorizontalToolbarProps) {
  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
  };

  const clampedOptions = Math.max(0, Math.min(5, Math.floor(optionsCount || 0)));
  const canDec = clampedOptions > 2;
  const canInc = clampedOptions < 5;

  return (
    <div className="border rounded-lg p-2 mb-4 bg-white overflow-x-auto">
      <div className="flex items-center gap-1 flex-nowrap">
        {/* CONTROLES */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Tipo */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onAction("set-type-discursiva")}
            title="Discursiva"
            aria-label="Discursiva"
          >
            <Icons.FileText className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onAction("set-type-multipla")}
            title="Múltipla"
            aria-label="Múltipla"
          >
            <Icons.ListOrdered className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Largura */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onAction("set-width-narrow")}
            title="8,5 cm"
            aria-label="8,5 cm"
          >
            <Icons.Columns2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onAction("set-width-wide")}
            title="18 cm"
            aria-label="18 cm"
          >
            <Icons.PanelLeft className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Opções (+ / -) 2..5 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onAction("dec-options")}
            disabled={!canDec}
            title="− opção"
            aria-label="Remover opção"
          >
            <Minus className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onAction("inc-options")}
            disabled={!canInc}
            title="+ opção"
            aria-label="Adicionar opção"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />
        </div>

        {/* GRUPOS EXISTENTES */}
        {TOOLBAR_GROUPS.map((group, idx) => (
          <div key={group.id} className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex-shrink-0">
                  {group.label}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start">
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {group.items.map((item) => {
                  return (
                    <DropdownMenuItem key={item.id} onClick={() => onAction(item.action)}>
                      <div className="flex items-center gap-2">
                        {getIcon(item.icon)}
                        <span>{item.label}</span>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {idx < TOOLBAR_GROUPS.length - 1 && (
              <Separator orientation="vertical" className="h-6" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
