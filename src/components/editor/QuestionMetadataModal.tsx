"use client";

import { useEffect, useState } from "react";

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
import { RichTextMiniEditor } from "./RichTextMiniEditor";

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
  docKind?: "question" | "set_questions";
  itemAnswerKey?: QuestionMetadataV1["gabarito"] | null;
  onItemAnswerKeyChange?: (next: QuestionMetadataV1["gabarito"] | null) => void;
  /** Todos os question_items (set_questions) */
  allItems?: { pos: number; answerKey: any | null }[];
  /** Gravar answerKey de um item específico por posição */
  onItemAnswerKeyChangeAtPos?: (pos: number, answerKey: any | null) => void;
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
  allItems = [],
  onItemAnswerKeyChangeAtPos,
}: QuestionMetadataModalProps) {
  const tipo = value.tipo ?? "Múltipla Escolha";

  const set = (patch: Partial<QuestionMetadataV1>) => {
    onChange({
      ...value,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  // ===== Tags: manter texto enquanto digita; converter para array só no commit =====
  const [tagsText, setTagsText] = useState(() => tagsToString(value.tags));

  useEffect(() => {
    setTagsText(tagsToString(value.tags));
  }, [value.tags]);

  const commitTags = () => {
    const parsed = stringToTags(tagsText);
    set({ tags: parsed });
    setTagsText(tagsToString(parsed));
  };
  // ============================================================================

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
      : normalizeGabaritoForTipo(tipo, value.gabarito);

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

          {/* Gabarito (MCQ/TF) */}
          {activeAnswerKey && activeAnswerKey.kind !== "essay" && (
            <div className="col-span-2 sm:col-span-1 space-y-2">
              <label className="text-sm font-medium">Gabarito</label>

              {activeAnswerKey.kind === "mcq" && (
                <Select
                  value={(activeAnswerKey as any).correct ?? ""}
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

              {activeAnswerKey.kind === "tf" && (
                <Select
                  value={(activeAnswerKey as any).correct}
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
            </div>
          )}

          {/* Origem */}
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <label className="text-sm font-medium">Origem</label>
            <Select
              value={value.source?.kind ?? "original"}
              onValueChange={(v) =>
                set({
                  source:
                    v === "original"
                      ? { kind: "original" }
                      : { kind: "concurso" },
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
            <label className="text-sm font-medium">
              Tags (separadas por vírgula)
            </label>
            <Input
              placeholder="Ex: circunferência, distância, ponto"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              onBlur={commitTags}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTags();
                }
              }}
            />
          </div>

          {/* Campos de Concurso (condicional) */}
          {value.source?.kind === "concurso" && (
            <>
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Concurso</label>
                <Input
                  placeholder="Ex: ENEM"
                  value={value.source.concurso ?? ""}
                  onChange={(e) =>
                    set({ source: { ...value.source, concurso: e.target.value } })
                  }
                />
              </div>

              <div className="col-span-2 sm:col-span-1 space-y-2">
                <label className="text-sm font-medium">Banca</label>
                <Input
                  placeholder="Ex: INEP"
                  value={value.source.banca ?? ""}
                  onChange={(e) =>
                    set({ source: { ...value.source, banca: e.target.value } })
                  }
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
                  onChange={(e) =>
                    set({ source: { ...value.source, cargo: e.target.value } })
                  }
                />
              </div>

              <div className="col-span-2 sm:col-span-1 space-y-2">
                <label className="text-sm font-medium">Questão nº</label>
                <Input
                  placeholder="Ex: 42"
                  value={value.source.numero ?? ""}
                  onChange={(e) =>
                    set({ source: { ...value.source, numero: e.target.value } })
                  }
                />
              </div>
            </>
          )}

          {/* Resposta-modelo — questão simples */}
          {activeAnswerKey?.kind === "essay" && docKind === "question" && (
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium">Resposta-modelo</label>
              <RichTextMiniEditor
                value={(activeAnswerKey as any).rubric}
                onChange={(docJson) =>
                  writeAnswerKey({ kind: "essay", rubric: docJson })
                }
              />
            </div>
          )}

          {/* Resposta-modelo — cada item do set_questions */}
          {activeAnswerKey?.kind === "essay" && docKind === "set_questions" && allItems.length > 0 && (
            <div className="col-span-2 space-y-3">
              <label className="text-sm font-medium">Respostas-modelo por item</label>
              {allItems.map((item, idx) => {
                const ak = normalizeGabaritoForTipo(tipo, item.answerKey ?? undefined);
                if (ak.kind !== "essay") return null;
                return (
                  <div key={item.pos} className="space-y-1">
                    <span className="text-xs text-muted-foreground">Item {idx + 1}</span>
                    <RichTextMiniEditor
                      value={(ak as any).rubric}
                      onChange={(docJson) =>
                        onItemAnswerKeyChangeAtPos?.(item.pos, { kind: "essay", rubric: docJson })
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="col-span-2 text-xs text-muted-foreground">
            ID: {value.id}
          </div>
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
