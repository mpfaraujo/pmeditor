// src/app/dev/revisar/page.dev.tsx
// Ferramenta local de revisão pré-import. Só existe em `pnpm dev` (pageExtensions).
// Esquerda: recorte do PDF. Direita: questão convertida no editor.
// "Salvar" grava o content na fila JSON; o bulk-import envia como ficou.
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionEditor } from "@/components/editor/QuestionEditor";
import { BaseTextEditorView } from "@/components/editor/BaseTextEditorView";
import { isBaseTextEntry, isSetEntry, type QueueEntry } from "@/lib/importQueue/types";
import { chavesRecorte, rotuloEntrada } from "@/lib/importQueue/fila";
import { paraRevisao, deRevisao, coletarCaminhosLocais, DEV_IMG_PREFIX } from "@/lib/importQueue/imagensRevisao";

const MAX_IMAGE_WIDTH_PX = 302; // mesmo limite do bulk-import (8 cm a 96 dpi)

type Mapa = {
  paginas: string[];
  questoes: Array<{ numero: number; ocorrencia: number; paginas: number[]; arquivos: string[] }>;
};

type Dados = { fila: QueueEntry[]; geradoEm: string | null; mapa: Mapa | null };

function urlArquivo(path: string) {
  return DEV_IMG_PREFIX + encodeURIComponent(path);
}

function carregarLargura(path: string): Promise<[string, number]> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok([path, Math.min(img.naturalWidth, MAX_IMAGE_WIDTH_PX)]);
    img.onerror = () => ok([path, MAX_IMAGE_WIDTH_PX]);
    img.src = urlArquivo(path);
  });
}

function metaParaEditor(e: QueueEntry, i: number): any {
  const now = new Date().toISOString();
  const meta: any = isSetEntry(e) ? e.sharedMeta : (e as any).meta;
  const tipo = isSetEntry(e) ? meta?.tipo ?? "Discursiva" : (e as any).tipo;
  return { schemaVersion: 1, id: `revisao-${i}`, createdAt: now, updatedAt: now, tipo, disciplina: meta?.disciplina, assunto: meta?.assunto };
}

function PainelOriginal({ arquivos, paginas, paginaInicial }: { arquivos: string[]; paginas: string[]; paginaInicial: number }) {
  const [modoPagina, setModoPagina] = useState(arquivos.length === 0);
  const [pagina, setPagina] = useState(paginaInicial);
  return (
    <div className="flex flex-col gap-2 h-full overflow-auto p-2 bg-white">
      <div className="flex items-center gap-2 text-sm">
        <button className="border rounded px-2" disabled={arquivos.length === 0} onClick={() => setModoPagina(m => !m)}>
          {modoPagina ? "Ver recorte" : "Ver página inteira"}
        </button>
        {modoPagina && paginas.length > 0 ? (
          <>
            <button className="border rounded px-2" onClick={() => setPagina(p => Math.max(1, p - 1))}>◀</button>
            <span>pág. {pagina}/{paginas.length}</span>
            <button className="border rounded px-2" onClick={() => setPagina(p => Math.min(paginas.length, p + 1))}>▶</button>
          </>
        ) : null}
      </div>
      {modoPagina
        ? paginas[pagina - 1] ? <img src={urlArquivo(paginas[pagina - 1])} alt={`página ${pagina}`} className="w-full" /> : <p className="text-sm text-gray-500">Sem páginas renderizadas (rodar crop-questoes.py).</p>
        : arquivos.map(a => <img key={a} src={urlArquivo(a)} alt="recorte" className="w-full border" />)}
    </div>
  );
}

