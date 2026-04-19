import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { TextSelection } from "prosemirror-state";

// Caret customizado via decoration — não some em modais nem perde estabilidade.
// O caret nativo é ocultado via caret-color: transparent no CSS global.
export const cursorPlugin = new Plugin({
  props: {
    decorations(state) {
      const { selection } = state;
      if (!(selection instanceof TextSelection) || !selection.empty) {
        return DecorationSet.empty;
      }

      const cursor = document.createElement("span");
      cursor.className = "pm-custom-caret";

      return DecorationSet.create(state.doc, [
        Decoration.widget(selection.head, cursor, {
          side: 1,
          key: "custom-caret",
        }),
      ]);
    },
  },
});
