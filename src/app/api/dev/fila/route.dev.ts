// Lê e grava a fila de importação para a tela /dev/revisar. Só existe em `pnpm dev`.
import { readFile, writeFile, rename } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";
import { bloqueadoForaDeDev } from "@/lib/devOnly";
import { aplicarEdicao } from "@/lib/importQueue/fila";

const SLUG_RE = /^[a-z0-9-]+$/;

function caminhos(slug: string) {
  const dados = resolve(process.cwd(), "public/data");
  return {
    fila: resolve(dados, `import-queue-${slug}.json`),
    manifest: resolve(dados, `import-queue-${slug}.manifest.json`),
    recortes: resolve(process.cwd(), "scripts/tmp/revisao", slug),
  };
}

async function geradoEm(manifestPath: string): Promise<string | null> {
  if (!existsSync(manifestPath)) return null;
  return JSON.parse(await readFile(manifestPath, "utf-8")).generated_at ?? null;
}

export async function GET(req: Request) {
  const bloqueio = bloqueadoForaDeDev();
  if (bloqueio) return bloqueio;
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!SLUG_RE.test(slug)) return Response.json({ error: "slug inválido" }, { status: 400 });
  const p = caminhos(slug);
  if (!existsSync(p.fila)) return Response.json({ error: `fila não encontrada: ${p.fila}` }, { status: 404 });
  const fila = JSON.parse(await readFile(p.fila, "utf-8"));
  const mapaPath = resolve(p.recortes, "mapa.json");
  const mapa = existsSync(mapaPath) ? JSON.parse(await readFile(mapaPath, "utf-8")) : null;
  return Response.json({ fila, geradoEm: await geradoEm(p.manifest), mapa, dirRecortes: p.recortes });
}

export async function PUT(req: Request) {
  const bloqueio = bloqueadoForaDeDev();
  if (bloqueio) return bloqueio;
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!SLUG_RE.test(slug)) return Response.json({ error: "slug inválido" }, { status: 400 });
  const { index, content, geradoEm: versao } = await req.json();
  const p = caminhos(slug);
  if ((await geradoEm(p.manifest)) !== versao) {
    return Response.json({ error: "A fila foi regenerada pelo parse-tex. Recarregue a página." }, { status: 409 });
  }
  const fila = JSON.parse(await readFile(p.fila, "utf-8"));
  let nova;
  try { nova = aplicarEdicao(fila, index, content); }
  catch (e: any) { return Response.json({ error: e.message }, { status: 400 }); }
  const tmp = p.fila + ".tmp";
  await writeFile(tmp, JSON.stringify(nova, null, 2), "utf-8");
  await rename(tmp, p.fila);
  return Response.json({ ok: true });
}
