// src/components/prova/headers/ProvaHeaderLayout6.tsx

/**
 * Layout 6 - Horizontal Minimalista Compacto
 * Duas linhas finas: logo+nome+turma | professor+disciplina+data+nota
 */

interface ProvaHeaderLayout6Props {
  logoUrl: string | null;
  logoPlaceholder?: string;
  onLogoClick: () => void;
  isEditable?: boolean;
  nome?: string;
  turma?: string;
  professor?: string;
  disciplina?: string;
  data?: string;
  nota?: string;
  instituicao?: string;
}

function formatDateBR(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(2)}`;
}

export function ProvaHeaderLayout6({
  logoUrl,
  onLogoClick,
  isEditable = true,
  nome,
  turma,
  professor,
  disciplina,
  data,
  nota,
  instituicao,
  logoPlaceholder,
}: ProvaHeaderLayout6Props) {
  return (
    <div className="border border-gray-300 w-[18cm] mb-4 text-[10px]">
      {/* Linha 1: Logo + Nome + Turma */}
      <div className="grid grid-cols-[1.5cm_1fr_2.5cm] gap-2 px-2 py-1 border-b border-gray-300 items-end">
        {/* Logo */}
        <div
          className={`flex items-center justify-center shrink-0 ${
            isEditable ? "cursor-pointer" : "cursor-default"
          } ${logoUrl ? "" : "border border-gray-400 text-[8px]"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo da instituição"
              className="object-contain"
              style={{ maxWidth: "min(100%, 1.5cm)", maxHeight: "min(100%, 1.5cm)" }}
            />
          ) : (
            <span>{logoPlaceholder?.trim() ? logoPlaceholder : ""}</span>
          )}
        </div>

        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Nome:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px]">
            <span>{nome ?? ""}</span>
          </div>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Turma:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px]">
            <span>{turma ?? ""}</span>
          </div>
        </div>
      </div>

      {/* Linha 2: Professor + Disciplina + Data + Nota */}
      <div className="grid grid-cols-[1fr_1fr_2.5cm_1.5cm] gap-2 px-2 py-1 border-b border-gray-300 items-end">
        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Prof.:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px]">
            <span>{professor ?? ""}</span>
          </div>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Disc.:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px]">
            <span>{disciplina ?? ""}</span>
          </div>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Data:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px]">
            <span>{formatDateBR(data ?? "")}</span>
          </div>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Nota:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px]">
            <span>{nota ?? ""}</span>
          </div>
        </div>
      </div>

      {/* Footer Instituição */}
      <div className="instituicao-footer">
        <span><p>{instituicao ?? ""}</p></span>
      </div>
    </div>
  );
}
