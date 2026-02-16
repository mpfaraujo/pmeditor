// src/components/prova/headers/ProvaHeaderLayout8.tsx

/**
 * Layout 8 - Tabela Compacta Elegante
 * Formato de tabela limpa, linhas alternadas sutis, máxima densidade de informação
 */

interface ProvaHeaderLayout8Props {
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
  instituicao?:string
}

function formatDateBR(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(2)}`;
}

export function ProvaHeaderLayout8({
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
}: ProvaHeaderLayout8Props) {
  return (
    <div className="w-[18cm] border border-gray-300 mb-4">
      {/* Header com instituição */}
      <div className="bg-gray-400 text-white py-1 px-3 flex items-center justify-between">
    {/* Footer Instituição */}
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
              className="object-contain" style={{ maxWidth: 'min(100%, 2cm)', maxHeight: 'min(100%, 2cm)' }}
            />
          ) : (
              <span className="text-xs font-bold">
    {logoPlaceholder?.trim() ? logoPlaceholder : ""}
  </span>
          )}
        </div>
      </div>

      {/* Tabela de dados */}
      <div className="divide-y divide-gray-200">
        {/* Linha 1 */}
        <div className="grid grid-cols-12 bg-white">
          <div className="col-span-2 px-2 py-1 bg-gray-50 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Nome:</span>
          </div>
          <div className="col-span-10 px-2 py-1">
            <span className="text-xs text-gray-900">{nome || "—"}</span>
          </div>
        </div>

        {/* Linha 2 */}
        <div className="grid grid-cols-12 bg-gray-0">
          <div className="col-span-2 px-2 py-1 bg-gray-100 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Professor:</span>
          </div>
          <div className="col-span-4 px-2 py-1 border-r border-gray-200">
            <span className="text-xs text-gray-900">{professor || "—"}</span>
          </div>
          <div className="col-span-2 px-2 py-1 bg-gray-100 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Disciplina:</span>
          </div>
          <div className="col-span-4 px-2 py-1">
            <span className="text-xs text-gray-900">{disciplina || "—"}</span>
          </div>
        </div>

        {/* Linha 3 */}
        <div className="grid grid-cols-12 bg-white">
          <div className="col-span-2 px-2 py-1 bg-gray-50 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Turma:</span>
          </div>
          <div className="col-span-4 px-2 py-1 border-r border-gray-200">
            <span className="text-xs text-gray-900">{turma || "—"}</span>
          </div>
          <div className="col-span-2 px-2 py-1 bg-gray-50 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Data:</span>
          </div>
          <div className="col-span-2 px-2 py-1 border-r border-gray-200">
            <span className="text-xs text-gray-900">{formatDateBR(data ?? "") || "—"}</span>
          </div>
          <div className="col-span-1 px-2 py-1 bg-gray-50 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Nota:</span>
          </div>
          <div className="col-span-1 px-2 py-1">
            <span className="text-xs text-gray-900">{nota || "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
