// ---------------------------------------------------------------------------
// Funções PURAS (sem IO / sem Prisma) de parsing e validação da carga
// Intelipost. Mantidas separadas de lib/pedidos.ts para serem testáveis sem
// depender do client do Prisma gerado (`prisma generate`).
// ---------------------------------------------------------------------------
// Contrato de payload da rotina Python (carga diária Intelipost).
// Ver docs/pedidos-import-payload.md para o formato completo com exemplos.
// ---------------------------------------------------------------------------

export interface PedidoIntelipostRow {
  pedido: string;
  nome_destinatario: string;
  canal_vendas: string;
  cidade_destinatario: string;
  uf: string;
  cep_destinatario: string;
  pedido_de_venda: string;
  codigo_rastreio?: string | null;
  nota_fiscal?: string | null;
  metodo_envio?: string | null;
  transportadora: string;
  valor_nota?: number | string | null;
  peso_fisico?: number | string | null;
  chave_nota?: string | null;
  data_criacao: string;
  data_entrega?: string | null;
  previsao_entrega_cliente?: string | null;
  previsao_entrega_transportadora?: string | null;
  data_despacho?: string | null;
  previsao_entrega_transportadora_original?: string | null;
  micro_status?: string | null;
  status_transportador?: string | null;
}

export interface ParsedPedidoRow {
  pedido: string;
  nomeDestinatario: string;
  canalVendas: string;
  cidadeDestinatario: string;
  uf: string;
  cepDestinatario: string;
  pedidoDeVenda: string;
  codigoRastreio: string | null;
  notaFiscal: string | null;
  metodoEnvio: string | null;
  transportadoraNomeOrigem: string;
  valorNota: number | null;
  pesoFisico: number | null;
  chaveNota: string | null;
  dataCriacaoPedido: Date;
  dataEntregaOrigem: Date | null;
  previsaoEntregaClienteOrigem: Date | null;
  previsaoEntregaTransportadoraOrigem: Date | null;
  dataDespacho: Date | null;
  previsaoEntregaTransportadoraOriginal: Date | null;
  microStatus: string | null;
  statusTransportador: string | null;
  avisos: string[];
}

export interface RowError {
  index: number;
  pedido: string | null;
  motivo: string;
}

