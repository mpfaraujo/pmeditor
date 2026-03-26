"use client";

import styles from "./TabelaPeriodica.module.css";

export type TabelaSize = "a4-landscape" | "meia-folha";

// ── Dimensões por modo ──────────────────────────────────────────────────────
// a4-landscape : viewBox 297×210 mm (A4 deitado)
// meia-folha   : viewBox 210×148 mm (metade de A4 retrato = A5 landscape)

type Dims = {
  vbW: number; vbH: number;  // viewBox width/height
  CW: number; CH: number; FCH: number; // cell width, cell height, f-block height
  TABLE_Y: number; F_GAP: number;
  titleSize: number; groupSize: number; periodSize: number;
  symSize: number; symSizeF: number; zSize: number; massSize: number;
};

const DIMS: Record<TabelaSize, Dims> = {
  "a4-landscape": {
    vbW: 297, vbH: 210,
    CW: 13, CH: 14, FCH: 12.5,
    TABLE_Y: 45, F_GAP: 3.5,  // TABLE_Y calculado para centrar verticalmente nos 210mm
    titleSize: 5, groupSize: 2.5, periodSize: 2.5,
    symSize: 5.2, symSizeF: 4.4, zSize: 2.4, massSize: 2.0,
  },
  "meia-folha": {
    vbW: 210, vbH: 148,
    CW: 10.5, CH: 11.5, FCH: 10,
    TABLE_Y: 24, F_GAP: 3,   // 24 ≈ 2cm de margem superior antes do título
    titleSize: 4, groupSize: 2.2, periodSize: 2.2,
    symSize: 4.2, symSizeF: 3.6, zSize: 2, massSize: 1.7,
  },
};

// ── Dados dos elementos ────────────────────────────────────────────────────
type Cat =
  | "hidrogenio" | "alcalino" | "alcalino-terroso" | "transicao"
  | "pos-transicao" | "metaloide" | "nao-metal" | "halogeno"
  | "gas-nobre" | "lantanideo" | "actinideo";

const CAT_COLOR: Record<Cat, string> = {
  hidrogenio:           "#ffffff",
  alcalino:             "#ff9999",
  "alcalino-terroso":   "#ffcc88",
  transicao:            "#ffb3d9",
  "pos-transicao":      "#c0c0c0",
  metaloide:            "#c8d96b",
  "nao-metal":          "#88ee88",
  halogeno:             "#ffff88",
  "gas-nobre":          "#88eeee",
  lantanideo:           "#ffcce5",
  actinideo:            "#ffd699",
};


type El = { z: number; s: string; m: string; c: Cat; r: number; g: number };

