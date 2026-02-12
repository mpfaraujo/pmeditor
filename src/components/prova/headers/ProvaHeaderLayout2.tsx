// src/components/prova/headers/ProvaHeaderLayout2.tsx

/**
 * Layout 2 - Grid Simétrico
 * Instituição no topo com logo, campos organizados em grid simétrico
 */

interface ProvaHeaderLayout2Props {
  logoUrl: string | null;
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

export function ProvaHeaderLayout2({
  logoUrl,
  onLogoClick,
  isEditable = true,
  nome,
  turma,
  professor,
  disciplina,
  data,
  nota,
  instituicao
}: ProvaHeaderLayout2Props) {
  return (
    <div className="border-2 border-gray-800 w-[18cm] mb-4">
      {/* Header com Logo e Instituição */}
      <div className="flex items-center gap-2 p-1.5 border-b-2 border-gray-800 bg-gray-700">
        <div
          className={`w-10 h-10 flex-shrink-0 flex items-center justify-center bg-white ${
            isEditable ? "cursor-pointer" : "cursor-default"
          } ${logoUrl ? "" : "border border-gray-800"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo da instituição"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <span className="text-xs font-bold">LOGO</span>
          )}
        </div>
        <p className="text-xs font-medium text-white flex-1">
{instituicao?? ""}
        </p>
      </div>

      {/* Linha 1: Nome + Turma + Data + Nota */}
      <div className="grid grid-cols-12 gap-2 p-1.5 border-b-2 border-gray-800">
        <div className="col-span-5">
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            Nome
          </label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5">
            <span className="text-xs">{nome ?? ""}</span>
          </div>
        </div>
        <div className="col-span-3">
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            Turma
          </label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5">
            <span className="text-xs">{turma ?? ""}</span>
          </div>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            Data
          </label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5">
            <span className="text-xs">{formatDateBR(data ?? "")}</span>
          </div>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            Nota
          </label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5">
            <span className="text-xs">{nota ?? ""}</span>
          </div>
        </div>
      </div>

      {/* Linha 2: Professor + Disciplina */}
      <div className="grid grid-cols-2 gap-2 p-1.5">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            Professor
          </label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5">
            <span className="text-xs">{professor ?? ""}</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            Disciplina
          </label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5">
            <span className="text-xs">{disciplina ?? ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
