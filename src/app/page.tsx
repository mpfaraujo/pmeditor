"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import "./support.css";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Step =
  | { kind: "hero" }
  | {
      kind: "feature";
      label: string;
      title: string;
      desc: string;
      svgIdx: number;
      href?: string;
      hrefLabel?: string;
    }
  | {
      kind: "section";
      title: string;
      subtitle: string;
    }
  | { kind: "cta" };

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  { kind: "hero" },

  // ── Editor de Questões ──────────────────────────────────────────────────
  {
    kind: "section",
    title: "Editor de Questões",
    subtitle: "Crie questões com metadados, fórmulas e imagens — cole de LaTeX, Word ou PDF e deixe o banco organizado.",
  },
  {
    kind: "feature",
    label: "Passo 1 — Modelo",
    title: "Preencha as informações da questão",
    desc: "Copie um template simples com disciplina, assunto, tipo e gabarito. Preencha no bloco de notas e cole no editor — as informações já chegam preenchidas automaticamente.",
    svgIdx: 0,
    href: "/template",
    hrefLabel: "Ver modelo de informações",
  },
  {
    kind: "feature",
    label: "Passo 2 — Tipos de questão",
    title: "Quatro formatos de questão",
    desc: "Questões objetivas (múltipla escolha ou certo/errado), questões discursivas com gabarito comentado, conjuntos de itens objetivos com texto base compartilhado — e conjuntos discursivos com partes a), b), c), cada uma com sua resposta.",
    svgIdx: 1,
  },
  {
    kind: "feature",
    label: "Passo 3 — Editor",
    title: "Digite ou cole a questão",
    desc: "O editor aceita texto puro, LaTeX, Word e PDF. Alternativas, fórmulas matemáticas e imagens são reconhecidas automaticamente ao colar.",
    svgIdx: 2,
    href: "/editor",
    hrefLabel: "Abrir editor",
  },

  // ── Montador de Provas ──────────────────────────────────────────────────
  {
    kind: "section",
    title: "Montador de Provas",
    subtitle: "Selecione questões do banco, personalize o layout e gere uma prova ou lista de exercício pronta para imprimir.",
  },
  {
    kind: "feature",
    label: "Passo 4 — Banco",
    title: "Encontre as questões certas",
    desc: "Filtre o banco por disciplina, assunto, banca ou ano — e selecione exatamente o que precisa para a próxima prova.",
    svgIdx: 3,
    href: "/editor/questoes",
    hrefLabel: "Ver banco de questões",
  },
  {
    kind: "feature",
    label: "Passo 5 — Montar",
    title: "Monte a prova ou lista de exercício",
    desc: "Selecione as questões e escolha o formato: prova com cabeçalho completo ou lista de exercício. Gere tipos diferentes com alternativas embaralhadas para evitar cola entre alunos.",
    svgIdx: 4,
  },
  {
    kind: "feature",
    label: "Passo 6 — Visual",
    title: "Personalize a apresentação",
    desc: "Escolha entre 11 modelos de cabeçalho e 5 estilos de numeração de questão. Do clássico ao minimalista — a prova fica com a cara da sua escola.",
    svgIdx: 5,
  },
  {
    kind: "feature",
    label: "Passo 7 — Impressão",
    title: "Imprima com gabarito",
    desc: "Visualize a prova em A4 antes de imprimir. O gabarito é gerado automaticamente — inclusive para múltiplos tipos de prova.",
    svgIdx: 6,
  },

  { kind: "cta" },
];


// ─── SVGs placeholder — substitua pelos seus ─────────────────────────────────

function SvgModelo() {
  const lines: [string, string][] = [
    ["---", "#475569"],
    ["tipo: Múltipla Escolha", "#e2e8f0"],
    ["dificuldade: Média", "#e2e8f0"],
    ["disciplina: Matemática", "#86efac"],
    ["assunto: Geometria Plana", "#86efac"],
    ["gabarito: B", "#f9a8d4"],
    ["tags: [resolução gráfica]", "#fde68a"],
    ["---", "#475569"],
  ];
  return (
    <svg viewBox="0 0 480 260" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="480" height="260" rx="12" fill="#0f172a" />
      <rect width="480" height="36" rx="12" fill="#1e293b" />
      <rect x="0" y="24" width="480" height="12" fill="#1e293b" />
      <circle cx="20" cy="18" r="6" fill="#ef4444" />
      <circle cx="40" cy="18" r="6" fill="#f59e0b" />
      <circle cx="60" cy="18" r="6" fill="#22c55e" />
      {lines.map(([text, color], i) => (
        <text key={i} x="20" y={58 + i * 24} fill={color} fontSize="13" fontFamily="monospace">{text}</text>
      ))}
    </svg>
  );
}

