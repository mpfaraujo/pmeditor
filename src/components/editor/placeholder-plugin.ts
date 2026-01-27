import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export function placeholderPlugin(placeholders: Record<string, string>) {
  return new Plugin({
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        
        state.doc.descendants((node, pos) => {
          // Só mostra placeholder se o node estiver vazio
          if (node.content.size === 0 && node.type.isBlock) {
            const placeholder = placeholders[node.type.name];
            if (placeholder) {
              const decoration = Decoration.widget(
                pos + 1,
                () => {
                  const span = document.createElement("span");
                  span.className = "placeholder";
                  span.textContent = placeholder;
                  span.style.cssText = `
                    color: #999;
                    pointer-events: none;
                    position: absolute;
                  `;
                  return span;
                },
                { side: -1 }
              );
              decorations.push(decoration);
            }
          }
        });
        
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}
