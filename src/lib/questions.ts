// src/lib/questions.ts

export type QuestionPayload = {
  metadata: any;
  content: any;
};

export type ProposePayload = {
  questionId: string;
  metadata: any;
  content: any;
};

const BASE_URL =
  process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ??
  "https://mpfaraujo.com.br/guardafiguras/api/questoes";

const TOKEN = process.env.NEXT_PUBLIC_QUESTIONS_TOKEN ?? "";

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

export async function createQuestion(payload: QuestionPayload) {
  const res = await fetch(`${BASE_URL}/create.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Questions-Token": TOKEN,
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function proposeQuestion(payload: ProposePayload) {
  const res = await fetch(`${BASE_URL}/propose.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Questions-Token": TOKEN,
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function getQuestion(id: string) {
  const res = await fetch(`${BASE_URL}/get.php?id=${encodeURIComponent(id)}`, {
    headers: { "X-Questions-Token": TOKEN },
  });
  return handle(res);
}

export async function listQuestions(params?: {
  page?: number;
  limit?: number;

  includeContent?: boolean;

  disciplinas?: string[];
  assuntos?: string[];
  tipos?: string[];
  dificuldades?: string[];
  tags?: string;
}) {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 20));

  if (params?.includeContent) q.set("includeContent", "1");

  if (params?.disciplinas?.length) {
    params.disciplinas.forEach((d) => q.append("disciplinas[]", d));
  }
  if (params?.assuntos?.length) {
    params.assuntos.forEach((a) => q.append("assuntos[]", a));
  }
  if (params?.tipos?.length) {
    params.tipos.forEach((t) => q.append("tipos[]", t));
  }
  if (params?.dificuldades?.length) {
    params.dificuldades.forEach((d) => q.append("dificuldades[]", d));
  }
  if (params?.tags) {
    q.set("tags", params.tags);
  }

  const res = await fetch(`${BASE_URL}/list.php?${q.toString()}`, {
    headers: { "X-Questions-Token": TOKEN },
  });
  return handle(res);
}
