/**
 * ExerciseHeader — componente único para todos os layouts de cabeçalho de exercício.
 * Cada layout é uma função interna que recebe os mesmos campos e helpers.
 *
 * Para adicionar um novo layout:
 * 1. Crie uma função LayoutN abaixo
 * 2. Adicione o entry no LAYOUT_MAP
 */

import React from "react";

export interface ExerciseHeaderProps {
  layout?: number; // 0–N, default 0
  logoUrl: string | null;
  logoPlaceholder?: string;
  onLogoClick: () => void;
  isEditable?: boolean;
  /** Chamado ao sair de um campo editável. field = chave do ProvaConfig. */
  onFieldChange?: (field: string, value: string) => void;

  // opcionais (vindos do provaConfig)
  instituicao?: string;
  titulo?: string; // ex: "Lista de Exercícios"
  professor?: string;
  disciplina?: string;
  turma?: string;
  data?: string; // YYYY-MM-DD
}

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDateBR(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(2)}`;
}

function ed(
  field: string,
  isEditable: boolean,
  onFieldChange?: (field: string, value: string) => void
): React.HTMLAttributes<HTMLElement> {
  if (!isEditable) return {};
  return {
    contentEditable: true,
    suppressContentEditableWarning: true,
    onBlur: (e: React.FocusEvent<HTMLElement>) =>
      onFieldChange?.(field, e.currentTarget.textContent ?? ""),
  };
}

// ─── layouts ────────────────────────────────────────────────────────────────

function Layout0({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  titulo = "Lista de Exercícios", professor, disciplina, turma, data,
}: ExerciseHeaderProps) {
  const metaLeft = [disciplina, turma].filter(Boolean).join(" • ");
  const metaRight = [professor, data ? formatDateBR(data) : ""].filter(Boolean).join(" • ");

  return (
    <div className="exercise-header">
      <div className="pt-4 pb-4">
        <div className="flex items-center gap-4">
          <div
            className={`logo-area flex items-center justify-center font-bold ${
              isEditable ? "cursor-pointer" : "cursor-default"
            } ${logoUrl ? "" : "border-2 border-gray-800"}`}
            onClick={isEditable ? onLogoClick : undefined}
            style={{ width: 86, height: 56 }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo da instituição"
                className="object-contain"
                style={{ maxWidth: "min(100%, 2cm)", maxHeight: "min(100%, 2cm)" }}
              />
            ) : (
              <span className="text-xs">{logoPlaceholder?.trim() ?? "LOGO"}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold text-gray-900 leading-tight truncate">
              {titulo}
            </div>

            {(metaLeft || metaRight) && (
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-gray-700">
                <div className="truncate">{metaLeft}</div>
                <div className="truncate">{metaRight}</div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-1 w-full border-t border-black" />
      </div>
    </div>
  );
}

// ─── componente principal ────────────────────────────────────────────────────

const LAYOUT_MAP: Record<number, React.ComponentType<ExerciseHeaderProps>> = {
  0: Layout0,
};

export function ExerciseHeader(props: ExerciseHeaderProps) {
  const { layout = 0 } = props;
  const LayoutComponent = LAYOUT_MAP[layout] ?? Layout0;
  return <LayoutComponent {...props} />;
}
