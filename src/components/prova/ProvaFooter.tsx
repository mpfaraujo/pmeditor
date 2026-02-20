// src/components/prova/ProvaFooter.tsx

interface ProvaFooterProps {
  disciplina?: string;
  currentPage: number;
  totalPages: number;
  /** Altura do spacer em px — calculada pela paginação */
  spacerHeight?: number;
}

export function ProvaFooter({ disciplina, currentPage, totalPages, spacerHeight = 0 }: ProvaFooterProps) {
  const prefix = disciplina ? `Prova de ${disciplina}` : "Prova";

  return (
    <>
      <div
        className="prova-footer-spacer"
        style={{ height: spacerHeight > 0 ? spacerHeight : 0 }}
      />
      <div className="prova-footer">
        <span>{prefix}</span>
        <span contentEditable suppressContentEditableWarning className="footer-editavel" />
        <span>Página {currentPage} de {totalPages}</span>
      </div>
    </>
  );
}
