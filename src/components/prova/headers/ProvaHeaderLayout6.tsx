// src/components/prova/headers/ProvaHeaderLayout6.tsx

/**
 * Layout 6 - Horizontal Minimalista
 * Uma única linha horizontal com todos os campos, logo pequena à esquerda
 * Instituição em rodapé fino e elegante
 */

interface ProvaHeaderLayout6Props {
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

export function ProvaHeaderLayout6({
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
}: ProvaHeaderLayout6Props) {
  return (
    <div className="border border-gray-300 w-[18cm] mb-4">
      {/* Linha única com todos os campos */}
      <div className="flex items-end gap-3 p-2 border-b border-gray-300">
        {/* Logo pequena */}
        <div
          className={`w-12 h-12 flex-shrink-0 flex items-center justify-center border border-gray-300 ${
            isEditable ? "cursor-pointer" : "cursor-default"
          }`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <span className="text-[10px] font-semibold text-gray-400">LOGO</span>
          )}
        </div>

        {/* Nome */}
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
            Nome
          </label>
          <div className="border-b border-gray-400 h-5 flex items-end">
            <span className="text-xs">{nome ?? ""}</span>
          </div>
        </div>

        {/* Turma */}
        <div className="w-16">
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
            Turma
          </label>
          <div className="border-b border-gray-400 h-5 flex items-end">
            <span className="text-xs">{turma ?? ""}</span>
          </div>
        </div>

        {/* Professor */}
        <div className="w-32">
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
            Professor
          </label>
          <div className="border-b border-gray-400 h-5 flex items-end">
            <span className="text-xs">{professor ?? ""}</span>
          </div>
        </div>

        {/* Disciplina */}
        <div className="w-28">
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
            Disciplina
          </label>
          <div className="border-b border-gray-400 h-5 flex items-end">
            <span className="text-xs">{disciplina ?? ""}</span>
          </div>
        </div>

        {/* Data */}
        <div className="w-20">
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
            Data
          </label>
          <div className="border-b border-gray-400 h-5 flex items-end">
            <span className="text-xs">{formatDateBR(data ?? "")}</span>
          </div>
        </div>

        {/* Nota */}
        <div className="w-12">
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
            Nota
          </label>
          <div className="border-b border-gray-400 h-5 flex items-end">
            <span className="text-xs">{nota ?? ""}</span>
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
