/**
 * Cabeçalho de Prova
 * Inclui: Logo, Nome, Turma, Professor, Disciplina, Data, Nota
 */

interface ProvaHeaderProps {
  logoUrl: string | null;
  onLogoClick: () => void;
  isEditable?: boolean;
}

export function ProvaHeader({ logoUrl, onLogoClick, isEditable = true }: ProvaHeaderProps) {
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
          <div
            contentEditable={isEditable}
            suppressContentEditableWarning
            className="field-content"
          />
        </div>

        <div className="field-wrapper">
          <div className="field-label">Turma</div>
          <div
            contentEditable={isEditable}
            suppressContentEditableWarning
            className="field-content"
          />
        </div>
      </div>

      <div className="header-grid-2">
        <div className="field-wrapper">
          <div className="field-label">Professor</div>
          <div
            contentEditable={isEditable}
            suppressContentEditableWarning
            className="field-content"
          />
        </div>

        <div className="field-wrapper">
          <div className="field-label">Disciplina</div>
          <div
            contentEditable={isEditable}
            suppressContentEditableWarning
            className="field-content"
          />
        </div>

        <div className="field-wrapper">
          <div className="field-label">Data</div>
          <div
            contentEditable={isEditable}
            suppressContentEditableWarning
            className="field-content"
          />
        </div>

        <div className="field-wrapper">
          <div className="field-label">Nota</div>
          <div
            contentEditable={isEditable}
            suppressContentEditableWarning
            className="field-content"
          />
        </div>
      </div>

      <div
        contentEditable={isEditable}
        suppressContentEditableWarning
        className="instituicao-footer"
      >
        Centro Federal de Educação Tecnológica Celso Suckow da Fonseca
      </div>
    </div>
  );
}
