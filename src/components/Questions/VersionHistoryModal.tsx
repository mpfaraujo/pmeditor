"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import QuestionRenderer from "./QuestionRenderer";
import { getQuestionVariants, deleteVariants, QuestionVersion } from "@/lib/questions";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string;
  currentVersionId: string | null;
  onVersionSelect: (versionData: QuestionVersion) => void;
};

export function VersionHistoryModal({
  open,
  onOpenChange,
  questionId,
  currentVersionId,
  onVersionSelect,
}: Props) {
  const { isAdmin } = useAuth();
  const [versions, setVersions] = useState<QuestionVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);
    setCheckedIds(new Set());

    getQuestionVariants(questionId, true)
      .then((res) => {
        setVersions(res.variants);
        setSelectedId(
          currentVersionId ?? res.variants[res.variants.length - 1]?.id ?? null
        );
      })
      .catch((err) => {
        setError(err.message || "Erro ao carregar histórico");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, questionId, currentVersionId]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteChecked = async () => {
    if (checkedIds.size === 0) return;
    const ids = [...checkedIds];
    setDeleting(true);
    try {
      await deleteVariants(ids);
      setVersions((prev) => prev.filter((v) => !checkedIds.has(v.id)));
      setCheckedIds(new Set());
      if (selectedId && checkedIds.has(selectedId)) setSelectedId(null);
    } catch (err: any) {
      setError(err.message || "Erro ao excluir versões");
    } finally {
      setDeleting(false);
    }
  };

  const selectedVersion = versions.find((v) => v.id === selectedId);
  const isCurrentVersion = selectedId === currentVersionId;
  // Variantes (não a base) que podem ser excluídas
  const deletableCount = checkedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh]">
        <DialogHeader>
          <DialogTitle>Histórico de Versões</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 h-full overflow-hidden">
          {/* Timeline */}
          <div className="w-80 flex-shrink-0 border-r pr-4 flex flex-col">
            <ScrollArea className="flex-1">
              {loading && (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              )}
              {error && <div className="text-sm text-red-600">{error}</div>}
              {!loading && !error && versions.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhuma versão encontrada</div>
              )}

              <div className="space-y-2">
                {versions.map((v, idx) => (
                  <VersionTimelineItem
                    key={v.id}
                    version={v}
                    index={idx + 1}
                    isSelected={v.id === selectedId}
                    isInProva={v.id === currentVersionId}
                    isChecked={checkedIds.has(v.id)}
                    showCheckbox={isAdmin && v.kind === "variant"}
                    onToggleCheck={() => toggleCheck(v.id)}
                    onClick={() => setSelectedId(v.id)}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Botão excluir selecionadas */}
            {isAdmin && deletableCount > 0 && (
              <div className="pt-3 border-t mt-3">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleDeleteChecked}
                  disabled={deleting}
                >
                  {deleting ? "Excluindo..." : `Excluir selecionadas (${deletableCount})`}
                </Button>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto border rounded-lg p-4">
              {selectedVersion ? (
                <QuestionRenderer content={selectedVersion.content} />
              ) : (
                <div className="text-sm text-muted-foreground">Selecione uma versão</div>
              )}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {isCurrentVersion && (
                  <Badge variant="secondary">Esta versão está na prova</Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (selectedVersion) {
                      onVersionSelect(selectedVersion);
                      onOpenChange(false);
                    }
                  }}
                  disabled={!selectedVersion || isCurrentVersion}
                >
                  Usar esta versão na prova
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VersionTimelineItem({
  version,
  index,
  isSelected,
  isInProva,
  isChecked,
  showCheckbox,
  onToggleCheck,
  onClick,
}: {
  version: QuestionVersion;
  index: number;
  isSelected: boolean;
  isInProva: boolean;
  isChecked: boolean;
  showCheckbox: boolean;
  onToggleCheck: () => void;
  onClick: () => void;
}) {
  const date = new Date(version.updatedAt);
  const relativeTime = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });

  return (
    <div
      className={`
        p-3 rounded-lg border cursor-pointer transition-colors
        ${isSelected ? "bg-blue-50 border-blue-500" : "hover:bg-slate-50"}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {version.kind === "base" && (
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
              BASE
            </Badge>
          )}
          {version.kind === "variant" && (
            <Badge variant="outline">v{index}</Badge>
          )}
          {isInProva && (
            <Badge variant="default" className="bg-green-600">NA PROVA</Badge>
          )}
        </div>
        {showCheckbox && (
          <Checkbox
            checked={isChecked}
            onCheckedChange={onToggleCheck}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      <div className="text-sm">
        <div className="font-medium">{version.author || "Autor desconhecido"}</div>
        <div className="text-xs text-muted-foreground" title={version.updatedAt}>
          {relativeTime}
        </div>
        {version.changeDescription ? (
          <div className="text-xs mt-1 text-slate-700">{version.changeDescription}</div>
        ) : (
          version.kind === "variant" && (
            <div className="text-xs mt-1 text-muted-foreground italic">(sem descrição)</div>
          )
        )}
      </div>
    </div>
  );
}
