"use client";

import QuestionRendererBase from "@/components/Questions/QuestionRendererBase";

type Props = {
  respostas: Record<number, any[]>;
};

/**
 * Encapsula um doc do miniSchema (doc > block+) num doc de questão
 * pra o QuestionRendererBase conseguir renderizar.
 */
function wrapAsQuestionDoc(miniDoc: any): any {
  if (!miniDoc || miniDoc.type !== "doc") return null;
  return {
    type: "doc",
    content: [
      {
        type: "question",
        content: [
          {
            type: "statement",
            content: miniDoc.content ?? [],
          },
        ],
      },
    ],
  };
}

export default function GabaritoDiscursivo({ respostas }: Props) {
  const nums = Object.keys(respostas)
    .map(Number)
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  if (nums.length === 0) return null;

  return (
    <div className="gabarito-discursivo-wrap">
      <div className="text-center font-bold text-base mb-4">
        Respostas — Questões Discursivas
      </div>

      <div className="space-y-4">
        {nums.map((n) => {
          const rubrics = respostas[n];
          if (!rubrics || rubrics.length === 0) return null;

          return (
            <div key={n} className="gabarito-discursivo-item">
              <div className="font-semibold text-sm mb-1">Questão {n}:</div>
              <div className="pl-2 border-l-2 border-gray-300 space-y-2">
                {rubrics.map((rubric, i) => {
                  const doc = wrapAsQuestionDoc(rubric);
                  if (!doc) return null;
                  return (
                    <div key={i}>
                      {rubrics.length > 1 && (
                        <div className="text-xs text-muted-foreground mb-0.5">
                          Item {String.fromCharCode(97 + i)})
                        </div>
                      )}
                      <QuestionRendererBase content={doc} mode="prova" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