function RevisarInner() {
  const slug = useSearchParams().get("batch") ?? "";
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [larguras, setLarguras] = useState<Map<string, number> | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    fetch(`/api/dev/fila?slug=${encodeURIComponent(slug)}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setDados(j); })
      .catch(e => setErro(String(e.message ?? e)));
  }, [slug]);

  const entrada = dados?.fila[idx];

  useEffect(() => {
    if (!entrada?.content) { setLarguras(new Map()); return; }
    setLarguras(null);
    let vivo = true;
    Promise.all(coletarCaminhosLocais(entrada.content).map(carregarLargura))
      .then(pares => { if (vivo) setLarguras(new Map(pares)); });
    return () => { vivo = false; };
  }, [entrada]);

  const chaves = useMemo(() => (dados ? chavesRecorte(dados.fila) : []), [dados]);

  const recorte = useMemo(() => {
    const mapa = dados?.mapa;
    if (!mapa) return { arquivos: [] as string[], pagina: 1 };
    let ks = chaves[idx] ?? [];
    // Texto base não tem número: usa o recorte da próxima questão.
    if (ks.length === 0) ks = chaves.slice(idx + 1).find(k => k.length > 0) ?? [];
    const qs = ks.map(k => mapa.questoes.find(q => q.numero === k.numero && q.ocorrencia === k.ocorrencia)).filter(Boolean) as Mapa["questoes"];
    return { arquivos: qs.flatMap(q => q.arquivos), pagina: qs[0]?.paginas[0] ?? 1 };
  }, [dados, chaves, idx]);

  const salvar = async (content: any) => {
    if (!dados) return;
    setStatus("salvando…");
    const r = await fetch(`/api/dev/fila?slug=${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index: idx, content, geradoEm: dados.geradoEm }),
    });
    const j = await r.json();
    if (!r.ok) { setStatus(`erro: ${j.error}`); return; }
    setDados(d => d ? { ...d, fila: d.fila.map((e, i) => (i === idx ? { ...e, content } : e)) } : d);
    setStatus("salvo na fila");
  };

  if (erro) return <p className="p-4 text-red-600">{erro}</p>;
  if (!dados || !entrada) return <p className="p-4">Carregando…</p>;

  const total = dados.fila.length;
  const ir = (n: number) => { setStatus(""); setIdx(Math.max(0, Math.min(total - 1, n))); };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-3 p-2 border-b bg-gray-50 text-sm">
        <strong>Revisão: {slug}</strong>
        <button className="border rounded px-2" onClick={() => ir(idx - 1)}>◀</button>
        <select value={idx} onChange={e => ir(Number(e.target.value))} className="border rounded">
          {dados.fila.map((e, i) => <option key={i} value={i}>{i + 1}. {rotuloEntrada(e)}</option>)}
        </select>
        <button className="border rounded px-2" onClick={() => ir(idx + 1)}>▶</button>
        <span className="text-gray-600">{status}</span>
        {!dados.mapa ? <span className="text-amber-700">sem recortes — rodar scripts/crop-questoes.py</span> : null}
      </div>
      <div className="flex-1 grid grid-cols-2 min-h-0">
        <PainelOriginal key={`o-${idx}`} arquivos={recorte.arquivos} paginas={dados.mapa?.paginas ?? []} paginaInicial={recorte.pagina} />
        <div className="overflow-auto border-l">
          {!entrada.content ? (
            <div className="p-4 text-sm">
              <p className="text-amber-700 mb-2">Formato legado (texto base no corpo) — não editável aqui.</p>
              <pre className="whitespace-pre-wrap bg-gray-50 p-2 border">{(entrada as any).latex}</pre>
            </div>
          ) : larguras === null ? (
            <p className="p-4">Carregando imagens…</p>
          ) : isBaseTextEntry(entrada) ? (
            <BaseTextEditorView key={`b-${idx}`} value={paraRevisao(entrada.content, larguras)} onSave={c => salvar(deRevisao(c))} />
          ) : (
            <QuestionEditor
              key={`q-${idx}`}
              initial={{ metadata: metaParaEditor(entrada, idx), content: paraRevisao(entrada.content, larguras) }}
              overrideSave={doc => salvar(deRevisao(doc))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function RevisarPage() {
  return (
    <Suspense>
      <RevisarInner />
    </Suspense>
  );
}
