"use client";

import React, { useRef } from "react";
import { GripHorizontal } from "lucide-react";

interface SpacerHandleProps {
  spacerKey: string;
  currentHeight: number;
  maxHeight?: number;
  onChange: (key: string, h: number) => void;
  onCommit?: (key: string, h: number) => void;
}

export function SpacerHandle({ spacerKey, currentHeight, maxHeight = 2000, onChange, onCommit }: SpacerHandleProps) {
  const startY = useRef(0);
  const startH = useRef(0);
  const lastH = useRef(currentHeight);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    startY.current = e.clientY;
    startH.current = currentHeight;
    lastH.current = currentHeight;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return;
    const delta = e.clientY - startY.current;
    const next = Math.max(0, Math.min(maxHeight, startH.current + delta));
    lastH.current = next;
    onChange(spacerKey, next);
  };

  const onPointerUp = () => {
    onCommit?.(spacerKey, lastH.current);
  };

  return (
    <div>
      {currentHeight > 0 && <div style={{ height: currentHeight }} />}
      <div
        className="print:hidden flex items-center justify-center h-3 w-full cursor-ns-resize select-none text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors rounded"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <GripHorizontal size={14} />
      </div>
    </div>
  );
}
