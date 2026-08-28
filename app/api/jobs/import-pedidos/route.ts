import { NextRequest, NextResponse } from "next/server";
import { upsertPedidosFromIntelipost } from "@/lib/pedidos";

const MAX_PEDIDOS_POR_REQUISICAO = 5000;

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret") ?? request.headers.get("x-pedidos-import-secret");
  const expectedSecret = process.env.PEDIDOS_IMPORT_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "corpo da requisição não é um JSON válido" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !Array.isArray((body as Record<string, unknown>).pedidos)) {
    return NextResponse.json(
      { error: 'corpo esperado: { "pedidos": [ { ... }, ... ] }' },
      { status: 400 },
    );
  }

  const pedidos = (body as { pedidos: unknown[] }).pedidos;

  if (pedidos.length === 0) {
    return NextResponse.json({ error: "a lista de pedidos está vazia" }, { status: 400 });
  }

  if (pedidos.length > MAX_PEDIDOS_POR_REQUISICAO) {
    return NextResponse.json(
      { error: `a lista de pedidos excede o limite de ${MAX_PEDIDOS_POR_REQUISICAO} por requisição` },
      { status: 400 },
    );
  }

  const result = await upsertPedidosFromIntelipost(pedidos);

  const hasErrors =
    result.errosValidacao.length > 0 || result.transportadoraNaoEncontrada.length > 0 || result.errosPersistencia.length > 0;

  return NextResponse.json(
    {
      recebidos: result.recebidos,
      inseridos: result.inseridos,
      atualizados: result.atualizados,
      erros_validacao: result.errosValidacao,
      transportadora_nao_encontrada: result.transportadoraNaoEncontrada,
      erros_persistencia: result.errosPersistencia,
      avisos: result.avisos,
    },
    { status: hasErrors ? 207 : 200 },
  );
}
