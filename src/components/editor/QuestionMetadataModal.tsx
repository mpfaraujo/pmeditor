"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuestionMetadataV1, normalizeGabaritoForTipo } from "./QuestionMetaBar";

type Difficulty = "Fácil" | "Média" | "Difícil";
type QuestionType = "Múltipla Escolha" | "Certo/Errado" | "Discursiva";

function tagsToString(tags?: string[]) {
  return (tags ?? []).join(", ");
}

function stringToTags(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

interface QuestionMetadataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: QuestionMetadataV1;
  onChange: (next: QuestionMetadataV1) => void;
  onSave?: () => void;
  /**
   * "question" -> usa metadata.gabarito
   * "set_questions" -> usa question_item.attrs.answerKey (item ativo)
   */
  docKind?: "question" | "set_questions";
  /** answerKey do question_item ativo (somente quando docKind === "set_questions") */
  itemAnswerKey?: QuestionMetadataV1["gabarito"] | null;
  /** gravação do answerKey do question_item ativo */
  onItemAnswerKeyChange?: (next: QuestionMetadataV1["gabarito"] | null) => void;
}

export function QuestionMetadataModal({
  open,
  onOpenChange,
  value,
  onChange,
  onSave,
  docKind = "question",
  itemAnswerKey = null,
  onItemAnswerKeyChange,
}: QuestionMetadataModalProps) {
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

    if (docKind === "set_questions" && onItemAnswerKeyChange) {
      const normalized = normalizeGabaritoForTipo(t, itemAnswerKey ?? undefined);
      onItemAnswerKeyChange(normalized);
    }
  };

  const activeAnswerKey =
    docKind === "set_questions"
      ? normalizeGabaritoForTipo(tipo, itemAnswerKey ?? undefined)
      : value.gabarito;

  const writeAnswerKey = (next: QuestionMetadataV1["gabarito"]) => {
    if (docKind === "set_questions") {
      onItemAnswerKeyChange?.(next);
      return;
    }
    set({ gabarito: next });
  };

  const handleSave = () => {
    if (onSave) onSave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informações da Questão</DialogTitle>
          <DialogDescription>Preencha os metadados da questão</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Tipo */}
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <label className="text-sm font-medium">Tipo</label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as QuestionType)}>
              <SelectTrigger>
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
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <label className="text-sm font-medium">Dificuldade</label>
            <Select
              value={value.dificuldade ?? "Média"}
              onValueChange={(v) => set({ dificuldade: v as Difficulty })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fácil">Fácil</SelectItem>
                <SelectItem value="Média">Média</SelectItem>
                <SelectItem value="Difícil">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>
{value.tipo !== "Discursiva" && (
  <>
          {/* Gabarito */}
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <label className="text-sm font-medium">Gabarito</label>

            {activeAnswerKey && activeAnswerKey.kind === "mcq" && (
              <Select
  value={activeAnswerKey.correct ?? ""}
  onValueChange={(v) =>
    writeAnswerKey({ kind: "mcq", correct: v as any })
  }
>
  <SelectTrigger>
    <SelectValue placeholder="Selecione" />
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

            {activeAnswerKey && activeAnswerKey.kind === "tf" && (
              <Select
                value={activeAnswerKey.correct}
                onValueChange={(v) =>
                  writeAnswerKey({ kind: "tf", correct: v as any })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="C">Certo</SelectItem>
                  <SelectItem value="E">Errado</SelectItem>
                </SelectContent>
              </Select>
            )}

            {activeAnswerKey && activeAnswerKey.kind === "essay" && (
              <Input disabled value="Discursiva (rubrica depois)" className="bg-muted" />
            )}
          </div>
          </>)}

          {/* Origem */}
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <label className="text-sm font-medium">Origem</label>
            <Select
              value={value.source?.kind ?? "original"}
              onValueChange={(v) =>
                set({
                  source: v === "original" ? { kind: "original" } : { kind: "concurso" },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">Original</SelectItem>
                <SelectItem value="concurso">Concurso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Disciplina */}
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <label className="text-sm font-medium">Disciplina</label>
            <Input
              placeholder="Ex: Matemática"
              value={value.disciplina ?? ""}
              onChange={(e) => set({ disciplina: e.target.value })}
            />
          </div>

          {/* Assunto */}
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <label className="text-sm font-medium">Assunto</label>
            <Input
              placeholder="Ex: Geometria Analítica"
              value={value.assunto ?? ""}
              onChange={(e) => set({ assunto: e.target.value })}
            />
          </div>

          {/* Tags */}
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium">Tags (separadas por vírgula)</label>
            <Input
              placeholder="Ex: circunferência, distância, ponto"
              value={tagsToString(value.tags)}
              onChange={(e) => set({ tags: stringToTags(e.target.value) })}
            />
          </div>

          {/* Campos de Concurso (condicional) */}
          {value.source?.kind === "concurso" && (
            <>
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Concurso</label>
                <Input
                  placeholder="Ex: Prefeitura de São Paulo"
                  value={value.source.concurso ?? ""}
                  onChange={(e) =>
                    set({ source: { ...value.source, concurso: e.target.value } })
                  }
                />
              </div>

              <div className="col-span-2 sm:col-span-1 space-y-2">
                <label className="text-sm font-medium">Banca</label>
                <Input
                  placeholder="Ex: FCC"
                  value={value.source.banca ?? ""}
                  onChange={(e) => set({ source: { ...value.source, banca: e.target.value } })}
                />
              </div>

              <div className="col-span-2 sm:col-span-1 space-y-2">
                <label className="text-sm font-medium">Ano</label>
                <Input
                  placeholder="Ex: 2024"
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
              </div>

              <div className="col-span-2 sm:col-span-1 space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Input
                  placeholder="Ex: Tipo 1, CINZA, AMARELA, etc."
                  value={value.source.cargo ?? ""}
                  onChange={(e) => set({ source: { ...value.source, cargo: e.target.value } })}
                />
              </div>

              <div className="col-span-2 sm:col-span-1 space-y-2">
                <label className="text-sm font-medium">Questão nº</label>
                <Input
                  placeholder="Ex: 42"
                  value={value.source.numero ?? ""}
                  onChange={(e) => set({ source: { ...value.source, numero: e.target.value } })}
                />
              </div>
            </>
          )}

          <div className="col-span-2 text-xs text-muted-foreground">ID: {value.id}</div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {onSave && <Button onClick={handleSave}>Salvar Questão</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
