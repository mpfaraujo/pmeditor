"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import * as Icons from "lucide-react";
import { TOOLBAR_GROUPS } from "./toolbar-config";
import { useEffect, useState } from "react";

interface DesktopSidebarProps {
  onAction: (action: string) => void;
  optionsCount: number; // 2..5
}

export function DesktopSidebar({ onAction, optionsCount }: DesktopSidebarProps) {
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

  const clampedOptions = Math.max(0, Math.min(5, Math.floor(optionsCount || 0)));
  const canDec = clampedOptions > 2;
  const canInc = clampedOptions < 5;

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

      <div className="overflow-y-auto h-[calc(100vh-56px)] p-2">
        {/* CONTROLES */}
        <div className="mb-2">
          {!collapsed && (
            <div className="text-xs font-semibold text-muted-foreground px-2 py-2">
              Config
            </div>
          )}

          <div className="space-y-1">
            {/* Tipo */}
            <div className={`grid ${collapsed ? "grid-cols-1" : "grid-cols-2"} gap-1`}>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 ${collapsed ? "justify-center px-0" : "justify-start"}`}
                onClick={() => onAction("set-type-discursiva")}
                title={collapsed ? "Discursiva" : undefined}
              >
                <Icons.FileText className="h-4 w-4" />
                {!collapsed && <span className="ml-2">Discursiva</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`h-8 ${collapsed ? "justify-center px-0" : "justify-start"}`}
                onClick={() => onAction("set-type-multipla")}
                title={collapsed ? "Múltipla" : undefined}
              >
                <Icons.ListOrdered className="h-4 w-4" />
                {!collapsed && <span className="ml-2">Múltipla</span>}
              </Button>
            </div>

            {/* Largura */}
            <div className={`grid ${collapsed ? "grid-cols-1" : "grid-cols-2"} gap-1`}>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 ${collapsed ? "justify-center px-0" : "justify-start"}`}
                onClick={() => onAction("set-width-narrow")}
                title={collapsed ? "8,5 cm" : undefined}
              >
                <Icons.Columns2 className="h-4 w-4" />
                {!collapsed && <span className="ml-2">8,5 cm</span>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`h-8 ${collapsed ? "justify-center px-0" : "justify-start"}`}
                onClick={() => onAction("set-width-wide")}
                title={collapsed ? "18 cm" : undefined}
              >
                <Icons.PanelLeft className="h-4 w-4" />
                {!collapsed && <span className="ml-2">18 cm</span>}
              </Button>
            </div>

            {/* Opções (+ / -) */}
            <div
              className={`flex items-center ${
                collapsed ? "justify-center" : "justify-between"
              } px-1`}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onAction("dec-options")}
                disabled={!canDec}
                aria-label="Remover opção"
                title="− opção"
              >
                <Minus className="h-4 w-4" />
              </Button>

              {!collapsed && (
                <div className="text-sm tabular-nums px-2">{clampedOptions} opções</div>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onAction("inc-options")}
                disabled={!canInc}
                aria-label="Adicionar opção"
                title="+ opção"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator className="my-2" />
        </div>

        {/* GRUPOS EXISTENTES */}
        {TOOLBAR_GROUPS.map((group, idx) => (
          <div key={group.id}>
            {!collapsed && (
              <div className="text-xs font-semibold text-muted-foreground px-2 py-2">
                {group.label}
              </div>
            )}

            <div className="space-y-0.25">
              {group.items.map((item) => (
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
              ))}
            </div>

            {idx < TOOLBAR_GROUPS.length - 1 && <Separator className="my-1" />}
          </div>
        ))}
      </div>
    </div>
  );
}
