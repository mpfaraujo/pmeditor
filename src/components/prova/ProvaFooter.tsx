// src/components/prova/ProvaFooter.tsx

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
}

export function ProvaFooter({ disciplina, currentPage, totalPages, spacerHeight = 0, tipoAtual, numTipos }: ProvaFooterProps) {
  const prefix = disciplina ? `Prova de ${disciplina}` : "Prova";
  const tipoTexto = (numTipos && numTipos > 1) ? `Tipo ${tipoAtual}` : "";

  return (
    <>
      <div
        className="prova-footer-spacer"
        style={{ height: spacerHeight > 0 ? spacerHeight : 0 }}
      />
      <div className="prova-footer">
        <span>{prefix}</span>
        <span contentEditable suppressContentEditableWarning className="footer-editavel">
          {tipoTexto}
        </span>
        <span>Página {currentPage} de {totalPages}</span>
      </div>
    </>
  );
}
