"use client";

type Props = {
  numero: number | string;
  totalMm?: number; // largura total do header (default 85mm = 8,5cm)
  boxMm?: number; // largura da caixa (default 28mm)
  heightMm?: number; // altura do header (default 7mm)
};

export default function QuestaoHeaderSvg({
  numero,
  totalMm = 85,
  boxMm = 28,
  heightMm = 7,
}: Props) {
  const padX = 2.2; // padding do texto dentro da caixa (mm)
  const r = 2.2; // raio da borda (mm)
  const stroke = 0.35; // espessura (mm)

  const boxX = stroke;
  const boxY = stroke;
  const boxW = boxMm - stroke * 2;
  const boxH = heightMm - stroke * 2;

  const lineGap = 2; // distância entre caixa e início da linha (mm)
const lineX1 = boxX + boxW + stroke - 5 / 2;
const lineY = boxY + boxH - stroke +.7/ 2;



  const textX = boxX + padX;
  const textY = heightMm / 2;

  return (
    <div className="questao-header-wrap">
      <svg
        className="questao-header-svg"
        width={`${totalMm}mm`}
        height={`${heightMm}mm`}
        viewBox={`0 0 ${totalMm} ${heightMm}`}
        preserveAspectRatio="xMinYMin meet"
        aria-hidden="true"
      >
        <rect
          x={boxX}
          y={boxY}
          width={boxW}
          height={boxH}
          rx={r}
          ry={r}
          fill="#eee"
          stroke="#000"
          strokeWidth={stroke}
        />

        <text
          x={textX}
          y={textY}
          dominantBaseline="middle"
          fontFamily="Calibri, Arial, sans-serif"
          fontSize="4"
          fontWeight="700"
          fill="#000"
        >
          Questão {numero}
        </text>

        <line
          x1={lineX1}
          y1={lineY}
          x2={totalMm}
          y2={lineY}
          stroke="#000"
          strokeWidth={stroke}
        />
      </svg>

      <span
        contentEditable
        suppressContentEditableWarning
        className="questao-pontos-editavel"
      />
    </div>
  );
}
