// Segunda trava das rotas /api/dev/*: além de não existirem no build de produção
// (pageExtensions em next.config.ts), recusam qualquer chamada fora de `next dev`.
export function bloqueadoForaDeDev(): Response | null {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  return null;
}
