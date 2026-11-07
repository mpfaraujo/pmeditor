// src/app/dev/page.dev.tsx
// Índice das ferramentas locais. Só existe em `pnpm dev` (pageExtensions).
import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { notFound } from "next/navigation";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { resolve } from "path";

export const dynamic = "force-dynamic";

type Fila = { slug: string; batch: string; total: number; geradoEm: string | null; temRecortes: boolean };

function listarFilas(): Fila[] {
  const dados = resolve(process.cwd(), "public/data");
  if (!existsSync(dados)) return [];
  return readdirSync(dados)
    .map(nome => nome.match(/^import-queue-(.+)\.json$/))
    .filter((m): m is RegExpMatchArray => !!m && !m[1].endsWith(".manifest"))
    .map(m => {
      const slug = m[1];
      const manifestPath = resolve(dados, `import-queue-${slug}.manifest.json`);
      const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf-8")) : null;
      const filaPath = resolve(dados, m[0]);
      return {
        slug,
        batch: manifest?.batch ?? slug,
        total: manifest?.total ?? 0,
        geradoEm: manifest?.generated_at ?? statSync(filaPath).mtime.toISOString(),
        temRecortes: existsSync(resolve(process.cwd(), "scripts/tmp/revisao", slug, "mapa.json")),
      };
    })
    .toSorted((a, b) => (b.geradoEm ?? "").localeCompare(a.geradoEm ?? ""));
}

export default function DevIndexPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const filas = listarFilas();
  return (
    <WorkspaceShell section="area" title="Ferramentas locais">
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-1">Ferramentas locais</h1>
      <p className="text-sm text-gray-600 mb-6">Só existem em <code>pnpm dev</code>.</p>

      <h2 className="font-semibold mb-2">Revisão pré-import</h2>
      <p className="text-sm text-gray-600 mb-3">
        Filas geradas pelo <code>parse-tex --batch</code>, da mais recente para a mais antiga.
        Sem recortes: <code>python scripts/crop-questoes.py &lt;pdf&gt; --slug &lt;slug&gt;</code>.
      </p>
      {filas.length === 0 ? (
        <p className="text-sm">Nenhuma fila em <code>public/data</code>.</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Lote</th>
              <th className="p-2">Slug</th>
              <th className="p-2">Entradas</th>
              <th className="p-2">Gerada em</th>
              <th className="p-2">Recortes</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.slug} className="border-t">
                <td className="p-2">
                  <Link className="text-blue-700 underline" href={`/dev/revisar?batch=${encodeURIComponent(f.slug)}`}>{f.batch}</Link>
                </td>
                <td className="p-2 font-mono">{f.slug}</td>
                <td className="p-2">{f.total}</td>
                <td className="p-2">{f.geradoEm ? new Date(f.geradoEm).toLocaleString("pt-BR") : "—"}</td>
                <td className="p-2">{f.temRecortes ? "sim" : <span className="text-amber-700">não</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    </WorkspaceShell>
  );
}
