// src/lib/importQueue/imagensPadrao.ts
// Padrão das imagens importadas (placeholder → nó image), usado pelo bulk-import e pelo
// /dev/revisar para os dois darem o mesmo resultado:
// - enunciado / texto base: centralizada; largura ≈ tamanho impresso no PDF, entre 8 e 13 cm
// - alternativa: sem alinhamento; no máximo 8 cm (comportamento antigo)
// O professor ajusta na diagramação se quiser; aqui é só um ponto de partida melhor.

const PX_POR_CM_TELA = 37.8;     // largura do nó image é em px de tela (96 dpi)
const PX_POR_CM_RECORTE = 95;    // recortes do PDF saem ~240 dpi → ~95 px por cm impresso
const MIN_CM = 8;
const MAX_CM = 13;
const MAX_CM_ALTERNATIVA = 8;

export function larguraPadraoPx(naturalPx: number | null | undefined, emAlternativa: boolean): number | null {
  if (!naturalPx || naturalPx <= 0) return null;
  if (emAlternativa) return Math.min(naturalPx, Math.round(MAX_CM_ALTERNATIVA * PX_POR_CM_TELA));
  const cm = Math.min(MAX_CM, Math.max(MIN_CM, Math.round(naturalPx / PX_POR_CM_RECORTE)));
  return Math.round(cm * PX_POR_CM_TELA);
}

export function alinhamentoPadrao(emAlternativa: boolean): "center" | null {
  return emAlternativa ? null : "center";
}
