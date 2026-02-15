// src/components/prova/headers/ProvaHeaderLayout1.tsx

/**
 * Layout 1 - Vertical com Sidebar
 * Logo na lateral esquerda ocupando toda altura
 */

interface ProvaHeaderLayout1Props {
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

export function ProvaHeaderLayout1({
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
}: ProvaHeaderLayout1Props) {
  return (
    <div className="border-2 border-gray-800 w-[18cm] mb-4">
      <div className="grid grid-cols-12">
        {/* Logo Sidebar */}
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

        {/* Conteúdo Principal */}
        <div className="col-span-10">
          {/* Linha 1: Nome + Turma/Data/Nota */}
          <div className="p-2 border-b-2 border-gray-800">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8">
                <label className="block text-xs font-medium text-gray-600 mb-0.5">
                  Nome
                </label>
                <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                  <span className="text-sm">{nome ?? ""}</span>
                </div>
              </div>
              <div className="col-span-4 grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">
                    Turma
                  </label>
                  <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                    <span className="text-sm">{turma ?? ""}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">
                    Data
                  </label>
                  <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                    <span className="text-sm">{formatDateBR(data ?? "")}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">
                    Nota
                  </label>
                  <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                    <span className="text-sm">{nota ?? ""}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Linha 2: Professor + Disciplina */}
          <div className="p-2 border-b-2 border-gray-800">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">
                  Professor
                </label>
                <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                  <span className="text-sm">{professor ?? ""}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">
                  Disciplina
                </label>
                <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                  <span className="text-sm">{disciplina ?? ""}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Instituição */}
      <div className="instituicao-footer">
        <span><p>{instituicao?? ""}</p></span>
      </div>
    </div>
  );
}
