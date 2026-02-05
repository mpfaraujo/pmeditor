// src/components/prova/headers/ProvaHeaderLayout5.tsx

/**
 * Layout 5 - Informações Agrupadas por Tipo
 * Seções visuais: ALUNO | AVALIAÇÃO
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
}: ProvaHeaderLayout5Props) {
  return (
    <div className="border-2 border-gray-800 w-[18cm] mb-4">
      <div className="grid grid-cols-12">
        {/* Logo - ocupa 2 linhas */}
        <div
          className={`col-span-2 row-span-2 border-r-2 border-b-2 border-gray-800 flex items-center justify-center bg-gray-50 p-3 ${
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
            <span className="text-sm font-bold">LOGO</span>
          )}
        </div>

        {/* Header Instituição */}
        <div className="col-span-10 bg-gray-700 text-white py-1.5 px-3 border-b-2 border-gray-800">
          <p className="text-xs font-medium">
            Centro Federal de Educação Tecnológica Celso Suckow da Fonseca
          </p>
        </div>
      </div>

      {/* Conteúdo em duas colunas */}
      <div className="grid grid-cols-12">
        <div className="col-span-2"></div>

        {/* Coluna ALUNO */}
        <div className="col-span-5 p-2 border-r-2 border-gray-800">
          <div className="bg-blue-50 px-2 py-0.5 mb-2 border-l-4 border-blue-600">
            <h3 className="text-xs font-bold text-gray-700 uppercase">Aluno</h3>
          </div>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Nome
              </label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                <span className="text-sm">{nome ?? ""}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Turma
              </label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                <span className="text-sm">{turma ?? ""}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna AVALIAÇÃO */}
        <div className="col-span-5 p-2">
          <div className="bg-green-50 px-2 py-0.5 mb-2 border-l-4 border-green-600">
            <h3 className="text-xs font-bold text-gray-700 uppercase">
              Avaliação
            </h3>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Disciplina
              </label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                <span className="text-sm">{disciplina ?? ""}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Professor
              </label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                <span className="text-sm">{professor ?? ""}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
