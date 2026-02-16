// src/components/prova/headers/ProvaHeaderLayout7.tsx

/**
 * Layout 7 - Clean Card Style
 * Design limpo, campos agrupados visualmente, sem bordas arredondadas
 */

interface ProvaHeaderLayout7Props {
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

export function ProvaHeaderLayout7({
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
}: ProvaHeaderLayout7Props) {
  return (
    <div className="w-[18cm] border border-gray-200 mb-4">
      {/* Header com logo e instituição */}
      <div className="grid grid-cols-[1.5cm_1fr] border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div
          className={`flex items-center justify-center p-1 ${
            isEditable ? "cursor-pointer" : "cursor-default"
          } ${logoUrl ? "" : "text-[8px] text-gray-400"}`}
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
        <div className="flex items-center px-2 py-1.5">
          <div className="instituicao-footer">
            <span><p>{instituicao ?? ""}</p></span>
          </div>
        </div>
      </div>

      {/* Campos organizados */}
      <div className="p-2 space-y-1.5">
        {/* Linha 1: Nome completo */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            Aluno
          </label>
          <div className="mt-0.5 text-sm font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[16px]">
            {nome || ""}
          </div>
        </div>

        {/* Linha 2: Grade com campos menores */}
        <div className="grid grid-cols-[2.5cm_1fr_1fr_2.5cm_1.5cm] gap-2">
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Turma
            </label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px]">
              {turma || ""}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Professor
            </label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px]">
              {professor || ""}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Disciplina
            </label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px]">
              {disciplina || ""}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Data
            </label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px]">
              {formatDateBR(data ?? "")}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Nota
            </label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px]">
              {nota || ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
