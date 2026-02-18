import { Badge } from "@/components/ui/badge";
import type { FilterValues } from "@/lib/turmas";

interface FilterPreviewProps {
  filtros: FilterValues;
}

export function FilterPreview({ filtros }: FilterPreviewProps) {
  const tags: string[] = [];

  if (filtros.disciplinas?.length) {
    tags.push(`${filtros.disciplinas.length} disciplina(s)`);
  }

  if (filtros.assuntos?.length) {
    tags.push(`${filtros.assuntos.length} assunto(s)`);
  }

  if (filtros.tipos?.length) {
    tags.push(`Tipos: ${filtros.tipos.join(", ")}`);
  }

  if (filtros.dificuldades?.length) {
    tags.push(`Dificuldade: ${filtros.dificuldades.join(", ")}`);
  }

  if (filtros.tags) {
    tags.push(`Tags: ${filtros.tags}`);
  }

  if (filtros.sourceKind) {
    const label = filtros.sourceKind === "original" ? "Original" : "Concurso";
    tags.push(`Origem: ${label}`);
  }

  if (filtros.rootType) {
    const label =
      filtros.rootType === "question" ? "Individual" : "Conjunto";
    tags.push(`Estrutura: ${label}`);
  }

  if (filtros.concursos?.length) {
    tags.push(`${filtros.concursos.length} concurso(s)`);
  }

  if (filtros.anos?.length) {
    tags.push(`Anos: ${filtros.anos.join(", ")}`);
  }

  if (tags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum filtro aplicado</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <Badge key={i} variant="secondary" className="text-xs">
          {tag}
        </Badge>
      ))}
    </div>
  );
}
