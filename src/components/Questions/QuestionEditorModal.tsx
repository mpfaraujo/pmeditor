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

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(60vw-2rem)] max-w-none h-[92vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Editar questão</DialogTitle>
        </DialogHeader>

        <div className="h-full overflow-y-auto px-6 pb-6">
          <QuestionEditor
            modal
            initial={{
              metadata: question.metadata,
              content: question.content,
            }}
            onSaved={async (info) => {
              if (saving) return;
              setSaving(true);

              try {
                const updated = await getQuestion(info.questionId);
                onSaved(updated, info);
                onOpenChange(false);
              } finally {
                setSaving(false);
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
