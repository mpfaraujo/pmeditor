import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { schema } from "../schema";

/**
 * Adiciona `data-line-num` a cada 5º verso não-vazio dentro de poemas numerados.
 * Linhas em branco (separadores de estrofe) NÃO são contadas.
 */
export const verseNumberingPlugin = new Plugin({
  props: {
    decorations(state) {
      const decorations: Decoration[] = [];

      state.doc.descendants((node, pos) => {
        if (node.type !== schema.nodes.poem) return true;
        if (!node.attrs.numbered) return false; // poema não numerado: não processa filhos

        let nonEmptyCount = 0;

        node.forEach((child, offset) => {
          if (child.type !== schema.nodes.verse) return;

          const isEmpty = child.content.size === 0;
          if (isEmpty) return; // estrofe em branco: pula sem contar

          nonEmptyCount++;

          if (nonEmptyCount % 5 === 0) {
            const verseStart = pos + 1 + offset; // +1 pelo token de abertura do poem
            decorations.push(
              Decoration.node(verseStart, verseStart + child.nodeSize, {
                "data-line-num": String(nonEmptyCount),
              })
            );
          }
        });

        return false; // não desce para dentro de poem novamente
      });

      return DecorationSet.create(state.doc, decorations);
    },
  },
});
