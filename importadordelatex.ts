import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { randomUUID } from 'crypto';

type ParseResult = {
  fullJson: any;
  warnings: string[];
};

function latexToProseMirror(texContent: string, filename: string): ParseResult {
  const warnings: string[] = [];
  const lines = texContent.trim().split('\n');
  
  // Detecta tabular
  if (texContent.includes('\\begin{tabular}')) {
    warnings.push('⚠️  TABULAR detectado - renderizar e salvar PNG manualmente');
  }
  
  // Detecta TikZ
  if (texContent.includes('\\begin{tikzpicture}')) {
    warnings.push('⚠️  TIKZ detectado - renderizar e salvar PNG manualmente');
  }
  
  // Detecta \includegraphics
  const imgMatch = texContent.match(/\\includegraphics(?:\[.*?\])?\{(.+?)\}/);
  if (imgMatch) {
    const imgPath = imgMatch[1];
    warnings.push(`📷 IMAGEM: ${imgPath} - copiar para pasta de upload`);
  }
  
  const questionStart = lines.findIndex(l => l.includes('\\question'));
  const choicesStart = lines.findIndex(l => l.includes('\\begin{oneparchoices}'));
  const choicesEnd = lines.findIndex(l => l.includes('\\end{oneparchoices}'));
  
  if (questionStart === -1) {
    throw new Error('Questão não encontrada');
  }
  
  const statementLines = lines.slice(questionStart + 1, choicesStart > -1 ? choicesStart : undefined).filter(l => l.trim());
  const statementText = statementLines.join(' ').trim();
  
  let options: any[] = [];
  let gabarito: string = 'A'; // default
  
  if (choicesStart > -1 && choicesEnd > -1) {
    const choicesLines = lines.slice(choicesStart + 1, choicesEnd);
    let optionIndex = 0;
    
    choicesLines.forEach(line => {
      const isCorrect = line.includes('\\correctchoice');
      const choiceMatch = line.match(/\\(?:correct)?choice\s+(.+)/);
      
      if (choiceMatch) {
        const letter = String.fromCharCode(65 + optionIndex);
        const text = choiceMatch[1].trim();
        
        if (isCorrect) gabarito = letter;
        
        options.push({
          type: 'option',
          attrs: { letter },
          content: [
            {
              type: 'paragraph',
              content: parseInlineText(text),
            },
          ],
        });
        
        optionIndex++;
      }
    });
  }
  
  const questionContent: any[] = [
    {
      type: 'statement',
      content: [
        {
          type: 'paragraph',
          content: parseInlineText(statementText),
        },
      ],
    },
  ];
  
  if (options.length > 0) {
    questionContent.push({
      type: 'options',
      content: options,
    });
  }
  
  const now = new Date().toISOString();
  
  const fullJson = {
    metadata: {
      schemaVersion: 1,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      tipo: 'Múltipla Escolha',
      dificuldade: 'Fácil',
      tags: [],
      gabarito: {
        kind: 'mcq',
        correct: gabarito,
      },
      source: {
        kind: 'original',
      },
    },
    content: {
      type: 'doc',
      content: [
        {
          type: 'question',
          content: questionContent,
        },
      ],
    },
  };
  
  return { fullJson, warnings };
}

function parseInlineText(text: string): any[] {
  const parts: any[] = [];
  const regex = /\$([^$]+)\$/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore) parts.push({ type: 'text', text: textBefore });
    }
    
    parts.push({
      type: 'math_inline',
      attrs: { latex: match[1] },
    });
    
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    const textAfter = text.slice(lastIndex);
    if (textAfter) parts.push({ type: 'text', text: textAfter });
  }
  
  return parts.length > 0 ? parts : [{ type: 'text', text: '' }];
}

function convertFolder(inputFolder: string, outputFolder: string) {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  
  const files = fs.readdirSync(inputFolder).filter(f => f.endsWith('.tex'));
  
  console.log(`\n📁 Encontrados ${files.length} arquivos .tex\n`);
  
  let successCount = 0;
  let errorCount = 0;
  const pendingActions: { file: string; warnings: string[]; gabarito: string }[] = [];
  
  for (const file of files) {
    try {
      const texPath = path.join(inputFolder, file);
      const texContent = fs.readFileSync(texPath, 'utf-8');
      
      const { fullJson, warnings } = latexToProseMirror(texContent, file);
      const gabarito = fullJson.metadata.gabarito.correct;
      
      const jsonFilename = file.replace('.tex', '.json');
      const jsonPath = path.join(outputFolder, jsonFilename);
      
      fs.writeFileSync(jsonPath, JSON.stringify(fullJson, null, 2), 'utf-8');
      
      if (warnings.length > 0) {
        pendingActions.push({ file, warnings, gabarito });
        console.log(`⚠️  ${file} → ${jsonFilename} [Gabarito: ${gabarito}] (REQUER AÇÃO)`);
      } else {
        console.log(`✅ ${file} → ${jsonFilename} [Gabarito: ${gabarito}]`);
      }
      
      successCount++;
      
    } catch (error) {
      console.error(`❌ Erro em ${file}:`, error instanceof Error ? error.message : error);
      errorCount++;
    }
  }
  
  console.log(`\n✨ Conversão concluída!`);
  console.log(`✅ Sucesso: ${successCount}`);
  console.log(`❌ Erros: ${errorCount}`);
  console.log(`📂 Arquivos salvos em: ${outputFolder}`);
  
  if (pendingActions.length > 0) {
    console.log(`\n⚠️  AÇÕES PENDENTES (${pendingActions.length} arquivos):\n`);
    pendingActions.forEach(({ file, warnings, gabarito }) => {
      console.log(`📄 ${file} [Gabarito: ${gabarito}]:`);
      warnings.forEach(w => console.log(`   ${w}`));
      console.log('');
    });
  }
}

async function main() {
  console.log('🔄 Importador LaTeX → JSON ProseMirror\n');
  
  const { inputFolder } = await inquirer.prompt([
    {
      type: 'input',
      name: 'inputFolder',
      message: 'Caminho da pasta com arquivos .tex:',
      default: 'C:\\Users\\mpfar\\OneDrive\\Documentos\\2023\\tex\\2023\\listas\\Questoes\\PA',
    },
  ]);

  const { outputFolder } = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputFolder',
      message: 'Caminho para salvar os JSONs:',
      default: 'C:\\Users\\mpfar\\Desktop\\questoes-json',
    },
  ]);

  convertFolder(inputFolder, outputFolder);
}

main();