const ELEMENTS: El[] = [
  // Período 1
  {z:1,  s:"H",  m:"1,008",  c:"hidrogenio",       r:1,  g:1},
  {z:2,  s:"He", m:"4,003",  c:"gas-nobre",         r:1,  g:18},
  // Período 2
  {z:3,  s:"Li", m:"6,941",  c:"alcalino",          r:2,  g:1},
  {z:4,  s:"Be", m:"9,012",  c:"alcalino-terroso",  r:2,  g:2},
  {z:5,  s:"B",  m:"10,81",  c:"metaloide",         r:2,  g:13},
  {z:6,  s:"C",  m:"12,01",  c:"nao-metal",         r:2,  g:14},
  {z:7,  s:"N",  m:"14,01",  c:"nao-metal",         r:2,  g:15},
  {z:8,  s:"O",  m:"16,00",  c:"nao-metal",         r:2,  g:16},
  {z:9,  s:"F",  m:"19,00",  c:"halogeno",          r:2,  g:17},
  {z:10, s:"Ne", m:"20,18",  c:"gas-nobre",         r:2,  g:18},
  // Período 3
  {z:11, s:"Na", m:"22,99",  c:"alcalino",          r:3,  g:1},
  {z:12, s:"Mg", m:"24,31",  c:"alcalino-terroso",  r:3,  g:2},
  {z:13, s:"Al", m:"26,98",  c:"pos-transicao",     r:3,  g:13},
  {z:14, s:"Si", m:"28,09",  c:"metaloide",         r:3,  g:14},
  {z:15, s:"P",  m:"30,97",  c:"nao-metal",         r:3,  g:15},
  {z:16, s:"S",  m:"32,07",  c:"nao-metal",         r:3,  g:16},
  {z:17, s:"Cl", m:"35,45",  c:"halogeno",          r:3,  g:17},
  {z:18, s:"Ar", m:"39,95",  c:"gas-nobre",         r:3,  g:18},
  // Período 4
  {z:19, s:"K",  m:"39,10",  c:"alcalino",          r:4,  g:1},
  {z:20, s:"Ca", m:"40,08",  c:"alcalino-terroso",  r:4,  g:2},
  {z:21, s:"Sc", m:"44,96",  c:"transicao",         r:4,  g:3},
  {z:22, s:"Ti", m:"47,87",  c:"transicao",         r:4,  g:4},
  {z:23, s:"V",  m:"50,94",  c:"transicao",         r:4,  g:5},
  {z:24, s:"Cr", m:"52,00",  c:"transicao",         r:4,  g:6},
  {z:25, s:"Mn", m:"54,94",  c:"transicao",         r:4,  g:7},
  {z:26, s:"Fe", m:"55,85",  c:"transicao",         r:4,  g:8},
  {z:27, s:"Co", m:"58,93",  c:"transicao",         r:4,  g:9},
  {z:28, s:"Ni", m:"58,69",  c:"transicao",         r:4,  g:10},
  {z:29, s:"Cu", m:"63,55",  c:"transicao",         r:4,  g:11},
  {z:30, s:"Zn", m:"65,38",  c:"transicao",         r:4,  g:12},
  {z:31, s:"Ga", m:"69,72",  c:"pos-transicao",     r:4,  g:13},
  {z:32, s:"Ge", m:"72,63",  c:"metaloide",         r:4,  g:14},
  {z:33, s:"As", m:"74,92",  c:"metaloide",         r:4,  g:15},
  {z:34, s:"Se", m:"78,97",  c:"nao-metal",         r:4,  g:16},
  {z:35, s:"Br", m:"79,90",  c:"halogeno",          r:4,  g:17},
  {z:36, s:"Kr", m:"83,80",  c:"gas-nobre",         r:4,  g:18},
  // Período 5
  {z:37, s:"Rb", m:"85,47",  c:"alcalino",          r:5,  g:1},
  {z:38, s:"Sr", m:"87,62",  c:"alcalino-terroso",  r:5,  g:2},
  {z:39, s:"Y",  m:"88,91",  c:"transicao",         r:5,  g:3},
  {z:40, s:"Zr", m:"91,22",  c:"transicao",         r:5,  g:4},
  {z:41, s:"Nb", m:"92,91",  c:"transicao",         r:5,  g:5},
  {z:42, s:"Mo", m:"95,95",  c:"transicao",         r:5,  g:6},
  {z:43, s:"Tc", m:"[98]",   c:"transicao",         r:5,  g:7},
  {z:44, s:"Ru", m:"101,1",  c:"transicao",         r:5,  g:8},
  {z:45, s:"Rh", m:"102,9",  c:"transicao",         r:5,  g:9},
  {z:46, s:"Pd", m:"106,4",  c:"transicao",         r:5,  g:10},
  {z:47, s:"Ag", m:"107,9",  c:"transicao",         r:5,  g:11},
  {z:48, s:"Cd", m:"112,4",  c:"transicao",         r:5,  g:12},
  {z:49, s:"In", m:"114,8",  c:"pos-transicao",     r:5,  g:13},
  {z:50, s:"Sn", m:"118,7",  c:"pos-transicao",     r:5,  g:14},
  {z:51, s:"Sb", m:"121,8",  c:"metaloide",         r:5,  g:15},
  {z:52, s:"Te", m:"127,6",  c:"metaloide",         r:5,  g:16},
  {z:53, s:"I",  m:"126,9",  c:"halogeno",          r:5,  g:17},
  {z:54, s:"Xe", m:"131,3",  c:"gas-nobre",         r:5,  g:18},
  // Período 6
  {z:55, s:"Cs", m:"132,9",  c:"alcalino",          r:6,  g:1},
  {z:56, s:"Ba", m:"137,3",  c:"alcalino-terroso",  r:6,  g:2},
  {z:72, s:"Hf", m:"178,5",  c:"transicao",         r:6,  g:4},
  {z:73, s:"Ta", m:"180,9",  c:"transicao",         r:6,  g:5},
  {z:74, s:"W",  m:"183,8",  c:"transicao",         r:6,  g:6},
  {z:75, s:"Re", m:"186,2",  c:"transicao",         r:6,  g:7},
  {z:76, s:"Os", m:"190,2",  c:"transicao",         r:6,  g:8},
  {z:77, s:"Ir", m:"192,2",  c:"transicao",         r:6,  g:9},
  {z:78, s:"Pt", m:"195,1",  c:"transicao",         r:6,  g:10},
  {z:79, s:"Au", m:"197,0",  c:"transicao",         r:6,  g:11},
  {z:80, s:"Hg", m:"200,6",  c:"transicao",         r:6,  g:12},
  {z:81, s:"Tl", m:"204,4",  c:"pos-transicao",     r:6,  g:13},
  {z:82, s:"Pb", m:"207,2",  c:"pos-transicao",     r:6,  g:14},
  {z:83, s:"Bi", m:"209,0",  c:"pos-transicao",     r:6,  g:15},
  {z:84, s:"Po", m:"[209]",  c:"metaloide",         r:6,  g:16},
  {z:85, s:"At", m:"[210]",  c:"halogeno",          r:6,  g:17},
  {z:86, s:"Rn", m:"[222]",  c:"gas-nobre",         r:6,  g:18},
  // Período 7
  {z:87, s:"Fr", m:"[223]",  c:"alcalino",          r:7,  g:1},
  {z:88, s:"Ra", m:"[226]",  c:"alcalino-terroso",  r:7,  g:2},
  {z:104,s:"Rf", m:"[267]",  c:"transicao",         r:7,  g:4},
  {z:105,s:"Db", m:"[268]",  c:"transicao",         r:7,  g:5},
  {z:106,s:"Sg", m:"[271]",  c:"transicao",         r:7,  g:6},
  {z:107,s:"Bh", m:"[272]",  c:"transicao",         r:7,  g:7},
  {z:108,s:"Hs", m:"[270]",  c:"transicao",         r:7,  g:8},
  {z:109,s:"Mt", m:"[278]",  c:"transicao",         r:7,  g:9},
  {z:110,s:"Ds", m:"[281]",  c:"transicao",         r:7,  g:10},
  {z:111,s:"Rg", m:"[282]",  c:"transicao",         r:7,  g:11},
  {z:112,s:"Cn", m:"[285]",  c:"transicao",         r:7,  g:12},
  {z:113,s:"Nh", m:"[286]",  c:"pos-transicao",     r:7,  g:13},
  {z:114,s:"Fl", m:"[289]",  c:"pos-transicao",     r:7,  g:14},
  {z:115,s:"Mc", m:"[290]",  c:"pos-transicao",     r:7,  g:15},
  {z:116,s:"Lv", m:"[293]",  c:"pos-transicao",     r:7,  g:16},
  {z:117,s:"Ts", m:"[294]",  c:"halogeno",          r:7,  g:17},
  {z:118,s:"Og", m:"[294]",  c:"gas-nobre",         r:7,  g:18},
  // Lantanídeos (linha 9, grupos 3-17)
  {z:57, s:"La", m:"138,9",  c:"lantanideo",        r:9,  g:3},
  {z:58, s:"Ce", m:"140,1",  c:"lantanideo",        r:9,  g:4},
  {z:59, s:"Pr", m:"140,9",  c:"lantanideo",        r:9,  g:5},
  {z:60, s:"Nd", m:"144,2",  c:"lantanideo",        r:9,  g:6},
  {z:61, s:"Pm", m:"[145]",  c:"lantanideo",        r:9,  g:7},
  {z:62, s:"Sm", m:"150,4",  c:"lantanideo",        r:9,  g:8},
  {z:63, s:"Eu", m:"152,0",  c:"lantanideo",        r:9,  g:9},
  {z:64, s:"Gd", m:"157,3",  c:"lantanideo",        r:9,  g:10},
  {z:65, s:"Tb", m:"158,9",  c:"lantanideo",        r:9,  g:11},
  {z:66, s:"Dy", m:"162,5",  c:"lantanideo",        r:9,  g:12},
  {z:67, s:"Ho", m:"164,9",  c:"lantanideo",        r:9,  g:13},
  {z:68, s:"Er", m:"167,3",  c:"lantanideo",        r:9,  g:14},
  {z:69, s:"Tm", m:"168,9",  c:"lantanideo",        r:9,  g:15},
  {z:70, s:"Yb", m:"173,0",  c:"lantanideo",        r:9,  g:16},
  {z:71, s:"Lu", m:"175,0",  c:"lantanideo",        r:9,  g:17},
  // Actinídeos (linha 10, grupos 3-17)
  {z:89, s:"Ac", m:"[227]",  c:"actinideo",         r:10, g:3},
  {z:90, s:"Th", m:"232,0",  c:"actinideo",         r:10, g:4},
  {z:91, s:"Pa", m:"231,0",  c:"actinideo",         r:10, g:5},
  {z:92, s:"U",  m:"238,0",  c:"actinideo",         r:10, g:6},
  {z:93, s:"Np", m:"[237]",  c:"actinideo",         r:10, g:7},
  {z:94, s:"Pu", m:"[244]",  c:"actinideo",         r:10, g:8},
  {z:95, s:"Am", m:"[243]",  c:"actinideo",         r:10, g:9},
  {z:96, s:"Cm", m:"[247]",  c:"actinideo",         r:10, g:10},
  {z:97, s:"Bk", m:"[247]",  c:"actinideo",         r:10, g:11},
  {z:98, s:"Cf", m:"[251]",  c:"actinideo",         r:10, g:12},
  {z:99, s:"Es", m:"[252]",  c:"actinideo",         r:10, g:13},
  {z:100,s:"Fm", m:"[257]",  c:"actinideo",         r:10, g:14},
  {z:101,s:"Md", m:"[258]",  c:"actinideo",         r:10, g:15},
  {z:102,s:"No", m:"[259]",  c:"actinideo",         r:10, g:16},
  {z:103,s:"Lr", m:"[266]",  c:"actinideo",         r:10, g:17},
];


