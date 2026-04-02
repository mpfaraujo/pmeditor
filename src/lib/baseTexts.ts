// src/lib/baseTexts.ts — API calls para banco de textos base

const BT_BASE = (
  process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ??
  "https://mpfaraujo.com.br/guardafiguras/api/questoes"
).replace(/\/questoes\/?$/, "/base_texts");

const TOKEN = process.env.NEXT_PUBLIC_QUESTIONS_TOKEN ?? "";

const HEADERS = {
  "Content-Type": "application/json",
  "X-Questions-Token": TOKEN,
};

export type BaseTextItem = {
  id: string;
  tag: string;
  content?: any;       // ProseMirror doc — só presente no getBaseText
  autor?: string;
  titulo?: string;
  ano_pub?: number;
  disciplina?: string;
  tema?: string;
  genero?: string;
  movimento?: string;
  tags?: string[];
  source?: any;
  createdAt: string;
  updatedAt: string;
};

export async function getBaseText(id: string): Promise<BaseTextItem | null> {
  try {
    const res = await fetch(`${BT_BASE}/get.php?id=${encodeURIComponent(id)}`, {
      headers: HEADERS,
    });
    const json = await res.json();
    if (!json.success) return null;
    return json as BaseTextItem;
  } catch {
    return null;
  }
}

export type ListBaseTextsParams = {
  search?: string;
  disciplina?: string;
  tema?: string;
  genero?: string;
  autor?: string;
  page?: number;
  limit?: number;
};

export async function listBaseTexts(
  params: ListBaseTextsParams = {}
): Promise<{ items: BaseTextItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.search)     qs.set("search", params.search);
  if (params.disciplina) qs.set("disciplina", params.disciplina);
  if (params.tema)       qs.set("tema", params.tema);
  if (params.genero)     qs.set("genero", params.genero);
  if (params.autor)      qs.set("autor", params.autor);
  if (params.page)       qs.set("page", String(params.page));
  if (params.limit)      qs.set("limit", String(params.limit ?? 20));

  try {
    const res = await fetch(`${BT_BASE}/list.php?${qs}`, { headers: HEADERS });
    const json = await res.json();
    if (!json.success) return { items: [], total: 0 };
    return { items: json.items ?? [], total: json.total ?? 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

export type LinkedQuestion = {
  id: string;
  disciplina?: string;
  assunto?: string;
  tipo?: string;
  source?: any;
};

export async function listQuestionsByBaseText(
  baseTextId: string
): Promise<LinkedQuestion[]> {
  try {
    const qs = new URLSearchParams({ base_text_id: baseTextId, limit: "100" });
    const res = await fetch(
      `${BT_BASE.replace(/\/base_texts\/?$/, "/questoes")}/list.php?${qs}`,
      { headers: HEADERS }
    );
    const json = await res.json();
    if (!json.success) return [];
    return (json.items ?? []).map((item: any) => {
      const meta = item.active_metadata_json
        ? (typeof item.active_metadata_json === "string"
            ? JSON.parse(item.active_metadata_json)
            : item.active_metadata_json)
        : {};
      return {
        id: item.id,
        disciplina: meta.disciplina ?? item.disciplina,
        assunto: meta.assunto ?? item.assunto,
        tipo: meta.tipo ?? item.tipo,
        source: meta.source,
      };
    });
  } catch {
    return [];
  }
}

export async function createBaseText(payload: {
  id: string;
  content: any;
  autor?: string;
  titulo?: string;
  disciplina?: string;
  tema?: string;
  genero?: string;
  movimento?: string;
  tags?: string[];
  source?: any;
  author?: any;
}): Promise<{ success: true; id: string; tag: string } | { success: false; duplicate?: boolean; existing_id?: string; existing_tag?: string; error?: string }> {
  try {
    const res = await fetch(`${BT_BASE}/create.php`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
