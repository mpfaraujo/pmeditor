"use client";

import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import "../library-workspace.css";

import { useState } from "react";
import { createQuestion, getQuestion, listQuestions } from "../../../lib/questions";

function TesteApiContent() {
  const [id, setId] = useState("q_test_1");
  const [disciplina, setDisciplina] = useState("Matemática");

  const [result, setResult] = useState<string>("");

  async function onSalvar() {
    setResult("...");
    try {
      const payload = {
        metadata: {
          id,
          disciplina,
        },
        content: {
          type: "doc",
        },
      };
      const res = await createQuestion(payload);
      setResult(JSON.stringify(res, null, 2));
    } catch (e: any) {
      setResult(String(e?.message ?? e));
    }
  }

  async function onCarregar() {
    setResult("...");
    try {
      const res = await getQuestion(id);
      setResult(JSON.stringify(res, null, 2));
    } catch (e: any) {
      setResult(String(e?.message ?? e));
    }
  }

  async function onListar() {
    setResult("...");
    try {
      const res = await listQuestions({ page: 1, limit: 20 });
      setResult(JSON.stringify(res, null, 2));
    } catch (e: any) {
      setResult(String(e?.message ?? e));
    }
  }

  return (
    <div className="library-page">
      <header className="library-heading">
        <div><h1>Teste da API de questões</h1><p className="library-help">Consultar, carregar e criar registros pela API existente.</p></div>
      </header>
      <div className="library-content library-api-grid">
        <section className="library-api-controls" aria-label="Parâmetros da consulta">
          <h2>Parâmetros</h2>
          <label><span>ID</span><input value={id} onChange={(e) => setId(e.target.value)} /></label>
          <label><span>Disciplina</span><input value={disciplina} onChange={(e) => setDisciplina(e.target.value)} /></label>
          <div className="library-api-actions">
            <button type="button" onClick={onCarregar}>Carregar (get)</button>
            <button type="button" onClick={onListar}>Listar (list)</button>
            <button type="button" onClick={onSalvar} className="library-api-create">Salvar (create)</button>
          </div>
        </section>
        <section className="library-api-response" aria-label="Resposta da API">
          <h2>Resposta</h2>
          <pre aria-live="polite">{result || "Execute uma ação para consultar o resultado."}</pre>
        </section>
      </div>
    </div>
  );
}

export default function TesteApiPage() {
  return <WorkspaceShell section="bank" title="Teste da API de questões"><TesteApiContent /></WorkspaceShell>;
}
