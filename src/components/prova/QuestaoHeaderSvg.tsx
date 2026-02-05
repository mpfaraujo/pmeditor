"use client";

type Props = {
  numero: number | string;
  totalMm?: number;
  boxMm?: number; // usado apenas no variant 0 (classic)
  heightMm?: number;
  variant?: 0 | 1 | 2 | 3 | 4; // 0=classic, 1=bracket, 2=badge, 3=minimal, 4=corner
};

export default function QuestaoHeaderSvg({
  numero,
  totalMm = 85,
  boxMm = 28,
  heightMm = 7,
  variant = 0,
}: Props) {
  const stroke = 0.35;

  // VARIANT 0 - CLASSIC (design atual)
  if (variant === 0) {
    const padX = 2.2;
    const r = 2.2;
    const boxX = stroke;
    const boxY = stroke;
    const boxW = boxMm - stroke * 2;
    const boxH = heightMm - stroke * 2;
    const lineX1 = boxX + boxW + stroke - 2.5;
    const lineY = boxY + boxH - stroke + 0.35;
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

  // VARIANT 1 - BRACKET (colchete moderno)
  if (variant === 1) {
    const bracketW = 1.5;
    const bracketH = 5;
    const textX = 3;
    const textY = heightMm / 2;
    const lineY = heightMm - 1.5;

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
          <path
            d={`M ${bracketW} ${(heightMm - bracketH) / 2} 
                L 0 ${(heightMm - bracketH) / 2} 
                L 0 ${(heightMm + bracketH) / 2} 
                L ${bracketW} ${(heightMm + bracketH) / 2}`}
            fill="none"
            stroke="#000"
            strokeWidth={stroke * 1.2}
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
            x1={20}
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

  // VARIANT 2 - BADGE (círculo compacto - só número)
  if (variant === 2) {
    const radius = 2.5;
    const cx = radius + 1;
    const cy = heightMm / 2;

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
          <circle cx={cx} cy={cy} r={radius} fill="#000" stroke="none" />
          <text
            x={cx}
            y={cy}
            dominantBaseline="middle"
            textAnchor="middle"
            fontFamily="Calibri, Arial, sans-serif"
            fontSize="3"
            fontWeight="700"
            fill="#fff"
          >
            {numero}
          </text>
        </svg>
        <span
          contentEditable
          suppressContentEditableWarning
          className="questao-pontos-editavel"
        />
      </div>
    );
  }

  // VARIANT 3 - MINIMAL (só número)
  if (variant === 3) {
    const textX = 1;
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
          <text
            x={textX}
            y={textY}
            dominantBaseline="middle"
            fontFamily="Calibri, Arial, sans-serif"
            fontSize="4"
            fontWeight="700"
            fill="#000"
          >
            {numero}
          </text>
        </svg>
        <span
          contentEditable
          suppressContentEditableWarning
          className="questao-pontos-editavel"
        />
      </div>
    );
  }

  // VARIANT 4 - CORNER (canto com linha pontilhada)
  if (variant === 4) {
    const cornerSize = 4;
    const textX = cornerSize + 1.5;
    const textY = heightMm / 2;
    const lineY = heightMm - 1.5;

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
          <path
            d={`M 0 ${cornerSize} L 0 0 L ${cornerSize} 0`}
            fill="none"
            stroke="#000"
            strokeWidth={stroke * 1.5}
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
            x1={20}
            y1={lineY}
            x2={totalMm}
            y2={lineY}
            stroke="#000"
            strokeWidth={stroke}
            strokeDasharray="1 1"
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

  return null;
}