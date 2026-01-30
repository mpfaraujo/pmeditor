/**
 * Cabeçalho de Lista de Exercício
 * Inclui: Logo apenas (simples)
 */

interface ExerciseHeaderProps {
  logoUrl: string | null;
  onLogoClick: () => void;
  isEditable?: boolean;
}

export function ExerciseHeader({ logoUrl, onLogoClick, isEditable = true }: ExerciseHeaderProps) {
  return (
    <div className="exercise-header flex items-center justify-center py-4 border-b-2 border-gray-800">
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
            style={{ maxHeight: "60px" }}
          />
        ) : (
          "LOGO"
        )}
      </div>
    </div>
  );
}
