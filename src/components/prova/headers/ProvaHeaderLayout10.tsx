// src/components/prova/headers/ProvaHeaderLayout5.tsx

/**
 * Layout 5 - Informações Agrupadas por Tipo
 * Seções visuais: ALUNO | AVALIAÇÃO
 */

interface ProvaHeaderLayout10Props {
  logoUrl: string | null;
  onLogoClick: () => void;
  isEditable?: boolean;
  nome?: string;
  turma?: string;
  professor?: string;
  disciplina?: string;
  data?: string;
  nota?: string;
  instituicao?:string
}

function formatDateBR(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(2)}`;
}

export function ProvaHeaderLayout10({
  logoUrl,
  onLogoClick,
  isEditable = true,
  nome,
  turma,
  professor,
  disciplina,
  data,
  nota,
  instituicao
}: ProvaHeaderLayout10Props) {
 return (
    <div className="mb-[1cm] px-1 py-1 rounded-[5px] border-1 border-gray-800 w-[18cm]">
      {/* header-grid */}
      <div className="grid grid-cols-[2cm_1fr_4cm] gap-[0.15cm] mb-[0.00cm] items-stretch">
        <div
          className={`logo-area [grid-row:auto] flex items-center justify-center text-xs font-bold ${
            isEditable ? "cursor-pointer" : "cursor-default"
          } ${logoUrl ? "" : "border-2 border-gray-800"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo da instituição"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            "LOGO"
          )}
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">
            Nome
          </div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9]">
            <span className="block min-h-[1em] leading-[1.1]">{nome ?? ""}</span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">
            Turma
          </div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9]">
            <span className="block min-h-[1em] leading-[1.1]">{turma ?? ""}</span>
          </div>
        </div>
      </div>

      {/* header-grid-2 */}
      <div className="grid grid-cols-[1fr_1fr_3cm_3cm] gap-[0.15cm] mb-[0.05cm] items-stretch">
        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">
            Professor
          </div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9]">
            <span className="block min-h-[1em] leading-[1.1]">
              {professor ?? ""}
            </span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">
            Disciplina
          </div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9]">
            <span className="block min-h-[1em] leading-[1.1]">
              {disciplina ?? ""}
            </span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">
            Data
          </div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9]">
            <span className="block min-h-[1em] leading-[1.1]">
              {formatDateBR(data ?? "")}
            </span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">
            Nota
          </div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9]">
            <span className="block min-h-[1em] leading-[1.1]">{nota ?? ""}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#666] text-white text-center p-[3px] font-bold outline-none mt-[0.1cm] rounded-[5px] [print-color-adjust:exact] [-webkit-print-color-adjust:exact] focus:bg-[#555]">
        {instituicao ?? ""}
      </div>
    </div>
  );
}
