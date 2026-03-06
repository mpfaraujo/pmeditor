import React from "react";

export interface AccessibleHeaderProps {
  logoUrl: string | null;
  logoPlaceholder?: string;
  onLogoClick: () => void;
  isEditable?: boolean;
  onFieldChange?: (field: string, value: string) => void;

  disciplina?: string;
  professor?: string;
  turma?: string;
  data?: string;
}

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

export function AccessibleHeader({
  logoUrl,
  logoPlaceholder,
  onLogoClick,
  isEditable,
  onFieldChange,
  disciplina,
  professor,
  turma,
  data,
}: AccessibleHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);

  return (
    <div className="accessible-header">
      {/* Linha superior: logo + instituição/disciplina + data */}
      <div className="flex items-center gap-4 pb-1">
        {/* Logo */}
        <div
          className={`shrink-0 flex items-center justify-center ${isEditable ? "cursor-pointer" : "cursor-default"}`}
          style={{ width: "2cm", height: "2cm" }}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo da instituição"
              className="object-contain"
              style={{ maxWidth: "2cm", maxHeight: "2cm" }}
            />
          ) : logoPlaceholder?.trim() ? (
            <span className="text-[9px] font-semibold text-gray-500 text-center leading-tight">
              {logoPlaceholder.trim()}
            </span>
          ) : null}
        </div>

        {/* Disciplina */}
        <div className="flex-1 min-w-0">
          {disciplina && (
            <div
              className="text-[10pt] text-gray-600"
              {...E("disciplina")}
            >
              {disciplina}
            </div>
          )}
        </div>

        {/* Data */}
        {data && (
          <div className="shrink-0 text-right text-[10pt] text-gray-600" {...E("data")}>
            {formatDateBR(data)}
          </div>
        )}
      </div>

      {/* Campos do candidato */}
      <div className="space-y-1.5 text-[10pt] text-gray-700">
        {/* Nome — linha larga para o aluno preencher */}
        <div className="flex items-end gap-2">
          <span className="shrink-0 text-gray-500">Nome:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[18px]" />
        </div>

        {/* Professor / Turma / Nota */}
        <div className="flex items-end gap-6">
          <div className="flex items-end gap-2 flex-1">
            <span className="shrink-0 text-gray-500">Professor:</span>
            <div
              className="flex-1 border-b border-gray-400 min-h-[16px] pb-0.5"
              {...E("professor")}
            >
              {professor || ""}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="shrink-0 text-gray-500">Turma:</span>
            <div
              className="w-[3cm] border-b border-gray-400 min-h-[16px] pb-0.5"
              {...E("turma")}
            >
              {turma || ""}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="shrink-0 text-gray-500">Nota:</span>
            <div className="w-[2cm] border-b border-gray-400 min-h-[16px]" />
          </div>
        </div>
      </div>

      {/* Linha separadora inferior */}
      <div className="border-t-2 border-gray-700 mt-2" />
    </div>
  );
}
