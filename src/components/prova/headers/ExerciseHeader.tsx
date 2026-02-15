/**
 * Cabeçalho de Lista de Exercício
 * Inclui: Logo + título + metadados (opcional)
 */

interface ExerciseHeaderProps {
  logoUrl: string | null;
  logoPlaceholder?: string;
  
  onLogoClick: () => void;
  isEditable?: boolean;

  // opcionais (vindos do provaConfig)
  instituicao?: string;
  titulo?: string; // ex: "Lista de Exercícios"
  professor?: string;
  disciplina?: string;
  turma?: string;
  data?: string; // YYYY-MM-DD
}

function formatDateBR(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(2)}`;
}

export function ExerciseHeader({
  logoUrl,
  onLogoClick,
  isEditable = true,
  instituicao,
  titulo = "Lista de Exercícios",
  professor,
  disciplina,
  turma,
  data,
  logoPlaceholder
}: ExerciseHeaderProps) {
  const metaLeft = [disciplina, turma].filter(Boolean).join(" • ");
  const metaRight = [professor, data ? formatDateBR(data) : ""].filter(Boolean).join(" • ");

  return (
    <div className="exercise-header">
      <div className="pt-4 pb-4">
        <div className="flex items-center gap-4">
          <div
            className={`logo-area flex items-center justify-center font-bold ${
              isEditable ? "cursor-pointer" : "cursor-default"
            } ${logoUrl ? "" : "border-2 border-gray-800"}`}
            onClick={isEditable ? onLogoClick : undefined}
            style={{ width: 86, height: 56 }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo da instituição"
                className="object-contain" style={{ maxWidth: 'min(100%, 2cm)', maxHeight: 'min(100%, 2cm)' }}
              />
            ) : (
              <span className="text-xs">LOGO</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold text-gray-900 leading-tight truncate">
              {titulo}
            </div>

            {(metaLeft || metaRight) && (
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-gray-700">
                <div className="truncate">{metaLeft}</div>
                <div className="truncate">{metaRight}</div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-1 h-px bg-gray-800 w-full" />
      </div>
    </div>
  );
}
