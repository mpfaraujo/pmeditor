// src/components/prova/headers/ProvaHeader.tsx

/**
 * Cabeçalho de Prova
 * Inclui: Logo, Nome, Turma, Professor, Disciplina, Data, Nota
 */

interface ProvaHeaderProps {
  logoUrl: string | null;
  onLogoClick: () => void;
  isEditable?: boolean;

  // DADOS VINDOS DO CONTEXTO (provaConfig)
  nome?: string;
  turma?: string;
  professor?: string;
  disciplina?: string;
  data?: string;
  nota?: string;
}
function formatDateBR(value: string) {
  if (!value) return "";
  // espera YYYY-MM-DD
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(2)}`;
}

export function ProvaHeader({
  logoUrl,
  onLogoClick,
  isEditable = true,
  nome,
  turma,
  professor,
  disciplina,
  data,
  nota,
}: ProvaHeaderProps) {
  return (
    <div className="prova-header">
      <div className="header-grid">
        <div
          className={`logo-area flex items-center justify-center text-xs font-bold ${
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
            "LOGO"
          )}
        </div>

        <div className="field-wrapper">
          <div className="field-label">Nome</div>
          <div className="field-content">{nome ?? ""}</div>
        </div>

        <div className="field-wrapper">
          <div className="field-label">Turma</div>
          <div className="field-content">{turma ?? ""}</div>
        </div>
      </div>

      <div className="header-grid-2">
        <div className="field-wrapper">
          <div className="field-label">Professor</div>
          <div className="field-content">{professor ?? ""}</div>
        </div>

        <div className="field-wrapper">
          <div className="field-label">Disciplina</div>
          <div className="field-content">{disciplina ?? ""}</div>
        </div>

        <div className="field-wrapper">
          <div className="field-label">Data</div>
          <div className="field-content">{formatDateBR(data ?? "")}</div>
        </div>

        <div className="field-wrapper">
          <div className="field-label">Nota</div>
          <div className="field-content">{nota ?? ""}</div>
        </div>
      </div>

      <div className="instituicao-footer">
        Centro Federal de Educação Tecnológica Celso Suckow da Fonseca
      </div>
    </div>
  );
}