const REQUIRED_STRING_FIELDS: Array<keyof PedidoIntelipostRow> = [
  "pedido",
  "nome_destinatario",
  "cidade_destinatario",
  "uf",
  "cep_destinatario",
  "pedido_de_venda",
  "transportadora",
  "data_criacao",
];

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function parseFlexibleDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // aceita "YYYY-MM-DD" ou ISO completo "YYYY-MM-DDTHH:mm:ss[Z]"
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(trimmed);
  if (isoMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = isoMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseFlexibleDecimal(value: number | string | null | undefined): { value: number | null; invalid: boolean } {
  if (value === null || value === undefined || value === "") return { value: null, invalid: false };
  if (typeof value === "number") {
    return Number.isFinite(value) ? { value, invalid: false } : { value: null, invalid: true };
  }
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const asNumber = Number(normalized.includes(",") || normalized !== value.trim() ? normalized : value.trim());
  if (Number.isFinite(asNumber)) return { value: asNumber, invalid: false };
  return { value: null, invalid: true };
}

/**
 * Valida e converte uma linha crua do payload da Intelipost para o formato
 * interno usado no upsert. Não toca no banco - função pura, testável.
 */
export function parseIntelipostPedidoRow(
  raw: unknown,
  index: number,
): { ok: true; data: ParsedPedidoRow } | { ok: false; error: RowError } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: { index, pedido: null, motivo: "Linha não é um objeto JSON válido." } };
  }
  const row = raw as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    const fieldValue = row[field];
    if (typeof fieldValue !== "string" || fieldValue.trim() === "") {
      return {
        ok: false,
        error: {
          index,
          pedido: typeof row.pedido === "string" ? row.pedido : null,
          motivo: `Campo obrigatório ausente ou vazio: "${field}".`,
        },
      };
    }
  }

  const pedido = (row.pedido as string).trim();

  const isReversa = pedido.toUpperCase().includes("-REVERSA");
  const canalVendasOrigem =
    typeof row.canal_vendas === "string" ? row.canal_vendas.trim() : "";

  if (!isReversa && !canalVendasOrigem) {
    return {
      ok: false,
      error: {
        index,
        pedido,
        motivo: 'Campo obrigatorio ausente ou vazio: "canal_vendas".',
      },
    };
  }

  const dataCriacaoPedido = parseFlexibleDate(row.data_criacao as string);
  if (!dataCriacaoPedido) {
    return {
      ok: false,
      error: { index, pedido, motivo: `Campo "data_criacao" com formato inválido: "${row.data_criacao}".` },
    };
  }

  const avisos: string[] = [];

  let dataEntregaOrigem: Date | null = null;
  if (row.data_entrega !== null && row.data_entrega !== undefined && row.data_entrega !== "") {
    if (typeof row.data_entrega !== "string") {
      avisos.push(`Campo "data_entrega" em formato inesperado, ignorado.`);
    } else {
      const parsed = parseFlexibleDate(row.data_entrega);
      if (!parsed) {
        avisos.push(`Campo "data_entrega" com formato inválido ("${row.data_entrega}"), ignorado.`);
      } else {
        dataEntregaOrigem = parsed;
      }
    }
  }

  const parseOptionalDateField = (
    field:
      | "previsao_entrega_cliente"
      | "previsao_entrega_transportadora"
      | "data_despacho"
      | "previsao_entrega_transportadora_original",
  ): Date | null => {
    const value = row[field];
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string") {
      avisos.push(`Campo "${field}" em formato inesperado, ignorado.`);
      return null;
    }
    const parsed = parseFlexibleDate(value);
    if (!parsed) avisos.push(`Campo "${field}" com formato inválido ("${value}"), ignorado.`);
    return parsed;
  };

  const previsaoEntregaClienteOrigem = parseOptionalDateField("previsao_entrega_cliente");
  const previsaoEntregaTransportadoraOrigem = parseOptionalDateField("previsao_entrega_transportadora");
  const dataDespacho = parseOptionalDateField("data_despacho");
  const previsaoEntregaTransportadoraOriginal = parseOptionalDateField(
    "previsao_entrega_transportadora_original",
  );

  const valorNotaResult = parseFlexibleDecimal(row.valor_nota as number | string | null | undefined);
  if (valorNotaResult.invalid) avisos.push(`Campo "valor_nota" com formato inválido, salvo como vazio.`);

  const pesoFisicoResult = parseFlexibleDecimal(row.peso_fisico as number | string | null | undefined);
  if (pesoFisicoResult.invalid) avisos.push(`Campo "peso_fisico" com formato inválido, salvo como vazio.`);

  const optionalString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  return {
    ok: true,
    data: {
      pedido,
      nomeDestinatario: (row.nome_destinatario as string).trim(),
      canalVendas: canalVendasOrigem,
      cidadeDestinatario: (row.cidade_destinatario as string).trim(),
      uf: (row.uf as string).trim().toUpperCase(),
      cepDestinatario: (row.cep_destinatario as string).trim(),
      pedidoDeVenda: (row.pedido_de_venda as string).trim(),
      codigoRastreio: optionalString(row.codigo_rastreio),
      notaFiscal: optionalString(row.nota_fiscal),
      metodoEnvio: optionalString(row.metodo_envio),
      transportadoraNomeOrigem: (row.transportadora as string).trim(),
      valorNota: valorNotaResult.value,
      pesoFisico: pesoFisicoResult.value,
      chaveNota: optionalString(row.chave_nota),
      dataCriacaoPedido,
      dataEntregaOrigem,
      previsaoEntregaClienteOrigem,
      previsaoEntregaTransportadoraOrigem,
      dataDespacho,
      previsaoEntregaTransportadoraOriginal,
      microStatus: optionalString(row.micro_status),
      statusTransportador: optionalString(row.status_transportador),
      avisos,
    },
  };
}

export interface TransportadoraLookupEntry {
  id: string;
  nome: string;
  codigoSlug: string;
  aliases: string[];
}

/**
 * Resolve o texto de transportadora recebido da Intelipost contra o
 * cadastro, tentando NESTA ORDEM (todas as comparações normalizadas,
 * ignorando caixa/acentos):
 *   1. codigoSlug
 *   2. nome oficial (Transportadora.nome)
 *   3. aliases cadastrados (TransportadoraAlias)
 * Função pura, testável, recebe a lista já carregada do banco (com
 * aliases inclusos).
 */
export function resolveTransportadora(
  nomeOrigem: string,
  transportadoras: TransportadoraLookupEntry[],
): TransportadoraLookupEntry | null {
  const alvo = normalizeForMatch(nomeOrigem);

  const porCodigoSlug = transportadoras.find((t) => normalizeForMatch(t.codigoSlug) === alvo);
  if (porCodigoSlug) return porCodigoSlug;

  const porNome = transportadoras.find((t) => normalizeForMatch(t.nome) === alvo);
  if (porNome) return porNome;

  const porAlias = transportadoras.find((t) => t.aliases.some((alias) => normalizeForMatch(alias) === alvo));
  if (porAlias) return porAlias;

  return null;
}
