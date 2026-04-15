// src/lib/baseTexts.ts — API calls para banco de textos base
import type { CanonicalLineMap } from "@/lib/lineRefMeasure";

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
  lineMap?: CanonicalLineMap;  // linhas canônicas por âncora (2col/1col/acessivel)
  createdAt: string;
  updatedAt: string;
};

export async function getBaseTexts(ids: string[]): Promise<BaseTextItem[]> {
  if (ids.length === 0) return [];
  const results = await Promise.all(ids.map(getBaseText));
  return results.filter((r): r is BaseTextItem => r !== null);
}

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

const Q_BASE = (
  process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ??
  "https://mpfaraujo.com.br/guardafiguras/api/questoes"
);

export async function linkBaseTexts(
  questionId: string,
  baseTextIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${Q_BASE}/link-base-texts.php`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ question_id: questionId, base_text_ids: baseTextIds }),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateBaseText(payload: {
  id: string;
  content?: any;
  autor?: string | null;
  titulo?: string | null;
  disciplina?: string | null;
  tema?: string | null;
  genero?: string | null;
  movimento?: string | null;
  ano_pub?: number | null;
  tags?: string[] | null;
  source?: any | null;
  lineMap?: CanonicalLineMap | null;
}): Promise<{ success: true; id: string; tag: string; updatedAt: string } | { success: false; error?: string }> {
  try {
    const res = await fetch(`${BT_BASE}/update.php`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteBaseText(
  id: string,
  force = false
): Promise<
  | { success: true; id: string; tag: string }
  | { success: false; linked?: true; linkedCount?: number; error?: string }
> {
  try {
    const res = await fetch(`${BT_BASE}/delete.php`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ id, force }),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
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
  lineMap?: CanonicalLineMap;
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
