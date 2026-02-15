// src/components/prova/headers/ProvaHeaderLayout7.tsx

/**
 * Layout 7 - Clean Card Style
 * Design moderno tipo card, campos agrupados visualmente, sem bordas pesadas
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
  instituicao?:string,
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
  logoPlaceholder
}: ProvaHeaderLayout7Props) {
  return (
    <div className="w-[18cm] bg-white shadow-sm border border-gray-200 mb-4">
      {/* Header com logo e instituição */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
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

      {/* Campos organizados */}
      <div className="p-3 space-y-2">
        {/* Linha 1: Nome completo */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            Aluno
          </label>
          <div className="mt-0.5 text-sm font-medium text-gray-900 border-b border-gray-300 pb-0.5">
            {nome || "—"}
          </div>
        </div>

        {/* Linha 2: Grade com campos menores */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Turma
            </label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5">
              {turma || "—"}
            </div>
          </div>

          <div className="col-span-5">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Professor
            </label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5">
              {professor || "—"}
            </div>
          </div>

          <div className="col-span-3">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Disciplina
            </label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5">
              {disciplina || "—"}
            </div>
          </div>

          <div className="col-span-1">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Data
            </label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5">
              {formatDateBR(data ?? "") || "—"}
            </div>
          </div>

          <div className="col-span-1">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Nota
            </label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5">
              {nota || "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
