import { associateReviewHints, parseTranscriptionReviewReport } from "@/lib/importReview";

const raw = {
  schemaVersion: 1,
  transcriptionRun: "abc",
  generatedAt: "2026-08-10T12:00:00.000Z",
  questions: [{ numero: "136", pagina: 16, severity: "attention", flags: ["visual_reconstruction"], details: ["Conferir"] }],
};

describe("relatório externo de revisão", () => {
  it("valida schema e associa somente por número único", () => {
    const report = parseTranscriptionReviewReport(raw);
    const queue = [{ meta: { numero: "135" }, latex: "original" }, { meta: { numero: "136" }, latex: "original 136" }];
    const before = JSON.stringify(queue);
    const result = associateReviewHints(queue, report);
    expect(result.get(1)?.numero).toBe("136");
    expect(JSON.stringify(queue)).toBe(before);
  });

  it("rejeita flag desconhecida", () => {
    expect(() => parseTranscriptionReviewReport({ ...raw, questions: [{ ...raw.questions[0], flags: ["inventada"] }] })).toThrow(/flags inválidas/);
  });

  it("rejeita associação ausente ou ambígua", () => {
    const report = parseTranscriptionReviewReport(raw);
    expect(() => associateReviewHints([], report)).toThrow(/não encontrada/);
    expect(() => associateReviewHints([{ meta: { numero: "136" } }, { meta: { numero: "136" } }], report)).toThrow(/ambígua/);
  });

  it("rejeita visual_failed antes da importação", () => {
    const report = parseTranscriptionReviewReport({ ...raw, questions: [{ ...raw.questions[0], flags: ["visual_failed"], severity: "error" }] });
    expect(() => associateReviewHints([{ meta: { numero: "136" } }], report)).toThrow(/não pode ser importada/);
  });
});
