// src/lib/turmas.ts

export interface FilterValues {
  disciplinas: string[];
  assuntos: string[];
  tipos: string[];
  dificuldades: string[];
  tags: string;
  sourceKind: string;
  rootType: string;
  concursos: string[];
  anos: string[];
}

export interface Turma {
  id: number;
  google_id: string;
  nome: string;
  descricao: string | null;
  filtros: FilterValues;
  created_at: string;
  updated_at: string;
}

const QUESTIONS_BASE =
  process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ??
  "https://mpfaraujo.com.br/guardafiguras/api/questoes";
const BASE_URL = QUESTIONS_BASE.replace(/\/questoes\/?$/, "") + "/turmas";

async function handle(res: Response) {
  const text = await res.text();

  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok || (body && body.success === false)) {
    const msg = body?.error || text || `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; body?: any };
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body ?? {};
}

function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("pmeditor:session") || "";
}

export async function createTurma(payload: {
  nome: string;
  descricao?: string;
  filtros: FilterValues;
}): Promise<Turma> {
  const res = await fetch(`${BASE_URL}/create.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Token": getSessionToken(),
    },
    body: JSON.stringify(payload),
  });
  const data = await handle(res);
  return data.turma;
}

export async function listTurmas(): Promise<Turma[]> {
  const res = await fetch(`${BASE_URL}/list.php`, {
    headers: { "X-Session-Token": getSessionToken() },
  });
  const data = await handle(res);
  return data.turmas || [];
}

export async function updateTurma(payload: {
  id: number;
  nome: string;
  descricao?: string;
  filtros: FilterValues;
}): Promise<Turma> {
  const res = await fetch(`${BASE_URL}/update.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Token": getSessionToken(),
    },
    body: JSON.stringify(payload),
  });
  const data = await handle(res);
  return data.turma;
}

export async function deleteTurma(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/delete.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Token": getSessionToken(),
    },
    body: JSON.stringify({ id }),
  });
  await handle(res);
}