function SvgTipos() {
  // 4 painéis: x = 4, 126, 248, 370 — largura 118, altura 292
  const P = [4, 126, 248, 370];
  const W = 118;
  const H = 292;
  return (
    <svg viewBox="0 0 492 300" fill="none" xmlns="http://www.w3.org/2000/svg">

      {/* ── 1: Objetiva simples ── */}
      <rect x={P[0]} y="4" width={W} height={H} rx="8" fill="#0f172a" stroke="#1e293b" />
      <text x={P[0] + W/2} y="22" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontFamily="sans-serif">OBJETIVA</text>
      <rect x={P[0]+8} y="30" width={W-16} height="5" rx="2" fill="#334155" />
      <rect x={P[0]+8} y="40" width={W-26} height="5" rx="2" fill="#334155" />
      <rect x={P[0]+8} y="50" width={W-20} height="5" rx="2" fill="#334155" />
      {[["A",68,false],["B",88,true],["C",108,false],["D",128,false],["E",148,false]].map(([l,y,c])=>(
        <g key={String(l)}>
          <circle cx={P[0]+16} cy={Number(y)} r="8" fill={c?"#fbbf24":"transparent"} stroke={c?"#fbbf24":"#334155"} />
          <text x={P[0]+16} y={Number(y)+3} textAnchor="middle" fill={c?"#0f172a":"#475569"} fontSize="8" fontFamily="sans-serif" fontWeight="700">{String(l)}</text>
          <rect x={P[0]+28} y={Number(y)-4} width={[68,76,58,70,62][["A","B","C","D","E"].indexOf(String(l))]} height="7" rx="3" fill={c?"#292524":"#1e293b"} />
        </g>
      ))}

      {/* ── 2: Conjunto objetiva ── */}
      <rect x={P[1]} y="4" width={W} height={H} rx="8" fill="#0f172a" stroke="#1e293b" />
      <text x={P[1]+W/2} y="22" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontFamily="sans-serif">CONJ. OBJETIVA</text>
      {/* texto base */}
      <rect x={P[1]+8} y="28" width={W-16} height="38" rx="5" fill="#1e293b" />
      <text x={P[1]+14} y="40" fill="#64748b" fontSize="6.5" fontFamily="sans-serif">Texto base</text>
      <rect x={P[1]+14} y="44" width={W-28} height="4" rx="2" fill="#334155" />
      <rect x={P[1]+14} y="52" width={W-36} height="4" rx="2" fill="#334155" />
      {/* 3 itens MCQ */}
      {[0,1,2].map(i=>(
        <g key={i}>
          <rect x={P[1]+8} y={76+i*72} width={W-16} height="64" rx="5" fill="#1e293b" />
          <text x={P[1]+14} y={90+i*72} fill="#fbbf24" fontSize="7.5" fontFamily="sans-serif" fontWeight="700">{i+1}.</text>
          <rect x={P[1]+26} y={84+i*72} width={W-40} height="4" rx="2" fill="#334155" />
          <rect x={P[1]+26} y={92+i*72} width={W-52} height="4" rx="2" fill="#334155" />
          {["A","B","C"].map((l,j)=>(
            <g key={l}>
              <text x={P[1]+14} y={104+i*72+j*10} fill="#475569" fontSize="6.5" fontFamily="sans-serif">{l})</text>
              <rect x={P[1]+24} y={98+i*72+j*10} width={[56,68,48][j]} height="5" rx="2" fill="#0f172a" stroke="#334155" />
            </g>
          ))}
        </g>
      ))}

      {/* ── 3: Discursiva simples ── */}
      <rect x={P[2]} y="4" width={W} height={H} rx="8" fill="#0f172a" stroke="#1e293b" />
      <text x={P[2]+W/2} y="22" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontFamily="sans-serif">DISCURSIVA</text>
      <rect x={P[2]+8} y="30" width={W-16} height="5" rx="2" fill="#334155" />
      <rect x={P[2]+8} y="40" width={W-26} height="5" rx="2" fill="#334155" />
      <rect x={P[2]+8} y="50" width={W-20} height="5" rx="2" fill="#334155" />
      <text x={P[2]+8} y="74" fill="#475569" fontSize="7" fontFamily="sans-serif">Resposta:</text>
      {[84,96,108,120,132,144,156,168,180].map(y=>(
        <line key={y} x1={P[2]+8} y1={y} x2={P[2]+W-8} y2={y} stroke="#1e293b" strokeWidth="1.2" />
      ))}
      {/* gabarito comentado */}
      <rect x={P[2]+8} y="200" width={W-16} height="64" rx="5" fill="#1e293b" stroke="#334155" strokeDasharray="3 2" />
      <text x={P[2]+14} y="214" fill="#64748b" fontSize="6.5" fontFamily="sans-serif">Gabarito comentado</text>
      <rect x={P[2]+14} y="220" width={W-30} height="4" rx="2" fill="#334155" />
      <rect x={P[2]+14} y="228" width={W-38} height="4" rx="2" fill="#334155" />
      <rect x={P[2]+14} y="236" width={W-34} height="4" rx="2" fill="#334155" />
      <rect x={P[2]+14} y="244" width={W-42} height="4" rx="2" fill="#334155" />

      {/* ── 4: Conjunto discursiva ── */}
      <rect x={P[3]} y="4" width={W} height={H} rx="8" fill="#0f172a" stroke="#1e293b" />
      <text x={P[3]+W/2} y="22" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontFamily="sans-serif">CONJ. DISCURSIVA</text>
      {/* texto base */}
      <rect x={P[3]+8} y="28" width={W-16} height="38" rx="5" fill="#1e293b" />
      <text x={P[3]+14} y="40" fill="#64748b" fontSize="6.5" fontFamily="sans-serif">Texto base</text>
      <rect x={P[3]+14} y="44" width={W-28} height="4" rx="2" fill="#334155" />
      <rect x={P[3]+14} y="52" width={W-36} height="4" rx="2" fill="#334155" />
      {/* partes a) b) c) */}
      {["a","b","c"].map((l,i)=>(
        <g key={l}>
          <rect x={P[3]+8} y={76+i*72} width={W-16} height="64" rx="5" fill="#1e293b" />
          <text x={P[3]+14} y={90+i*72} fill="#fbbf24" fontSize="8" fontFamily="sans-serif" fontWeight="700">{l})</text>
          <rect x={P[3]+26} y={84+i*72} width={W-40} height="4" rx="2" fill="#334155" />
          <rect x={P[3]+26} y={92+i*72} width={W-52} height="4" rx="2" fill="#334155" />
          <text x={P[3]+14} y={106+i*72} fill="#475569" fontSize="6" fontFamily="sans-serif">Resposta:</text>
          {[110,118,126].map(dy=>(
            <line key={dy} x1={P[3]+14} y1={dy+i*72} x2={P[3]+W-10} y2={dy+i*72} stroke="#334155" strokeWidth="1" />
          ))}
        </g>
      ))}
    </svg>
  );
}

