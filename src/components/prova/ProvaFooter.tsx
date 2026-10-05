// src/components/prova/ProvaFooter.tsx
import { useProva } from "@/contexts/ProvaContext";

interface ProvaFooterProps {
  disciplina?: string;
  currentPage: number;
  totalPages: number;
  /** Altura do spacer em px — calculada pela paginação */
  spacerHeight?: number;
  /** Tipo atual da prova (se tiver múltiplos tipos) */
  tipoAtual?: number;
  /** Total de tipos gerados */
  numTipos?: number;
  layoutType?: "prova" | "exercicio" | "acessivel";
}

export function ProvaFooter({ disciplina, currentPage, totalPages, spacerHeight = 0, tipoAtual, numTipos, layoutType = "prova" }: ProvaFooterProps) {
  const prefix = layoutType === "exercicio"
    ? (disciplina ? `Lista de Exercícios - ${disciplina}` : "Lista de Exercícios")
    : (disciplina ? `Prova de ${disciplina}` : "Prova");
  const tipoTexto = (numTipos && numTipos > 1) ? `Tipo ${tipoAtual}` : "";
  const { provaConfig } = useProva();
  const textoCentral = provaConfig.rodapeMensagem || tipoTexto;

  return (
    <>
      <div
        className="prova-footer-spacer"
        style={{ height: spacerHeight > 0 ? spacerHeight : 0 }}
      />
      <div className="prova-footer">
        <span>{prefix}</span>
        {/* key remonta o span quando o texto muda: evita o React duplicar texto em contentEditable */}
        <span key={textoCentral} contentEditable suppressContentEditableWarning className="footer-editavel">
          {textoCentral}
        </span>
        <span>Página {currentPage} de {totalPages}</span>
      </div>
    </>
  );
}