const FONT = "Arial, Helvetica, sans-serif";

// ── Componente ─────────────────────────────────────────────────────────────
export default function TabelaPeriodica({ size = "a4-landscape" }: { size?: TabelaSize }) {
  const d = DIMS[size];
  const X0 = (d.vbW - 18 * d.CW) / 2;

  function rowY(r: number): number {
    if (r <= 7) return d.TABLE_Y + (r - 1) * d.CH;
    const F_Y = d.TABLE_Y + 7 * d.CH + d.F_GAP;
    if (r === 9)  return F_Y;
    return F_Y + d.FCH;
  }
  function colX(g: number) { return X0 + (g - 1) * d.CW; }

  const F_Y = d.TABLE_Y + 7 * d.CH + d.F_GAP;

  // Para a4-landscape: o SVG usa viewBox portrait (210×297) e o conteúdo é
  // rotacionado internamente com SVG transform — sem CSS rotation, sem clipping.
  // rotate(90) + translate(vbH, 0) mapeia coordenadas landscape → portrait.
  const isA4 = size === "a4-landscape";
  const svgViewBox = isA4
    ? `0 0 ${d.vbH} ${d.vbW}`   // 210 297 (portrait)
    : `0 0 ${d.vbW} ${d.vbH}`;  // 210 148 (meia-folha)
  const contentTransform = isA4
    ? `translate(${d.vbH}, 0) rotate(90)` // landscape coords → portrait
    : undefined;

  return (
    <div className={size === "a4-landscape" ? styles.a4landscape : styles.meiafolha}>
      <svg
        viewBox={svgViewBox}
        width="100%" height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
      <g transform={contentTransform}>
        {/* Título */}
        <text x={d.vbW / 2} y={d.TABLE_Y - 4.5}
              fontFamily={FONT} fontSize={d.titleSize} fontWeight="bold"
              fill="#1a1a1a" textAnchor="middle" letterSpacing="0.3">
          TABELA PERIÓDICA DOS ELEMENTOS
        </text>

        {/* Números de grupo (1–18) */}
        {Array.from({ length: 18 }, (_, i) => (
          <text key={i}
                x={colX(i + 1) + (d.CW - 0.3) / 2}
                y={d.TABLE_Y - 1.2}
                fontFamily={FONT} fontSize={d.groupSize} fill="#666" textAnchor="middle">
            {i + 1}
          </text>
        ))}

        {/* Números de período (1–7) */}
        {Array.from({ length: 7 }, (_, i) => (
          <text key={i}
                x={X0 - 1.2}
                y={rowY(i + 1) + (d.CH - 0.3) / 2 + d.periodSize * 0.4}
                fontFamily={FONT} fontSize={d.periodSize} fill="#666" textAnchor="end">
            {i + 1}
          </text>
        ))}

        {/* Rótulos f-block */}
        <text x={X0 - 1.2} y={rowY(9)  + d.FCH / 2 + 1} fontFamily={FONT} fontSize={d.periodSize} fill="#666" textAnchor="end">*</text>
        <text x={X0 - 1.2} y={rowY(10) + d.FCH / 2 + 1} fontFamily={FONT} fontSize={d.periodSize} fill="#666" textAnchor="end">**</text>

        {/* Placeholders período 6 e 7, grupo 3 */}
        {([
          { row: 6, label: "57–71 *",   cat: "lantanideo" as Cat },
          { row: 7, label: "89–103 **", cat: "actinideo"  as Cat },
        ]).map(({ row, label, cat }) => {
          const x = colX(3), y = rowY(row);
          const w = d.CW - 0.3, h = d.CH - 0.3;
          return (
            <g key={row}>
              <rect x={x} y={y} width={w} height={h}
                    fill={CAT_COLOR[cat]} stroke="#555" strokeWidth={0.25}
                    strokeDasharray="1.5 0.5" rx={0.4} />
              <text x={x + w / 2} y={y + h / 2 + d.zSize * 0.5}
                    fontFamily={FONT} fontSize={d.zSize * 1.1}
                    fill="#555" textAnchor="middle" fontStyle="italic">
                {label}
              </text>
            </g>
          );
        })}

        {/* Todos os elementos */}
        {ELEMENTS.map(el => {
          const x   = colX(el.g);
          const y   = rowY(el.r);
          const isF = el.r >= 9;
          const w   = d.CW  - 0.3;
          const h   = (isF ? d.FCH : d.CH) - 0.3;
          const cx  = x + w / 2;
          return (
            <g key={el.z}>
              <rect x={x} y={y} width={w} height={h}
                    fill={CAT_COLOR[el.c]} stroke="#555" strokeWidth={0.25} rx={0.4} />
              <text x={x + 1} y={y + d.zSize + 0.5}
                    fontFamily={FONT} fontSize={d.zSize} fill="#333">
                {el.z}
              </text>
              <text x={cx} y={y + h / 2 + (isF ? d.symSizeF : d.symSize) * 0.4}
                    fontFamily={FONT} fontSize={isF ? d.symSizeF : d.symSize}
                    fontWeight="bold" fill="#000" textAnchor="middle">
                {el.s}
              </text>
              <text x={cx} y={y + h - 1}
                    fontFamily={FONT} fontSize={d.massSize} fill="#444" textAnchor="middle">
                {el.m}
              </text>
            </g>
          );
        })}
      </g>
      </svg>
    </div>
  );
}
