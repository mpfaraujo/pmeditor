"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuestionEditor } from "@/components/editor/QuestionEditor";
import { getQuestion } from "@/lib/questions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: {
    metadata: any;
    content: any;
  } | null;

  onSaved: (updated: any, info: { questionId: string; kind: "base" | "variant" }) => void;
};

export function QuestionEditorModal({ open, onOpenChange, question, onSaved }: Props) {
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(60vw-2rem)] max-w-none h-[92vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{question ? "Editar questão" : "Nova questão"}</DialogTitle>
        </DialogHeader>

        <div className="h-full overflow-y-auto px-6 pb-6">
          <QuestionEditor
            modal
            initial={question ? {
              metadata: question.metadata,
              content: question.content,
            } : undefined}
            onSaved={async (info) => {
              if (saving) return;
              setSaving(true);
              try {
                const updated = await getQuestion(info.questionId);
                onSaved(updated, info);
              } catch {
                // mesmo se getQuestion falhar, atualiza com o que o editor tem
                onSaved({}, info);
              } finally {
                setSaving(false);
                onOpenChange(false);
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
