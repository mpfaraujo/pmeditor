// Serve imagem local (dentro do repo) para a tela /dev/revisar. Só existe em `pnpm dev`.
import { readFile } from "fs/promises";
import { resolve, extname, sep } from "path";
import { bloqueadoForaDeDev } from "@/lib/devOnly";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
};

export async function GET(req: Request) {
  const bloqueio = bloqueadoForaDeDev();
  if (bloqueio) return bloqueio;
  const raw = new URL(req.url).searchParams.get("path") ?? "";
  const abs = resolve(raw);
  const raiz = resolve(process.cwd()) + sep;
  const mime = MIME[extname(abs).toLowerCase()];
  if (!abs.toLowerCase().startsWith(raiz.toLowerCase()) || !mime) {
    return new Response("Caminho não permitido", { status: 403 });
  }
  try {
    const buf = await readFile(abs);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": mime, "Cache-Control": "no-store" } });
  } catch {
    return new Response("Arquivo não encontrado", { status: 404 });
  }
}
