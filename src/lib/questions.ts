// src/lib/questions.ts

export type QuestionPayload = {
  metadata: any;
  content: any;
};

export type ProposePayload = {
  questionId: string;
  metadata: any;
  content: any;
  changeDescription?: string;
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
  includeBase?: boolean;

  disciplinas?: string[];
  assuntos?: string[];
  tipos?: string[];
  dificuldades?: string[];
  tags?: string;

  sourceKind?: string;
  rootType?: string;
  concursos?: string[];
  anos?: string[];
  myQuestions?: boolean; // Filtrar apenas questões do usuário logado
}) {
  const q = new URLSearchParams();
  q.set("page", String(params?.page ?? 1));
  q.set("limit", String(params?.limit ?? 20));

  if (params?.includeContent) q.set("includeContent", "1");
  if (params?.includeBase) q.set("includeBase", "1");

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
  if (params?.sourceKind) {
    q.set("source_kind", params.sourceKind);
  }
  if (params?.rootType) {
    q.set("root_type", params.rootType);
  }
  if (params?.concursos?.length) {
    params.concursos.forEach((c) => q.append("concursos[]", c));
  }
  if (params?.anos?.length) {
    params.anos.forEach((a) => q.append("anos[]", a));
  }
  if (params?.myQuestions) {
    q.set("myQuestions", "1");
  }

  const headers: Record<string, string> = {};

  // Se for filtro de "minhas questões", usa session token
  if (params?.myQuestions) {
    const sessionToken = typeof window !== "undefined" ? localStorage.getItem("pmeditor:session") : null;
    if (sessionToken) {
      headers["X-Session-Token"] = sessionToken;
    }
  } else {
    headers["X-Questions-Token"] = TOKEN;
  }

  const res = await fetch(`${BASE_URL}/list.php?${q.toString()}`, { headers });
  return handle(res);
}

export type QuestionVersion = {
  kind: "base" | "variant";
  id: string;
  updatedAt: string;
  author: string | null;
  metadata: any;
  content?: any;
  changeDescription?: string | null;
};

export type VersionHistoryResponse = {
  success: true;
  questionId: string;
  total: number;
  variants: QuestionVersion[];
};

export async function getQuestionVariants(
  questionId: string,
  includeContent = true
): Promise<VersionHistoryResponse> {
  const params = new URLSearchParams({ questionId });
  if (includeContent) params.set("includeContent", "1");

  const res = await fetch(`${BASE_URL}/variants.php?${params}`, {
    headers: { "X-Questions-Token": TOKEN },
  });

  return handle(res);
}

function getSessionToken(): string {
  return typeof window !== "undefined"
    ? (localStorage.getItem("pmeditor:session") ?? "")
    : "";
}

export async function deleteQuestion(id: string): Promise<void> {
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

export async function deleteVariant(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/delete-variant.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Token": getSessionToken(),
    },
    body: JSON.stringify({ id }),
  });
  await handle(res);
}

export async function deleteVariants(ids: string[]): Promise<void> {
  const res = await fetch(`${BASE_URL}/delete-variant.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Token": getSessionToken(),
    },
    body: JSON.stringify({ ids }),
  });
  await handle(res);
}

export async function updateQuestion(payload: QuestionPayload): Promise<void> {
  const res = await fetch(`${BASE_URL}/update.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Token": getSessionToken(),
    },
    body: JSON.stringify(payload),
  });
  await handle(res);
}

export async function promoteVariant(variantId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/promote-variant.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Token": getSessionToken(),
    },
    body: JSON.stringify({ variantId }),
  });
  await handle(res);
}
