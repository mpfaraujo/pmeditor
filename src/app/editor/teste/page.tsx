"use client";

import { useState } from "react";
import { createQuestion, getQuestion, listQuestions } from "../../../lib/questions";

export default function TesteApiPage() {
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
    <div style={{ padding: 16, display: "grid", gap: 12, maxWidth: 900 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>Teste API Questões</h1>

      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>ID</span>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            style={{
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Disciplina</span>
          <input
            value={disciplina}
            onChange={(e) => setDisciplina(e.target.value)}
            style={{
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={onSalvar}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Salvar (create)
        </button>
        <button
          onClick={onCarregar}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Carregar (get)
        </button>
        <button
          onClick={onListar}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Listar (list)
        </button>
      </div>

      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          padding: 12,
          border: "1px solid #ccc",
          borderRadius: 6,
          minHeight: 220,
        }}
      >
        {result}
      </pre>
    </div>
  );
}
