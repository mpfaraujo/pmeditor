/**
 * renderBaseTextDoc.tsx
 *
 * Renderizador mínimo de ProseMirror doc JSON para os containers de medição
 * do BaseTextMeasurer. Produz HTML estático com data-anchor-id nos text_anchors.
 *
 * Não precisa ser bonito — precisa apenas:
 *   - Quebrar linhas no mesmo ponto que o layout real
 *   - Preservar spans [data-anchor-id] para medição
 *   - Não renderizar nodes que não contam como linha de texto (imagens)
 */

import React, { Fragment } from "react";

type PMNode = {
  type: string;
  text?: string;
  attrs?: Record<string, any>;
  content?: PMNode[];
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
};

function applyMarks(text: string, marks: Array<{ type: string; attrs?: Record<string, any> }> = []): React.ReactNode {
  let node: React.ReactNode = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "strong":     node = <strong>{node}</strong>; break;
      case "em":         node = <em>{node}</em>; break;
      case "underline":  node = <u>{node}</u>; break;
      case "superscript": node = <sup>{node}</sup>; break;
      case "subscript":  node = <sub>{node}</sub>; break;
      case "text_anchor":
        node = <span data-anchor-id={mark.attrs?.id}>{node}</span>;
        break;
      // outros marks ignorados (não afetam quebra de linha)
    }
  }
  return node;
}

function renderNode(node: PMNode, key: number | string): React.ReactNode {
  if (!node) return null;

  switch (node.type) {
    case "doc":
      return (
        <Fragment key={key}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </Fragment>
      );

    case "text":
      return (
        <Fragment key={key}>
          {applyMarks(node.text ?? "", node.marks ?? [])}
        </Fragment>
      );

    case "paragraph":
      return (
        <p key={key} style={{ margin: "0 0 0.2em 0" }}>
          {node.content?.map((child, i) => renderNode(child, i)) ?? <br />}
        </p>
      );

    case "math_inline": {
      // KaTeX é assíncrono — renderiza como texto bruto para medir posição
      const latex = node.attrs?.latex ?? "";
      return <span key={key} className="math-inline">{latex}</span>;
    }

    case "math_block":
      return <div key={key} style={{ margin: "0.2em 0" }}>{node.attrs?.latex ?? ""}</div>;

    case "image":
      // Imagens não contam como linha de texto — omite
      return null;

    case "bullet_list":
      return (
        <ul key={key} style={{ paddingLeft: "1.2em", margin: "0.2em 0" }}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </ul>
      );

    case "ordered_list":
      return (
        <ol key={key} style={{ paddingLeft: "1.2em", margin: "0.2em 0" }}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </ol>
      );

    case "roman_list":
    case "alpha_list":
    case "assertive_list":
      return (
        <ul key={key} style={{ paddingLeft: "1.2em", margin: "0.2em 0", listStyle: "none" }}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </ul>
      );

    case "list_item":
      return (
        <li key={key}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </li>
      );

    case "poem":
      return (
        <div key={key} style={{ margin: "0.2em 0" }}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </div>
      );

    case "poem_line":
      return (
        <p key={key} style={{ margin: 0 }}>
          {node.content?.map((child, i) => renderNode(child, i)) ?? <br />}
        </p>
      );

    case "credits":
      return (
        <p key={key} style={{ margin: "0.2em 0", fontSize: "0.9em" }}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </p>
      );

    case "databox":
      return (
        <div key={key} style={{ border: "1px solid #000", padding: "0.2em", margin: "0.2em 0" }}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </div>
      );

    case "code_block":
      return (
        <pre key={key} style={{ fontFamily: "monospace", margin: "0.2em 0" }}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </pre>
      );

    case "table":
      return (
        <table key={key} style={{ borderCollapse: "collapse", margin: "0.2em 0" }}>
          <tbody>{node.content?.map((child, i) => renderNode(child, i))}</tbody>
        </table>
      );

    case "table_row":
      return <tr key={key}>{node.content?.map((child, i) => renderNode(child, i))}</tr>;

    case "table_cell":
      return (
        <td key={key} style={{ border: "1px solid #000", padding: "0.1em 0.3em" }}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </td>
      );

    case "block_title":
      // Títulos de bloco (ex: "Texto I") não contam como linha de texto
      return null;

    default:
      // Fallback: renderiza filhos
      return (
        <Fragment key={key}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </Fragment>
      );
  }
}

export function renderBaseTextDoc(doc: any): React.ReactNode {
  if (!doc) return null;
  return renderNode(doc as PMNode, "root");
}
