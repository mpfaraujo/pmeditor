"use client";

import { useState, useRef, useEffect } from "react";
import { ASSUNTOS_CANONICOS, normalizeAssunto } from "@/data/assuntos";
import { cn } from "@/lib/utils";

interface AssuntoComboboxProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function AssuntoCombobox({
  value,
  onChange,
  placeholder = "Assunto",
  className,
}: AssuntoComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar com valor externo
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = inputValue.trim()
    ? ASSUNTOS_CANONICOS.filter((a) =>
        a.toLowerCase().includes(inputValue.trim().toLowerCase())
      )
    : ASSUNTOS_CANONICOS;

  const handleSelect = (item: string) => {
    setInputValue(item);
    onChange(item);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onChange(e.target.value);
    if (!open) setOpen(true);
  };

  const handleBlur = () => {
    const normalized = normalizeAssunto(inputValue);
    if (normalized && normalized !== inputValue) {
      setInputValue(normalized);
      onChange(normalized);
    }
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.map((item) => (
              <div
                key={item}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                className="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
