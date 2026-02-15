// src/components/prova/headers/ProvaHeaderLayout9.tsx

/**
 * Layout 9 - Modern Split
 * Design moderno com barra lateral de accent color, campos fluidos
 */

interface ProvaHeaderLayout9Props {
  logoUrl: string | null;
  onLogoClick: () => void;
  isEditable?: boolean;
  nome?: string;
  turma?: string;
  professor?: string;
  disciplina?: string;
  data?: string;
  nota?: string;
  instituicao?:string;
  logoPlaceholder?: string;
}

function formatDateBR(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(2)}`;
}

export function ProvaHeaderLayout9({
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
  logoPlaceholder
}: ProvaHeaderLayout9Props) {
  return (
    <div className="w-[18cm] flex border border-gray-300 mb-4">
      {/* Barra lateral com accent */}
      <div className="w-3 bg-gradient-to-b from-blue-600 to-blue-800"></div>

      {/* Conteúdo principal */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
        <div
          className={`logo-area [grid-row:auto] flex items-center justify-center text-xs font-bold ${
            isEditable ? "cursor-pointer" : "cursor-default"
          } ${logoUrl ? "" : "border-2 border-gray-800"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo da instituição"
              className="max-w-[2cm] max-h-[2cm] object-contain"
            />
          ) : (
              <span className="text-xs font-bold">
    {logoPlaceholder?.trim() ? logoPlaceholder : ""}
  </span>
          )}
        </div>
    {/* Footer Instituição */}
      <div className="instituicao-footer">
        <span><p>{instituicao?? ""}</p></span>
      </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] text-gray-500">Data</p>
              <p className="text-xs font-semibold text-gray-800">{formatDateBR(data ?? "") || "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-500">Nota</p>
              <p className="text-xs font-semibold text-blue-700">{nota || "—"}</p>
            </div>
          </div>
        </div>

        {/* Campos */}
        <div className="px-3 py-2 space-y-1.5">
          {/* Nome */}
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase w-16 flex-shrink-0">
              Aluno:
            </span>
            <span className="text-xs text-gray-900 flex-1 border-b border-dotted border-gray-300">
              {nome || "—"}
            </span>
          </div>

          {/* Professor e Disciplina */}
          <div className="flex gap-4">
            <div className="flex items-baseline gap-2 flex-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase w-16 flex-shrink-0">
                Professor:
              </span>
              <span className="text-xs text-gray-900 flex-1 border-b border-dotted border-gray-300">
                {professor || "—"}
              </span>
            </div>
            <div className="flex items-baseline gap-2 flex-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase w-16 flex-shrink-0">
                Disciplina:
              </span>
              <span className="text-xs text-gray-900 flex-1 border-b border-dotted border-gray-300">
                {disciplina || "—"}
              </span>
            </div>
            <div className="flex items-baseline gap-2 w-20">
              <span className="text-[10px] font-semibold text-gray-500 uppercase flex-shrink-0">
                Turma:
              </span>
              <span className="text-xs text-gray-900 flex-1 border-b border-dotted border-gray-300">
                {turma || "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
