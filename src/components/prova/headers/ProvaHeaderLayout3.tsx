// src/components/prova/headers/ProvaHeaderLayout3.tsx

/**
 * Layout 3 - Compacto com Duas Colunas
 * Logo lateral, dados divididos em duas colunas balanceadas
 */

interface ProvaHeaderLayout3Props {
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
  instituicao?:string;
}

function formatDateBR(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(2)}`;
}

export function ProvaHeaderLayout3({
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
}: ProvaHeaderLayout3Props) {
  return (
    <div className="border-2 border-gray-800 w-[18cm] mb-4">
      <div className="grid grid-cols-12">
        {/* Logo */}
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
              className="max-w-full max-h-full object-contain"
            />
          ) : (
              <span className="text-xs font-bold">
    {logoPlaceholder?.trim() ? logoPlaceholder : ""}
  </span>
          )}
        </div>

        {/* Coluna 1: Dados do Aluno */}
        <div className="col-span-5 p-3 border-r-2 border-gray-800 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nome
            </label>
            <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1">
              <span className="text-sm">{nome ?? ""}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Turma
              </label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1">
                <span className="text-sm">{turma ?? ""}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Data
              </label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1">
                <span className="text-sm">{formatDateBR(data ?? "")}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nota
              </label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1">
                <span className="text-sm">{nota ?? ""}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 2: Dados da Disciplina */}
        <div className="col-span-5 p-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Professor
            </label>
            <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1">
              <span className="text-sm">{professor ?? ""}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Disciplina
            </label>
            <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1">
              <span className="text-sm">{disciplina ?? ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Instituição */}

    <div className="instituicao-footer">
        <span><p className="text-sm font-medium">{instituicao?? ""}</p></span>
      </div>
    </div>
  );
}
