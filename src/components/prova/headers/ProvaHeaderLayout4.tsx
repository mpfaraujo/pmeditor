// src/components/prova/headers/ProvaHeaderLayout4.tsx

/**
 * Layout 4 - Minimalista com Cabeçalho Superior
 * Instituição no topo, logo lateral, campos empilhados
 */

interface ProvaHeaderLayout4Props {
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

export function ProvaHeaderLayout4({
  logoUrl,
  onLogoClick,
  isEditable = true,
  nome,
  turma,
  professor,
  disciplina,
  data,
  nota,
}: ProvaHeaderLayout4Props) {
  return (
    <div className="border-2 border-gray-800 w-[18cm] mb-4">
      {/* Header Instituição */}
      <div className="bg-gray-700 text-white text-center py-1.5 px-3 border-b-2 border-gray-800">
        <p className="text-xs font-medium">
          Centro Federal de Educação Tecnológica Celso Suckow da Fonseca
        </p>
      </div>

      <div className="grid grid-cols-12">
        {/* Logo */}
        <div
          className={`col-span-2 border-r-2 border-gray-800 flex items-center justify-center bg-gray-50 p-3 ${
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

        {/* Campos */}
        <div className="col-span-10 p-2 space-y-2">
          {/* Nome + Turma */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-9">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Nome
              </label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                <span className="text-sm">{nome ?? ""}</span>
              </div>
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Turma
              </label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5">
                <span className="text-sm">{turma ?? ""}</span>
              </div>
            </div>
          </div>

          {/* Professor + Disciplina */}
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

          {/* Data + Nota */}
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
        </div>
      </div>
    </div>
  );
}