function SvgEditor() {
  const alts: [string, number, boolean][] = [
    ["A) Alternativa incorreta", 160, false],
    ["B) Alternativa correta", 192, true],
    ["C) Alternativa incorreta", 224, false],
    ["D) Alternativa incorreta", 256, false],
  ];
  return (
    <svg viewBox="0 0 480 300" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="480" height="300" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
      <rect width="480" height="40" rx="12" fill="#f1f5f9" />
      <rect x="0" y="28" width="480" height="12" fill="#f1f5f9" />
      {[16, 34, 52].map((x) => <circle key={x} cx={x} cy={20} r={6} fill="#cbd5e1" />)}
      {[76, 100, 124, 148].map((x) => (
        <rect key={x} x={x} y={14} width={16} height={12} rx="3" fill="#e2e8f0" />
      ))}
      <rect x="16" y="52" width="448" height="232" rx="8" fill="white" stroke="#e2e8f0" />
      <rect x="28" y="68" width="380" height="8" rx="4" fill="#334155" />
      <rect x="28" y="84" width="320" height="8" rx="4" fill="#334155" />
      <rect x="28" y="100" width="350" height="8" rx="4" fill="#334155" />
      {alts.map(([label, y, correct]) => (
        <g key={y}>
          <rect x="28" y={y - 4} width="420" height="24" rx="6"
            fill={correct ? "#f0fdf4" : "transparent"}
            stroke={correct ? "#86efac" : "transparent"} />
          <text x="36" y={y + 12} fill={correct ? "#15803d" : "#64748b"} fontSize="11" fontFamily="sans-serif">{label}</text>
        </g>
      ))}
    </svg>
  );
}

