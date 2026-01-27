"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Difficulty = "Fácil" | "Média" | "Difícil";
export type QuestionType = "Múltipla Escolha" | "Certo/Errado" | "Discursiva";

export type AnswerKey =
  | { kind: "mcq"; correct: "A" | "B" | "C" | "D" | "E" }
  | { kind: "tf"; correct: "C" | "E" }
  | { kind: "essay"; rubric?: string };

export interface QuestionMetadataV1 {
  schemaVersion: 1;

  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO

  author?: { id?: string; name?: string };

  disciplina?: string;
  assunto?: string;
  dificuldade?: Difficulty;
  tipo?: QuestionType;
  tags?: string[];

  gabarito: AnswerKey;

  source?: {
    kind?: "original" | "concurso";
    concurso?: string;
    banca?: string;
    ano?: number;
    cargo?: string;
    prova?: string;
    numero?: string;
  };
}

function tagsToString(tags?: string[]) {
  return (tags ?? []).join(", ");
}
function stringToTags(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function normalizeGabaritoForTipo(tipo: QuestionType, prev?: AnswerKey): AnswerKey {
  if (tipo === "Múltipla Escolha") {
    const correct =
      prev?.kind === "mcq" ? prev.correct : ("A" as const);
    return { kind: "mcq", correct };
  }
  if (tipo === "Certo/Errado") {
    const correct =
      prev?.kind === "tf" ? prev.correct : ("C" as const);
    return { kind: "tf", correct };
  }
  return { kind: "essay", rubric: prev?.kind === "essay" ? prev.rubric : "" };
}

export function QuestionMetaBar({
  value,
  onChange,
}: {
  value: QuestionMetadataV1;
  onChange: (next: QuestionMetadataV1) => void;
}) {
  const tipo = value.tipo ?? "Múltipla Escolha";

  const set = (patch: Partial<QuestionMetadataV1>) => {
    onChange({
      ...value,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const setTipo = (t: QuestionType) => {
    set({
      tipo: t,
      gabarito: normalizeGabaritoForTipo(t, value.gabarito),
    });
  };

  return (
  <div className="border rounded-lg p-2 mb-3 bg-white">
    <div className="grid grid-cols-2 gap-2">
      {/* Tipo */}
      <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20 shrink-0">Tipo</span>
        <Select value={tipo} onValueChange={(v) => setTipo(v as QuestionType)}>
          <SelectTrigger className="h-7 w-full px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Múltipla Escolha">Múltipla Escolha</SelectItem>
            <SelectItem value="Certo/Errado">Certo/Errado</SelectItem>
            <SelectItem value="Discursiva">Discursiva</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dificuldade */}
      <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20 shrink-0">Dificuldade</span>
        <Select
          value={value.dificuldade ?? "Média"}
          onValueChange={(v) => set({ dificuldade: v as Difficulty })}
        >
          <SelectTrigger className="h-7 w-full px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Fácil">Fácil</SelectItem>
            <SelectItem value="Média">Média</SelectItem>
            <SelectItem value="Difícil">Difícil</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Gabarito */}
      <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20 shrink-0">Gabarito</span>

        {value.gabarito.kind === "mcq" && (
          <Select
            value={value.gabarito.correct}
            onValueChange={(v) => set({ gabarito: { kind: "mcq", correct: v as any } })}
          >
            <SelectTrigger className="h-7 w-full px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
              <SelectItem value="D">D</SelectItem>
              <SelectItem value="E">E</SelectItem>
            </SelectContent>
          </Select>
        )}

        {value.gabarito.kind === "tf" && (
          <Select
            value={value.gabarito.correct}
            onValueChange={(v) => set({ gabarito: { kind: "tf", correct: v as any } })}
          >
            <SelectTrigger className="h-7 w-full px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="C">Certo</SelectItem>
              <SelectItem value="E">Errado</SelectItem>
            </SelectContent>
          </Select>
        )}

        {value.gabarito.kind === "essay" && (() => {
          const g = value.gabarito as { kind: "essay"; rubric?: string };
          return (
            <Button
              type="button"
              variant="outline"
              className="h-7 w-full px-2 text-xs"
              onClick={() => set({ gabarito: { kind: "essay", rubric: g.rubric ?? "" } })}
            >
              Rubrica (depois)
            </Button>
          );
        })()}
      </div>

      {/* Origem */}
      <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20 shrink-0">Origem</span>
        <Select
          value={value.source?.kind ?? "original"}
          onValueChange={(v) =>
            set({
              source: v === "original" ? { kind: "original" } : { kind: "concurso" },
            })
          }
        >
          <SelectTrigger className="h-7 w-full px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="original">Original</SelectItem>
            <SelectItem value="concurso">Concurso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Disciplina */}
      <div className="col-span-2 sm:col-span-1">
        <Input
          className="h-7 w-full px-2 text-xs"
          placeholder="Disciplina"
          value={value.disciplina ?? ""}
          onChange={(e) => set({ disciplina: e.target.value })}
        />
      </div>

      {/* Assunto */}
      <div className="col-span-2 sm:col-span-1">
        <Input
          className="h-7 w-full px-2 text-xs"
          placeholder="Assunto"
          value={value.assunto ?? ""}
          onChange={(e) => set({ assunto: e.target.value })}
        />
      </div>

      {/* Tags */}
      <div className="col-span-2">
        <Input
          className="h-7 w-full px-2 text-xs"
          placeholder="Tags (vírgula)"
          value={tagsToString(value.tags)}
          onChange={(e) => set({ tags: stringToTags(e.target.value) })}
        />
      </div>

      {/* Concurso (condicional) */}
      {value.source?.kind === "concurso" && (
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <Input
              className="h-7 w-full px-2 text-xs"
              placeholder="Concurso"
              value={value.source.concurso ?? ""}
              onChange={(e) => set({ source: { ...value.source, concurso: e.target.value } })}
            />
          </div>

          <Input
            className="h-7 w-full px-2 text-xs"
            placeholder="Banca"
            value={value.source.banca ?? ""}
            onChange={(e) => set({ source: { ...value.source, banca: e.target.value } })}
          />

          <Input
            className="h-7 w-full px-2 text-xs"
            placeholder="Ano"
            inputMode="numeric"
            value={value.source.ano?.toString() ?? ""}
            onChange={(e) =>
              set({
                source: {
                  ...value.source,
                  ano: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
          />

          <Input
            className="h-7 w-full px-2 text-xs"
            placeholder="Tipo"
            value={value.source.cargo ?? ""}
            onChange={(e) => set({ source: { ...value.source, cargo: e.target.value } })}
          />

          <Input
            className="h-7 w-full px-2 text-xs"
            placeholder="Questão nº"
            value={value.source.numero ?? ""}
            onChange={(e) => set({ source: { ...value.source, numero: e.target.value } })}
          />
        </div>
      )}

      <div className="col-span-2 text-[11px] text-muted-foreground">
        ID: {value.id}
      </div>
    </div>
  </div>
);

}
