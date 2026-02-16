// src/components/prova/headers/ProvaHeaderLayout10.tsx

/**
 * Layout 10 - Ultra Compacto Premium
 * Máxima economia de espaço, design premium minimalista
 */

interface ProvaHeaderLayout5Props {
  logoUrl: string | null;
  onLogoClick: () => void;
  isEditable?: boolean;
  nome?: string;
  turma?: string;
  professor?: string;
  disciplina?: string;
  data?: string;
  nota?: string;
  instituicao?: string;
  logoPlaceholder?: string;
}

function formatDateBR(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(2)}`;
}

export function ProvaHeaderLayout5({
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
}: ProvaHeaderLayout5Props) {
  return (
    <div className="w-[18cm] mb-4">
      {/* Linha superior: Logo + Instituição + Info rápida */}
      <div className="flex items-center justify-between border-b-2 border-gray-900 pb-1 mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center shrink-0 w-[1.5cm] h-[1.5cm] ${
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
              <span className="text-xs font-bold">
                {logoPlaceholder?.trim() ? logoPlaceholder : ""}
              </span>
            )}
          </div>
          <div className="instituicao-footer">
            <span><p>{instituicao ?? ""}</p></span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Turma</p>
            <p className="text-xs font-bold text-gray-900">{turma || "—"}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Data</p>
            <p className="text-xs font-bold text-gray-900">{formatDateBR(data ?? "") || "—"}</p>
          </div>
          <div className="bg-gray-900 text-white px-2 py-1">
            <p className="text-[9px] uppercase">Nota</p>
            <p className="text-sm font-bold">{nota || "—"}</p>
          </div>
        </div>
      </div>

      {/* Campos principais em duas linhas compactas */}
      <div className="space-y-1">
        <div className="flex gap-1">
          <span className="text-[10px] font-semibold text-gray-600 w-16">Aluno:</span>
          <span className="text-xs text-gray-900 flex-1 border-b border-gray-300">{nome || ""}</span>
        </div>
        <div className="flex gap-4">
          <div className="flex gap-1 flex-1">
            <span className="text-[10px] font-semibold text-gray-600 w-16">Professor:</span>
            <span className="text-xs text-gray-900 flex-1 border-b border-gray-300">{professor || ""}</span>
          </div>
          <div className="flex gap-1 flex-1">
            <span className="text-[10px] font-semibold text-gray-600 w-20">Disciplina:</span>
            <span className="text-xs text-gray-900 flex-1 border-b border-gray-300">{disciplina || ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
