"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
  hasOptionE: boolean;
}

export function HorizontalToolbar({ onAction, hasOptionE }: HorizontalToolbarProps) {
  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
  };

  return (
    <div className="border rounded-lg p-2 mb-4 bg-white overflow-x-auto">
      <div className="flex items-center gap-1 flex-nowrap">
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
                  // Caso especial: checkbox 4 opções
                  if (item.id === "four-opts") {
                    return (
                      <div key={item.id} className="flex items-center gap-2 px-2 py-2">
                        <Checkbox
                          id="toolbar-four-opts"
                          checked={!hasOptionE}
                          onCheckedChange={() => onAction(item.action)}
                        />
                        <label
                          htmlFor="toolbar-four-opts"
                          className="text-sm cursor-pointer"
                        >
                          {item.label}
                        </label>
                      </div>
                    );
                  }

                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => onAction(item.action)}
                    >
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
