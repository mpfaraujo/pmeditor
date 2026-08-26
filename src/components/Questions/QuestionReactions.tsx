"use client";
import { useState } from "react";
import { Heart, Flag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleReaction, type ToggleParams } from "@/lib/reactions";
import type { QuestionReactions as ReactionsType, ReportReason } from "@/lib/questions";
import { ReportModal } from "./ReportModal";

const REASON_LABEL: Record<ReportReason, string> = {
  content: "impróprio",
  answer: "gabarito",
  wording: "enunciado",
  missing_image: "figura",
  duplicate: "duplicada",
  metadata: "classificação",
};

export type QuestionReactionsProps = {
  questionId: string;
  initial: ReactionsType;
  /** Chamado quando o estado muda (pra pai atualizar cache local, se quiser). */
  onChange?: (next: ReactionsType) => void;
  /** true se o usuário está logado. Se false, botões avisam pra logar. */
  loggedIn: boolean;
};

export function QuestionReactions({
  questionId,
  initial,
  onChange,
  loggedIn,
}: QuestionReactionsProps) {
  const [state, setState] = useState<ReactionsType>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const doToggle = async (payload: ToggleParams) => {
    // Otimistic pro like
    const prev = state;
    if (payload.kind === "like") {
      setState({
        ...state,
        likes_count: state.likes_count + (state.my_liked ? -1 : 1),
        my_liked: !state.my_liked,
      });
    }
    setPending(true);
    try {
      const res = await toggleReaction(payload);
      const next: ReactionsType = {
        likes_count: res.likes_count,
        reports: res.reports,
        my_liked: res.my_liked,
        my_report: res.my_report,
        blocked: res.blocked,
      };
      setState(next);
      onChange?.(next);
    } catch (e) {
      setState(prev); // reverte
      console.error(e);
    } finally {
      setPending(false);
    }
  };

  const handleLike = () => {
    if (!loggedIn) {
      alert("Faça login pra curtir.");
      return;
    }
    doToggle({ question_id: questionId, kind: "like" });
  };

  const handleReport = () => {
    if (!loggedIn) {
      alert("Faça login pra reportar.");
      return;
    }
    setModalOpen(true);
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLike}
        disabled={pending}
        className="gap-1"
        title={state.my_liked ? "Descurtir" : "Curtir"}
      >
        <Heart
          className={state.my_liked ? "fill-current text-red-500" : ""}
          size={16}
        />
        <span>{state.likes_count}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleReport}
        disabled={pending}
        className={state.my_report ? "text-orange-500" : ""}
        title="Reportar problema"
      >
        <Flag size={16} />
      </Button>

      {state.reports.length > 0 && (
        <div
          className="flex items-center gap-1 text-xs text-orange-600"
          title={state.reports
            .map((r) => `${REASON_LABEL[r.reason]}: ${r.count}`)
            .join(", ")}
        >
          <AlertTriangle size={14} />
          <span>
            {state.reports
              .map((r) => `${REASON_LABEL[r.reason]}×${r.count}`)
              .join(" ")}
          </span>
        </div>
      )}

      <ReportModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        myReport={state.my_report}
        onSubmit={async (p) => {
          setModalOpen(false);
          await doToggle({ question_id: questionId, kind: "report", ...p });
        }}
        onUndo={async () => {
          setModalOpen(false);
          if (state.my_report) {
            // Mandamos o reason atual — backend só olha (question_id, user_id, kind)
            // pra decidir toggle, então isto apaga.
            await doToggle({
              question_id: questionId,
              kind: "report",
              reason: state.my_report.reason,
            });
          }
        }}
      />
    </div>
  );
}
