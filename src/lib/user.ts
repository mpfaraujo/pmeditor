import type { UserProfile } from "@/types/user";

// A env NEXT_PUBLIC_QUESTIONS_API_BASE termina em /questoes
// Para users, precisamos da raiz da API (sem /questoes)
const QUESTIONS_BASE =
  process.env.NEXT_PUBLIC_QUESTIONS_API_BASE ??
  "https://mpfaraujo.com.br/guardafiguras/api/questoes";
const BASE_URL = QUESTIONS_BASE.replace(/\/questoes\/?$/, "");

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

export async function loginWithGoogle(
  idToken: string
): Promise<{ sessionToken: string; profile: UserProfile }> {
  const res = await fetch(`${BASE_URL}/users/login.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ idToken }),
  });
  return handle(res);
}

export async function getProfile(
  sessionToken: string
): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/users/profile.php`, {
    headers: { "X-Session-Token": sessionToken },
  });
  return handle(res);
}

export async function saveProfile(
  sessionToken: string,
  profile: Partial<UserProfile>
): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/users/profile.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Token": sessionToken,
    },
    body: JSON.stringify(profile),
  });
  return handle(res);
}
