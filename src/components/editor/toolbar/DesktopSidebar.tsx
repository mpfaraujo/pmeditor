"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as Icons from "lucide-react";
import { TOOLBAR_GROUPS } from "./toolbar-config";
import { useState, useEffect } from "react";

interface DesktopSidebarProps {
  onAction: (action: string) => void;
  hasOptionE: boolean;
}

export function DesktopSidebar({ onAction, hasOptionE }: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("editor:sidebar-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("editor:sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
  };

  return (
    <div
      className={`
        fixed right-0 top-0 h-screen bg-white border-l 
        transition-all duration-300 ease-in-out z-10
        ${collapsed ? "w-16" : "w-60"}
      `}
    >
      {/* Toggle button */}
      <div className="p-2 border-b flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir" : "Recolher"}
        >
          {collapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Grupos */}
      <div className="overflow-y-auto h-[calc(100vh-56px)] p-2">
        {TOOLBAR_GROUPS.map((group, idx) => (
          <div key={group.id}>
            {!collapsed && (
              <div className="text-xs font-semibold text-muted-foreground px-2 py-2">
                {group.label}
              </div>
            )}

            <div className="space-y-0.25">
              {group.items.map((item) => {
                // Caso especial: checkbox 4 opções
                if (item.id === "four-opts") {
                  return collapsed ? null : (
                    <div key={item.id} className="flex items-center gap-2 px-2 py-1">
                      <Checkbox
                        id="sidebar-four-opts"
                        checked={!hasOptionE}
                        onCheckedChange={() => onAction(item.action)}
                      />
                      <label
                        htmlFor="sidebar-four-opts"
                        className="text-sm cursor-pointer"
                      >
                        {item.label}
                      </label>
                    </div>
                  );
                }

                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="sm"
                    className={`w-full h-8 ${
                      collapsed ? "justify-center px-0" : "justify-start"
                    }`}
                    onClick={() => onAction(item.action)}
                    title={collapsed ? item.label : undefined}
                  >
                    {getIcon(item.icon)}
                    {!collapsed && <span className="ml-2">{item.label}</span>}
                  </Button>
                );
              })}
            </div>

            {idx < TOOLBAR_GROUPS.length - 1 && (
              <Separator className="my-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}