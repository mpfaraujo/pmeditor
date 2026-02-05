// src/components/prova/headers/ProvaHeaderLayout10.tsx

/**
 * Layout 10 - Ultra Compacto Premium
 * Máxima economia de espaço, design premium minimalista
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
    <div className="w-[18cm] mb-4">
      {/* Linha superior: Logo + Instituição + Info rápida */}
      <div className="flex items-center justify-between border-b-2 border-gray-900 pb-1 mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-10 h-10 flex items-center justify-center border border-gray-400 ${
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
              <span className="text-[10px] font-bold text-gray-400">LOGO</span>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900 leading-tight">
              CEFET-RJ
            </p>
            <p className="text-[9px] text-gray-600">
              Centro Federal de Educação Tecnológica
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Turma</p>
            <p className="text-xs font-bold text-gray-900">{turma || "—"}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Data</p>
            <p className="text-xs font-bold text-gray-900">{formatDateBR(data ?? "") || "—"}</p>
          </div>
          <div className="bg-gray-900 text-white px-2 py-1">
            <p className="text-[9px] uppercase">Nota</p>
            <p className="text-sm font-bold">{nota || "—"}</p>
          </div>
        </div>
      </div>

      {/* Campos principais em duas linhas compactas */}
      <div className="space-y-1">
        <div className="flex gap-1">
          <span className="text-[10px] font-semibold text-gray-600 w-16">Aluno:</span>
          <span className="text-xs text-gray-900 flex-1">{nome || "—"}</span>
        </div>
        <div className="flex gap-4">
          <div className="flex gap-1 flex-1">
            <span className="text-[10px] font-semibold text-gray-600 w-16">Professor:</span>
            <span className="text-xs text-gray-900 flex-1">{professor || "—"}</span>
          </div>
          <div className="flex gap-1 flex-1">
            <span className="text-[10px] font-semibold text-gray-600 w-20">Disciplina:</span>
            <span className="text-xs text-gray-900 flex-1">{disciplina || "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