function SvgBanco() {
  const rows: [string, string, string][] = [
    ["Matemática", "Geometria Plana", "ENEM"],
    ["Português", "Interpretação de Texto", "FUVEST"],
    ["Física", "Mecânica", "ENEM"],
    ["Biologia", "Genética", "UEL"],
  ];
  return (
    <svg viewBox="0 0 480 290" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="480" height="290" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
      <rect x="16" y="12" width="320" height="28" rx="8" fill="white" stroke="#e2e8f0" />
      <text x="30" y="30" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Buscar questões...</text>
      {["Matemática", "ENEM", "2023"].map((t, i) => (
        <g key={t}>
          <rect x={16 + i * 88} y="50" width={80} height="20" rx="10" fill="#eff6ff" stroke="#bfdbfe" />
          <text x={16 + i * 88 + 40} y="64" textAnchor="middle" fill="#3b82f6" fontSize="9" fontFamily="sans-serif">{t}</text>
        </g>
      ))}
      {rows.map(([disc, assunto, tag], i) => (
        <g key={i}>
          <rect x="16" y={82 + i * 52} width="448" height="44" rx="8" fill="white" stroke="#e2e8f0" />
          <rect x="28" y={92 + i * 52} width="8" height="8" rx="2" fill="#60a5fa" />
          <text x="44" y={102 + i * 52} fill="#1e293b" fontSize="11" fontFamily="sans-serif" fontWeight="600">{disc}</text>
          <text x="44" y={116 + i * 52} fill="#64748b" fontSize="10" fontFamily="sans-serif">{assunto}</text>
          <rect x="400" y={94 + i * 52} width="48" height="16" rx="8" fill="#f0fdf4" stroke="#bbf7d0" />
          <text x="424" y={106 + i * 52} textAnchor="middle" fill="#15803d" fontSize="9" fontFamily="sans-serif">{tag}</text>
        </g>
      ))}
    </svg>
  );
}

