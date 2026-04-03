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
import { AssuntoCombobox } from "./AssuntoCombobox";
import { BaseTextPickerModal } from "./BaseTextPickerModal";
import { getBaseText } from "@/lib/baseTexts";
import QuestionRenderer from "@/components/Questions/QuestionRenderer";

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

/** Input de tags com estado local — evita re-render por item */
function ItemTagsInput({ initialTags, onCommit }: { initialTags: string[]; onCommit: (tags: string[]) => void }) {
  const [text, setText] = useState(() => tagsToString(initialTags));
  const commit = () => {
    const parsed = stringToTags(text);
    setText(tagsToString(parsed));
    onCommit(parsed);
  };
  return (
    <Input
      placeholder="Tags (separadas por vírgula)"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
    />
  );
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
  allItems?: { pos: number; answerKey: any | null; assunto: string | null; tags: string[] | null }[];
  /** Gravar answerKey de um item específico por posição */
  onItemAnswerKeyChangeAtPos?: (pos: number, answerKey: any | null) => void;
  /** Gravar assunto/tags de um item específico por posição */
  onItemMetaChangeAtPos?: (pos: number, patch: { assunto?: string | null; tags?: string[] | null }) => void;
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
  onItemMetaChangeAtPos,
}: QuestionMetadataModalProps) {
  const tipo = value.tipo ?? "Múltipla Escolha";

  // ── Texto base ──────────────────────────────────────────────────────────────
  const [baseTextPickerOpen, setBaseTextPickerOpen] = useState(false);
  const [baseTextTags, setBaseTextTags] = useState<Map<string, string>>(new Map()); // id → tag
  const [baseTextPreviews, setBaseTextPreviews] = useState<Map<string, any>>(new Map()); // id → content
  const [baseTextPreviewId, setBaseTextPreviewId] = useState<string | null>(null);

  // IDs canônicos: novo formato (baseTextIds[]) com fallback legado (baseTextId)
  const btIds: string[] = Array.isArray(value.baseTextIds) && value.baseTextIds.length > 0
    ? value.baseTextIds
    : (value.baseTextId ? [value.baseTextId] : []);

  useEffect(() => {
    if (!open || btIds.length === 0) {
      setBaseTextTags(new Map());
      setBaseTextPreviews(new Map());
      return;
    }
    const missing = btIds.filter(id => !baseTextTags.has(id));
    if (missing.length === 0) return;
    Promise.all(missing.map(id => getBaseText(id).then(bt => ({ id, bt })))).then(results => {
      setBaseTextTags(prev => {
        const next = new Map(prev);
        for (const { id, bt } of results) if (bt?.tag) next.set(id, bt.tag);
        return next;
      });
      setBaseTextPreviews(prev => {
        const next = new Map(prev);
        for (const { id, bt } of results) if (bt?.content) next.set(id, bt.content);
        return next;
      });
    });
  }, [open, btIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const addBaseText = (id: string, tag: string) => {
    if (btIds.includes(id)) return;
    const next = [...btIds, id];
    set({ baseTextIds: next, baseTextId: next[0] });
    setBaseTextTags(prev => new Map(prev).set(id, tag));
  };

  const removeBaseText = (id: string) => {
    const next = btIds.filter(x => x !== id);
    set({ baseTextIds: next.length ? next : undefined, baseTextId: next[0] ?? null });
  };
  // ───────────────────────────────────────────────────────────────────────────

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

          {/* Nível de Ensino */}
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <label className="text-sm font-medium">Nível de Ensino</label>
            <Select
              value={value.nivel ?? "medio"}
              onValueChange={(v) => set({ nivel: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fundamental">Fundamental</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="superior">Superior</SelectItem>
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

          {/* Assunto — só em questão individual */}
          {docKind !== "set_questions" && (
            <div className="col-span-2 sm:col-span-1 space-y-2">
              <label className="text-sm font-medium">Assunto</label>
              <AssuntoCombobox
                placeholder="Ex: Geometria Analítica"
                value={value.assunto ?? ""}
                onChange={(v) => set({ assunto: v })}
                disciplina={value.disciplina}
              />
            </div>
          )}

          {/* Tags — só em questão individual */}
          {docKind !== "set_questions" && (
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
          )}

          {/* Texto base */}
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium">Texto base</label>
            <div className="flex flex-wrap items-center gap-2">
              {btIds.length === 0 && (
                <span className="text-xs text-muted-foreground">(sem texto base)</span>
              )}
              {btIds.map((id) => (
                <div key={id} className="flex items-center gap-1 bg-primary/10 rounded px-2 py-0.5">
                  <span className="font-mono text-xs text-primary font-bold">
                    {baseTextTags.get(id) ?? id.slice(0, 8) + "…"}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-primary text-xs ml-1"
                    title="Visualizar"
                    onClick={() => setBaseTextPreviewId(id)}
                  >
                    &#128065;
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive text-xs ml-0.5"
                    title="Remover"
                    onClick={() => removeBaseText(id)}
                  >
                    &#x2715;
                  </button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setBaseTextPickerOpen(true)}>
                {btIds.length > 0 ? "+ Adicionar texto" : "Vincular texto base"}
              </Button>
            </div>
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

          {/* Por item (set_questions): assunto, tags e gabarito/rubric */}
          {docKind === "set_questions" && allItems.length > 0 && (
            <div className="col-span-2 space-y-3">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-xs">Por item</label>
              {allItems.map((item, idx) => {
                const ak = normalizeGabaritoForTipo(tipo, item.answerKey ?? undefined);
                return (
                  <div key={item.pos} className="border rounded-md p-3 space-y-2 bg-muted/30">
                    <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
                    <AssuntoCombobox
                      placeholder="Assunto"
                      value={item.assunto ?? ""}
                      onChange={(v) => onItemMetaChangeAtPos?.(item.pos, { assunto: v })}
                      disciplina={value.disciplina}
                    />
                    <ItemTagsInput
                      initialTags={item.tags ?? []}
                      onCommit={(tags) => onItemMetaChangeAtPos?.(item.pos, { tags })}
                    />
                    {ak.kind === "mcq" && (
                      <Select
                        value={(ak as any).correct ?? ""}
                        onValueChange={(v) =>
                          onItemAnswerKeyChangeAtPos?.(item.pos, { kind: "mcq", correct: v as any })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Gabarito" />
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
                    {ak.kind === "tf" && (
                      <Select
                        value={(ak as any).correct ?? ""}
                        onValueChange={(v) =>
                          onItemAnswerKeyChangeAtPos?.(item.pos, { kind: "tf", correct: v as any })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Gabarito" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="C">Certo</SelectItem>
                          <SelectItem value="E">Errado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {ak.kind === "essay" && (
                      <RichTextMiniEditor
                        value={(ak as any).rubric}
                        onChange={(docJson) =>
                          onItemAnswerKeyChangeAtPos?.(item.pos, { kind: "essay", rubric: docJson })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Resolução comentada — todos os tipos */}
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium">Resolução</label>
            <RichTextMiniEditor
              value={value.resolucao}
              onChange={(docJson) => set({ resolucao: docJson })}
              expandable={true}
            />
          </div>

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

      <BaseTextPickerModal
        open={baseTextPickerOpen}
        onOpenChange={setBaseTextPickerOpen}
        disciplina={value.disciplina}
        authorId={value.author?.id}
        authorName={value.author?.name}
        onSelect={(id, tag) => {
          addBaseText(id, tag);
        }}
      />

      {/* Preview do texto base selecionado */}
      <Dialog open={baseTextPreviewId !== null} onOpenChange={(o) => { if (!o) setBaseTextPreviewId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Texto base{baseTextPreviewId && baseTextTags.get(baseTextPreviewId) ? ` — ${baseTextTags.get(baseTextPreviewId)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="print-mode text-sm">
            {baseTextPreviewId && baseTextPreviews.get(baseTextPreviewId) ? (
              <QuestionRenderer content={{
                type: "doc",
                content: [{ type: "question", content: [{ type: "base_text", content: baseTextPreviews.get(baseTextPreviewId)?.content ?? [] }] }],
              }} />
            ) : (
              <p className="text-muted-foreground text-sm">Sem conteúdo disponível.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
