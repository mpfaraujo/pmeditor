// src/lib/reactions.ts — API calls pra curtidas e reports em questões
import type { QuestionReactions, ReportReason } from "./questions";

const API_BASE = (
  process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ??
  "https://mpfaraujo.com.br/guardafiguras/api/questoes"
).replace(/\/questoes\/?$/, "/reactions");

function sessionHeaders(): Record<string, string> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("pmeditor:session") ?? ""
    : "";
  return { "Content-Type": "application/json", "X-Session-Token": token };
}

export type ToggleParams =
  | { question_id: string; kind: "like" }
  | { question_id: string; kind: "report"; reason: ReportReason; duplicate_of?: string };

export type ToggleResponse = QuestionReactions & { question_id: string };

export async function toggleReaction(params: ToggleParams): Promise<ToggleResponse> {
  const res = await fetch(`${API_BASE}/toggle.php`, {
    method: "POST",
    headers: sessionHeaders(),
    body: JSON.stringify(params),
  });
  const body = await res.json();
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return body;
}

export async function clearReports(question_id: string): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/clear.php`, {
    method: "POST",
    headers: sessionHeaders(),
    body: JSON.stringify({ question_id }),
  });
  const body = await res.json();
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return body;
}
