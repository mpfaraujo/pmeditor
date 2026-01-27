"use client";

import React from "react";

type Props = {
  /**
   * Mantém a mesma árvore de conteúdo que você já renderiza hoje
   * (questões, cabeçalho, etc.). No passo 1, ainda não há corte.
   */
  children: React.ReactNode;

  /**
   * Classe opcional para preservar exatamente seus estilos atuais.
   * Ex: "a4-root" / "prova-a4" / etc.
   */
  className?: string;
};

export default function PaginatedA4({ children, className }: Props) {
  // PASSO 1: 1 “página” só, sem paginação.
  // Próximos passos: medir altura, quebrar em várias páginas e replicar o wrapper.
  return (
    <div className={className}>
      <div data-a4-page>
        <div data-a4-content>{children}</div>
      </div>
    </div>
  );
}
