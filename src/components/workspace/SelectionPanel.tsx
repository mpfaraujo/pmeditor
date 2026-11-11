"use client";

import { ArrowRight, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProva } from "@/contexts/ProvaContext";

export function SelectionPanel({ onBuild, onDiagramar }: { onBuild: () => void; onDiagramar: () => void }) {
  const { selectedQuestions, removeQuestion, selectedCount, clearAll } = useProva();
  return (
    <aside className="workspace-selection print:hidden" aria-label="Questões da sua prova">
      <div className="workspace-selection-heading"><h2>Sua prova</h2><span>{selectedCount}</span></div>
      <p className="workspace-help">Acompanhe sua seleção enquanto consulta o banco.</p>
      <ol className="workspace-selection-list">
        {selectedQuestions.map((question, index) => (
          <li key={question.metadata.id}>
            <span className="workspace-order">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{question.metadata.assunto || question.metadata.disciplina || "Questão"}</p>
              <p className="workspace-help">{question.metadata.tipo || "Questão"}</p>
            </div>
            <button type="button" onClick={() => removeQuestion(question.metadata.id)} aria-label={`Remover questão ${index + 1} da seleção`} className="workspace-remove"><X size={14} /></button>
          </li>
        ))}
      </ol>
      {selectedQuestions.length === 0 && <div className="workspace-selection-empty"><BookOpen size={25} aria-hidden="true" /><p>Selecione questões para começar sua prova.</p></div>}
      <div className="workspace-selection-actions">
        <Button onClick={onBuild} disabled={selectedCount === 0} className="workspace-primary w-full">Montar prova<ArrowRight size={16} /></Button>
        <Button variant="outline" onClick={onDiagramar} disabled={selectedCount === 0} className="w-full">Diagramar</Button>
        <Button variant="ghost" size="sm" onClick={clearAll} disabled={selectedCount === 0} className="w-full text-muted-foreground">Limpar seleção</Button>
      </div>
    </aside>
  );
}