function SvgProva() {
  const respostas = ["B", "A", "C", "D", "B", "C"];
  return (
    <svg viewBox="0 0 480 300" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Folha A4 */}
      <rect x="20" y="8" width="260" height="288" rx="6" fill="white" stroke="#e2e8f0" />
      <rect x="32" y="20" width="236" height="32" rx="4" fill="#fef9c3" />
      <text x="150" y="40" textAnchor="middle" fill="#92400e" fontSize="10" fontFamily="sans-serif" fontWeight="700">AVALIAÇÃO — 3º BIMESTRE</text>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <text x="32" y={72 + i * 54} fill="#1e293b" fontSize="10" fontFamily="sans-serif" fontWeight="700">{i + 1}.</text>
          <rect x="44" y={62 + i * 54} width="190" height="7" rx="3" fill="#e2e8f0" />
          <rect x="44" y={74 + i * 54} width="170" height="7" rx="3" fill="#e2e8f0" />
          {["A", "B", "C"].map((l, j) => (
            <g key={l}>
              <text x="44" y={91 + i * 54 + j * 10} fill="#64748b" fontSize="7" fontFamily="sans-serif">{l})</text>
              <rect x="56" y={85 + i * 54 + j * 10} width={[110, 130, 95][j]} height="6" rx="3" fill="#f1f5f9" />
            </g>
          ))}
        </g>
      ))}
      {/* Gabarito */}
      <rect x="300" y="8" width="160" height="288" rx="8" fill="#0f172a" />
      <text x="380" y="36" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="sans-serif" letterSpacing="2">GABARITO</text>
      {respostas.map((resp, i) => (
        <g key={i}>
          <text x="316" y={56 + i * 36} fill="#475569" fontSize="10" fontFamily="monospace">{i + 1}.</text>
          {["A", "B", "C", "D", "E"].map((l, j) => (
            <g key={l}>
              <circle cx={336 + j * 22} cy={50 + i * 36} r="8"
                fill={resp === l ? "#fbbf24" : "transparent"}
                stroke={resp === l ? "#fbbf24" : "#334155"} />
              {resp === l && (
                <text x={336 + j * 22} y={54 + i * 36} textAnchor="middle" fill="#0f172a" fontSize="8" fontFamily="sans-serif" fontWeight="700">{l}</text>
              )}
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

function SvgImpressao() {
  return (
    <svg viewBox="0 0 480 300" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Papel saindo */}
      <rect x="110" y="170" width="260" height="130" rx="4" fill="white" stroke="#e2e8f0" />
      <rect x="126" y="186" width="200" height="7" rx="3" fill="#e2e8f0" />
      <rect x="126" y="200" width="180" height="7" rx="3" fill="#e2e8f0" />
      <rect x="126" y="214" width="190" height="7" rx="3" fill="#e2e8f0" />
      <rect x="126" y="228" width="160" height="7" rx="3" fill="#e2e8f0" />
      {/* Impressora */}
      <rect x="60" y="90" width="360" height="100" rx="16" fill="#1e293b" />
      <rect x="110" y="60" width="260" height="50" rx="8" fill="#0f172a" />
      {/* Slot */}
      <rect x="130" y="54" width="220" height="8" rx="3" fill="#334155" />
      {/* Luz */}
      <circle cx="390" cy="130" r="8" fill="#22c55e" />
      <circle cx="390" cy="130" r="14" fill="#22c55e" fillOpacity="0.2" />
      {/* Detalhes */}
      <rect x="80" y="114" width="200" height="8" rx="4" fill="#334155" />
      <text x="240" y="150" textAnchor="middle" fill="#475569" fontSize="11" fontFamily="sans-serif">Imprimindo...</text>
    </svg>
  );
}

function SvgPaper({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="4" fill="white" />
      {children}
    </g>
  );
}

function SvgVisual() {
  return (
    <svg viewBox="0 0 480 320" fill="none" xmlns="http://www.w3.org/2000/svg">

      {/* ── Decoradores ── */}
      <text x="8" y="14" fill="#94a3b8" fontSize="7.5" fontFamily="sans-serif" letterSpacing="1">DECORADORES DE QUESTÃO</text>

      {/* V0 Classic */}
      <SvgPaper x={8} y={20} w={84} h={36}>
        <rect x={12} y={26} width={34} height={14} rx="2" fill="#e5e7eb" stroke="#374151" strokeWidth="0.5" />
        <text x={14} y={35} fill="#111827" fontSize="5.5" fontFamily="sans-serif" fontWeight="700">Questão 1</text>
        <line x1={48} y1={40} x2={88} y2={40} stroke="#374151" strokeWidth="0.5" />
        <text x={12} y={62} fill="#94a3b8" fontSize="6" fontFamily="sans-serif">Classic</text>
      </SvgPaper>

      {/* V1 Bracket */}
      <SvgPaper x={104} y={20} w={84} h={36}>
        <path d="M 112 25 L 109 25 L 109 41 L 112 41" fill="none" stroke="#374151" strokeWidth="1" />
        <text x={115} y={36} fill="#111827" fontSize="5.5" fontFamily="sans-serif" fontWeight="700">Questão 2</text>
        <line x1={109} y1={41} x2={184} y2={41} stroke="#374151" strokeWidth="0.5" />
        <text x={104} y={62} fill="#94a3b8" fontSize="6" fontFamily="sans-serif">Bracket</text>
      </SvgPaper>

      {/* V2 Badge */}
      <SvgPaper x={200} y={20} w={84} h={36}>
        <circle cx={220} cy={33} r="9" fill="#111827" />
        <text x={220} y={37} textAnchor="middle" fill="white" fontSize="8" fontFamily="sans-serif" fontWeight="700">3</text>
        <text x={200} y={62} fill="#94a3b8" fontSize="6" fontFamily="sans-serif">Badge</text>
      </SvgPaper>

      {/* V3 Minimal */}
      <SvgPaper x={296} y={20} w={84} h={36}>
        <text x={304} y={40} fill="#111827" fontSize="14" fontFamily="sans-serif" fontWeight="700">4</text>
        <text x={296} y={62} fill="#94a3b8" fontSize="6" fontFamily="sans-serif">Minimal</text>
      </SvgPaper>

      {/* V4 Corner */}
      <SvgPaper x={392} y={20} w={84} h={36}>
        <path d="M 396 34 L 396 26 L 404 26" fill="none" stroke="#374151" strokeWidth="1.2" />
        <text x={407} y={36} fill="#111827" fontSize="5.5" fontFamily="sans-serif" fontWeight="700">Questão 5</text>
        <line x1={396} y1={40} x2={472} y2={40} stroke="#374151" strokeWidth="0.5" strokeDasharray="2 2" />
        <text x={392} y={62} fill="#94a3b8" fontSize="6" fontFamily="sans-serif">Corner</text>
      </SvgPaper>

      {/* ── Cabeçalhos ── */}
      <text x="8" y="82" fill="#94a3b8" fontSize="7.5" fontFamily="sans-serif" letterSpacing="1">MODELOS DE CABEÇALHO (11 variantes)</text>

      {/* H0: clássico — logo centro + linhas de campos */}
      <SvgPaper x={8} y={90} w={148} h={104}>
        <rect x={58} y={96} width={48} height={14} rx="2" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.5" />
        <text x={82} y={105} textAnchor="middle" fill="#9ca3af" fontSize="5" fontFamily="sans-serif">Logo</text>
        <text x={82} y={118} textAnchor="middle" fill="#374151" fontSize="5.5" fontFamily="sans-serif" fontWeight="700">ESCOLA ESTADUAL</text>
        <line x1={12} y1={122} x2={152} y2={122} stroke="#374151" strokeWidth="0.6" />
        {[12, 84].map((x, i) => (
          <g key={x}>
            <text x={x} y={131} fill="#6b7280" fontSize="4.5" fontFamily="sans-serif">{["Nome:", "Turma:"][i]}</text>
            <line x1={x} y1={136} x2={x + 64} y2={136} stroke="#d1d5db" strokeWidth="0.5" />
          </g>
        ))}
        {[12, 84].map((x, i) => (
          <g key={x + 100}>
            <text x={x} y={146} fill="#6b7280" fontSize="4.5" fontFamily="sans-serif">{["Professor:", "Disciplina:"][i]}</text>
            <line x1={x} y1={151} x2={x + 64} y2={151} stroke="#d1d5db" strokeWidth="0.5" />
          </g>
        ))}
        <text x={8} y={186} fill="#94a3b8" fontSize="6" fontFamily="sans-serif">Clássico</text>
      </SvgPaper>

      {/* H1: sidebar — logo barra lateral esquerda + campos à direita */}
      <SvgPaper x={168} y={90} w={148} h={104}>
        <rect x={168} y={90} width={26} height={104} rx="4" fill="#1e293b" />
        <text x={181} y={145} textAnchor="middle" fill="#64748b" fontSize="5" fontFamily="sans-serif" transform="rotate(-90 181 145)">LOGO</text>
        <text x={200} y={102} fill="#374151" fontSize="5.5" fontFamily="sans-serif" fontWeight="700">ESCOLA EST.</text>
        <line x1={198} y1={106} x2={312} y2={106} stroke="#374151" strokeWidth="0.5" />
        {[["Nome:", 114], ["Turma:", 122], ["Prof:", 130], ["Disc:", 138]].map(([lbl, y]) => (
          <g key={String(y)}>
            <text x={200} y={Number(y)} fill="#6b7280" fontSize="4.5" fontFamily="sans-serif">{String(lbl)}</text>
            <line x1={220} y1={Number(y) + 2} x2={312} y2={Number(y) + 2} stroke="#d1d5db" strokeWidth="0.5" />
          </g>
        ))}
        <text x={168} y={186} fill="#94a3b8" fontSize="6" fontFamily="sans-serif">Sidebar</text>
      </SvgPaper>

      {/* H2: grade com células */}
      <SvgPaper x={328} y={90} w={148} h={104}>
        <rect x={328} y={90} width={148} height={20} rx="4" fill="#1e293b" />
        <rect x={328} y={102} width={148} height={8} rx="0" fill="#1e293b" />
        <text x={402} y={101} textAnchor="middle" fill="white" fontSize="5.5" fontFamily="sans-serif" fontWeight="700">ESCOLA ESTADUAL</text>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={328 + (i % 2) * 74} y={112 + Math.floor(i / 2) * 22} width={74} height={20} fill="white" stroke="#e5e7eb" strokeWidth="0.5" />
            <text x={332 + (i % 2) * 74} y={122 + Math.floor(i / 2) * 22} fill="#6b7280" fontSize="4.5" fontFamily="sans-serif">
              {["Nome:", "Turma:", "Professor:", "Disciplina:"][i]}
            </text>
          </g>
        ))}
        <text x={328} y={186} fill="#94a3b8" fontSize="6" fontFamily="sans-serif">Grade</text>
      </SvgPaper>

    </svg>
  );
}

// SVGs para os feature steps (índice = svgIdx do step)
const FEATURE_SVGS = [
  <SvgModelo key="modelo" />,    // 0
  <SvgTipos key="tipos" />,      // 1
  <SvgEditor key="editor" />,    // 2
  <SvgBanco key="banco" />,      // 3
  <SvgProva key="prova" />,      // 4
  <SvgVisual key="visual" />,    // 5
  <SvgImpressao key="impressao" />, // 6
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const { isLoggedIn, loading } = useAuth();

  useEffect(() => {
    if (!loading && isLoggedIn) router.replace("/dashboard");
  }, [isLoggedIn, loading, router]);

  return (
    <div className="support-public">
      <header className="support-public-header">
        <Link href="/" className="support-public-brand">Prova<span>Marela</span></Link>
        <nav aria-label="Apresentação"><a href="#recursos">Como funciona</a><Link href="/dashboard" className="support-public-enter">Entrar <ArrowRight size={16} aria-hidden="true" /></Link></nav>
      </header>
      <main>
        <section className="support-public-hero">
          <div><h1>Da questão à prova pronta.</h1><p>Editor de questões e montagem de provas para professores.</p><div className="support-public-actions"><Link href="/dashboard" className="support-public-enter">Começar <ArrowRight size={16} aria-hidden="true" /></Link><Link href="/editor/questoes">Explorar banco de questões</Link></div></div>
          <figure className="support-public-product"><div>{FEATURE_SVGS[6]}</div><figcaption>Visualização ilustrativa do fluxo de impressão</figcaption></figure>
        </section>
        <div id="recursos" className="support-public-resources">
          {STEPS.map((step, index) => step.kind === "section" ? <section className="support-public-section" key={index}><h2>{step.title}</h2><p>{step.subtitle}</p></section> : step.kind === "feature" ? <section className="support-public-feature" key={index}><div><h3>{step.title}</h3><p>{step.desc}</p>{step.href && <Link href={step.href}>{step.hrefLabel} <ArrowRight size={16} aria-hidden="true" /></Link>}</div><figure><div>{FEATURE_SVGS[step.svgIdx]}</div></figure></section> : null)}
        </div>
        <section className="support-public-cta"><h2>Pronto para começar?</h2><p>Crie suas primeiras questões e monte a próxima prova em minutos.</p><div className="support-public-actions"><Link href="/editor" className="support-public-enter">Abrir o editor <ArrowRight size={16} aria-hidden="true" /></Link><Link href="/dashboard">Ver todas as opções</Link></div></section>
      </main>
      <footer className="support-public-footer"><Link href="/dashboard" className="support-public-brand">ProvaMarela</Link><span>Editor de questões e montagem de provas</span></footer>
    </div>
  );
}
