# Projeto pmeditor - Instruções de Trabalho

## Diretrizes de Transcrição e Qualidade (Responsabilidades do Agente)

O objetivo central é a **autonomia com alta fidelidade**. O agente deve entregar o trabalho pronto para importação, tendo realizado internamente todas as etapas de auditoria para que o usuário não precise revisar o conteúdo manualmente.

### 1. Colação Literal Obrigatória (Executada pelo Agente)
*   **Fidelidade Total:** O agente deve comparar, linha a linha, o código `.tex` gerado contra o PDF original/extração bruta. 
*   **Correção de OCR:** Erros típicos de OCR (caracteres trocados, perda de formatação como negrito/itálico) devem ser corrigidos pelo agente durante a transcrição, sem intervenção do usuário.

### 2. Modelagem Estrutural (\basetext)
*   **Autonomia na Modelagem:** O agente deve identificar textos e imagens compartilhados e aplicar a estrutura `\basetext` corretamente desde o início.
*   **Consistência:** Garantir que `titulo_texto:` no YAML e o bloco `\basetext` estejam perfeitamente sincronizados no arquivo final.

### 3. Auditoria Visual e Técnica (Executada pelo Agente)
*   **Imagens e Gráficos:** O agente deve garantir que as imagens referenciadas existam, estejam bem recortadas e vinculadas à questão correta.
*   **Validação Interna:** O agente deve rodar o `check-tex-import.ts` e resolver **todos** os erros e avisos (especialmente os de formatação) antes de apresentar o trabalho.

### 4. Entrega Final e Relatório de Conformidade
*   Ao terminar, o agente apresenta um resumo do que foi feito e os comandos de importação prontos.
*   O relatório de auditoria serve como um selo de qualidade ("Eu fiz X, Y e Z e conferi contra a fonte W"), garantindo ao usuário que o material está íntegro e seguro para importação imediata.
