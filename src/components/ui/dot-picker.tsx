// src/components/ui/dot-picker.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type DotPickerOption = {
  value: number;
  label?: React.ReactNode; // conteúdo dentro da bolinha; se não vier, usa o número
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

type Props = {
  value: number;
  options: DotPickerOption[];
  onChange: (next: number) => void;
  className?: string;

  // estilo (defaults iguais ao seu picker atual)
  size?: "sm" | "md";
  activeClassName?: string;
  inactiveClassName?: string;
  buttonClassName?: string;
};

export function DotPicker({
  value,
  options,
  onChange,
  className,
  size = "md",
  activeClassName = "border-blue-500 bg-blue-50 text-blue-700",
  inactiveClassName = "border-slate-300 bg-white text-slate-700",
  buttonClassName,
}: Props) {
  const dim = size === "sm" ? "h-6 w-6 text-[11px]" : "h-7 w-7 text-xs";

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const active = opt.value === value;

        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => {
              if (!opt.disabled) onChange(opt.value);
            }}
            className={cn(
              dim,
              "rounded-full border font-semibold",
              "flex items-center justify-center select-none",
              active ? activeClassName : inactiveClassName,
              opt.disabled && "opacity-50 cursor-not-allowed",
              buttonClassName
            )}
            aria-label={opt.ariaLabel ?? `Opção ${opt.value}`}
            title={opt.title}
            suppressHydrationWarning
          >
            {opt.label ?? opt.value}
          </button>
        );
      })}
    </div>
  );
}
