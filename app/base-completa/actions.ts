"use server";

import { prisma } from "@/lib/prisma";
import { requireInternalAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/request-security";
import { startOfLocalDay } from "@/lib/dates";
import { readXlsxTable } from "@/lib/xlsx-table-reader";
import { resolveTransportadora, type TransportadoraLookupEntry } from "@/lib/pedidos-parsing";
import {
  normalizarColunasLinha,
  processarLinhaDevolucao,
  type PedidoAtualDevolucao,
  type ResultadoLinha,
} from "@/lib/pedidos-devolucao-processar";
import { PROTECTED_COLUMNS } from "@/lib/pedidos-devolucao-validation";
import type { DevolucaoResumo } from "@/app/portal/minha-base/actions";

// ---------------------------------------------------------------------------
// A) BASE ORIGINAL - só existe aqui (acesso interno). Não existe em nenhum
// outro lugar do projeto: a base de origem sempre foi 100% automática via
// Intelipost (POST /api/jobs/import-pedidos -> lib/pedidos.ts, não tocado).
// Esta action é um caminho MANUAL adicional, exclusivo de internal_admin,
// para os mesmos 14 campos de origem - nunca mexe em campo operacional.
// ---------------------------------------------------------------------------

export interface BaseOriginalResumo {
  totalLinhas: number;
  inseridos: number;
  atualizados: number;
  erros: Array<{ linha: number; pedido: string; motivo: string }>;
}

const CANONICAL_TO_ORIGEM_FIELD: Record<string, string> = {
  "Nome do Destinatário": "nomeDestinatario",
  "Canal de Vendas": "canalVendas",
  "Cidade do Destinatário": "cidadeDestinatario",
  UF: "uf",
  "CEP do destinatário": "cepDestinatario",
  "Pedido de Venda": "pedidoDeVenda",
  "Código de rastreio": "codigoRastreio",
  "Nota Fiscal": "notaFiscal",
  "Método de envio": "metodoEnvio",
  "Valor da Nota": "valorNota",
  "Peso fisico": "pesoFisico",
  "Chave da Nota": "chaveNota",
};

function textoOuNull(value: unknown): string | null {
  const texto = String(value ?? "").trim();
  return texto === "" ? null : texto;
}

function decimalOuNull(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const numero = Number(String(value).replace(",", "."));
  return Number.isNaN(numero) ? null : numero;
}

/**
 * Upload manual da Base Original - exclusivo de internal_admin
 * (requireInternalAdmin, verificado no servidor - nunca no frontend).
 * Mesma semântica de upsert do job automático da Intelipost (atualiza
 * SOMENTE os 14 campos de origem; nunca toca em campo operacional
 * preenchido pela transportadora; chave única é "Pedido"), mas por
 * arquivo em vez de payload JSON da API. lib/pedidos.ts e a rota
 * /api/jobs/import-pedidos não foram alterados nem chamados por aqui -
 * fluxo deliberadamente separado para não arriscar o caminho automático
 * já homologado.
 */
export async function uploadBaseOriginalInterna(formData: FormData): Promise<BaseOriginalResumo> {
  await assertSameOrigin();
  await requireInternalAdmin("/base-completa");

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo .xlsx preenchido antes de enviar.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows } = await readXlsxTable(buffer);

  const transportadorasRaw = await prisma.transportadora.findMany({
    select: { id: true, nome: true, codigoSlug: true, aliases: { select: { alias: true } } },
  });
  const transportadoras: TransportadoraLookupEntry[] = transportadorasRaw.map((t: (typeof transportadorasRaw)[number]) => ({
    id: t.id,
    nome: t.nome,
    codigoSlug: t.codigoSlug,
    aliases: t.aliases.map((a: { alias: string }) => a.alias),
  }));

  const resumo: BaseOriginalResumo = { totalLinhas: rows.length, inseridos: 0, atualizados: 0, erros: [] };

  for (let index = 0; index < rows.length; index += 1) {
    const linha = index + 2; // linha 1 = cabeçalho
    const normalizado = normalizarColunasLinha(rows[index]);
    const pedidoChave = String(normalizado["Pedido"] ?? "").trim();

    if (!pedidoChave) {
      resumo.erros.push({ linha, pedido: "", motivo: "Coluna Pedido ausente ou vazia." });
      continue;
    }

    const nomeTransportadora = String(normalizado["Transportadora"] ?? "").trim();
    const transportadora = nomeTransportadora ? resolveTransportadora(nomeTransportadora, transportadoras) : null;
    if (!transportadora) {
      resumo.erros.push({
        linha,
        pedido: pedidoChave,
        motivo: `Transportadora "${nomeTransportadora}" não encontrada no cadastro (nome/código/alias).`,
      });
      continue;
    }

    const origemFields: Record<string, unknown> = { transportadoraId: transportadora.id, origemAtualizadoEm: new Date() };
    for (const coluna of PROTECTED_COLUMNS) {
      const campoPrisma = CANONICAL_TO_ORIGEM_FIELD[coluna];
      if (!campoPrisma || !(coluna in normalizado)) continue;
      const valor = normalizado[coluna];
      origemFields[campoPrisma] = coluna === "Valor da Nota" || coluna === "Peso fisico" ? decimalOuNull(valor) : textoOuNull(valor);
    }

    try {
      const existente = await prisma.pedido.findUnique({ where: { pedido: pedidoChave }, select: { id: true } });
      if (existente) {
        // Atualização: NUNCA mexe em dataCriacaoPedido nem em campo
        // operacional - só os campos de origem presentes na planilha.
        await prisma.pedido.update({ where: { pedido: pedidoChave }, data: origemFields });
        resumo.atualizados += 1;
      } else {
        // Pedido novo por este caminho manual: dataCriacaoPedido não faz
        // parte do layout de 25 colunas da Base Original, então usa a data
        // do upload (mesma convenção seria necessária em qualquer upload
        // manual sem esse campo - documentado aqui, não inventado em
        // silêncio).
        await prisma.pedido.create({
          data: { pedido: pedidoChave, dataCriacaoPedido: startOfLocalDay(new Date()), ...origemFields } as never,
        });
        resumo.inseridos += 1;
      }
    } catch (err) {
      resumo.erros.push({ linha, pedido: pedidoChave, motivo: err instanceof Error ? err.message : "Falha ao gravar." });
    }
  }

  await prisma.automationLog.create({
    data: {
      transportadoraId: null,
      dataReport: startOfLocalDay(new Date()),
      // tipo próprio (não "pedidos_import"): esta é uma carga MANUAL pelo
      // admin, não o job automático da Intelipost - mantidas
      // distinguíveis de propósito, inclusive para o indicador "Base
      // atualizada há X horas" (que só considera tipo="pedidos_import").
      tipo: "pedidos_base_original_manual",
      status: resumo.erros.length > 0 ? "error" : "success",
      mensagem: `Base original (upload manual interno): ${resumo.totalLinhas} linha(s), ${resumo.inseridos} inserida(s), ${resumo.atualizados} atualizada(s), ${resumo.erros.length} erro(s).`,
      payload: JSON.stringify(resumo),
    },
  });

  return resumo;
}

// ---------------------------------------------------------------------------
// B) DEVOLUÇÃO EM NOME DE UMA TRANSPORTADORA ESCOLHIDA (acesso interno) -
// reaproveita o MESMO núcleo puro de app/portal/minha-base/actions.ts
// (processarLinhaDevolucao/normalizarColunasLinha), só troca COMO a
// transportadora é determinada: em vez de user.transportadoraId (sessão),
// vem de um campo do formulário, validado contra o cadastro real e
// protegido por requireInternalAdmin. app/portal/minha-base/actions.ts
// NÃO foi alterado - a transportadora continua isolada por
// requireCarrierUser exatamente como antes.
// ---------------------------------------------------------------------------

export async function uploadDevolucaoInterna(formData: FormData): Promise<DevolucaoResumo> {
  await assertSameOrigin();
  const user = await requireInternalAdmin("/base-completa");

  const transportadoraId = String(formData.get("transportadoraId") ?? "").trim();
  if (!transportadoraId) {
    throw new Error("Selecione a transportadora à qual esta devolução pertence.");
  }
  const transportadoraAlvo = await prisma.transportadora.findUnique({ where: { id: transportadoraId } });
  if (!transportadoraAlvo) {
    throw new Error("Transportadora selecionada não encontrada.");
  }

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo .xlsx preenchido antes de enviar.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows } = await readXlsxTable(buffer);

  const resumo: DevolucaoResumo = {
    totalLinhas: rows.length,
    aplicados: 0,
    semAlteracao: 0,
    erros: 0,
    pedidosNaoEncontrados: 0,
    pedidosDeOutraTransportadora: 0,
    detalhes: [],
  };

  for (let index = 0; index < rows.length; index += 1) {
    const linha = index + 2;
    const normalizado = normalizarColunasLinha(rows[index]);
    const pedidoChave = String(normalizado["Pedido"] ?? "").trim();

    if (!pedidoChave) {
      resumo.erros += 1;
      resumo.detalhes.push(linhaVazia(linha, "", "erro_validacao", "Coluna Pedido ausente ou vazia."));
      continue;
    }

    const pedidoDb = await prisma.pedido.findUnique({
      where: { pedido: pedidoChave },
      include: { transportadora: { select: { nome: true } } },
    });

    if (!pedidoDb) {
      resumo.pedidosNaoEncontrados += 1;
      resumo.detalhes.push(linhaVazia(linha, pedidoChave, "pedido_nao_encontrado"));
      continue;
    }

    // Mesma checagem de pertencimento da action da transportadora - aqui a
    // transportadora "alvo" é a escolhida pelo admin no formulário, não a
    // da sessão, mas a regra de rejeitar pedido de outra transportadora é
    // idêntica.
    if (pedidoDb.transportadoraId !== transportadoraId) {
      resumo.pedidosDeOutraTransportadora += 1;
      resumo.detalhes.push(linhaVazia(linha, pedidoChave, "pedido_de_outra_transportadora"));
      continue;
    }

    const pedidoAtual: PedidoAtualDevolucao = {
      id: pedidoDb.id,
      pedido: pedidoDb.pedido,
      transportadoraId: pedidoDb.transportadoraId,
      protegidosAtuais: {
        "Nome do Destinatário": pedidoDb.nomeDestinatario,
        "Canal de Vendas": pedidoDb.canalVendas,
        "Cidade do Destinatário": pedidoDb.cidadeDestinatario,
        UF: pedidoDb.uf,
        "CEP do destinatário": pedidoDb.cepDestinatario,
        "Pedido de Venda": pedidoDb.pedidoDeVenda,
        Pedido: pedidoDb.pedido,
        "Código de rastreio": pedidoDb.codigoRastreio,
        "Nota Fiscal": pedidoDb.notaFiscal,
        "Método de envio": pedidoDb.metodoEnvio,
        Transportadora: pedidoDb.transportadora.nome,
        "Valor da Nota": pedidoDb.valorNota,
        "Peso fisico": pedidoDb.pesoFisico,
        "Chave da Nota": pedidoDb.chaveNota,
      },
      dataColetaProcessamento: pedidoDb.dataColetaProcessamento,
      dataPrevisao: pedidoDb.dataPrevisao,
      prazoEntregaDiasUteis: pedidoDb.prazoEntregaDiasUteis,
      dataEntrega: pedidoDb.dataEntrega,
      statusAtual: pedidoDb.statusAtual,
      ocorrencia: pedidoDb.ocorrencia,
      motivoDevolucao: pedidoDb.motivoDevolucao,
      slaStatus: pedidoDb.slaStatus,
      justificativaAtraso: pedidoDb.justificativaAtraso,
      novaDataPrevisao: pedidoDb.novaDataPrevisao,
      dataResolucaoDevolucao: pedidoDb.dataResolucaoDevolucao,
    };

    const resultado = processarLinhaDevolucao(rows[index], pedidoAtual, linha);
    resumo.detalhes.push(resultado);

    if (resultado.status === "erro_validacao") resumo.erros += 1;
    else if (resultado.status === "sem_alteracao") resumo.semAlteracao += 1;
    else resumo.aplicados += 1;

    const tentativas = [
      ...resultado.violacoesProtegidas.map((v) => ({ ...v, tipo: "campo_protegido" as const })),
      ...resultado.tentativasBloqueadas.map((v) => ({ ...v, tipo: "campo_ja_respondido" as const })),
    ];
    for (const tentativa of tentativas) {
      await prisma.pedidoFieldChangeAttempt.create({
        data: {
          pedidoId: pedidoDb.id,
          transportadoraId,
          userId: user.id,
          campo: tentativa.campo,
          valorAtual: tentativa.antes === null || tentativa.antes === undefined ? null : String(tentativa.antes),
          valorTentado: tentativa.depois === null || tentativa.depois === undefined ? null : String(tentativa.depois),
          status: "blocked",
        },
      });
    }

    if (Object.keys(resultado.updateData).length > 0) {
      await prisma.pedido.update({
        where: { id: pedidoDb.id },
        data: { ...resultado.updateData, operacionalAtualizadoEm: new Date() },
      });
    }
  }

  await prisma.automationLog.create({
    data: {
      transportadoraId,
      dataReport: startOfLocalDay(new Date()),
      tipo: "pedidos_devolucao",
      status: resumo.erros > 0 || resumo.pedidosNaoEncontrados > 0 || resumo.pedidosDeOutraTransportadora > 0 ? "error" : "success",
      mensagem: `Devolução de ${transportadoraAlvo.nome} (enviada por admin interno ${user.username ?? user.id}): ${resumo.totalLinhas} linha(s), ${resumo.aplicados} aplicada(s), ${resumo.semAlteracao} sem alteração, ${resumo.erros} erro(s), ${resumo.pedidosNaoEncontrados} não encontrado(s), ${resumo.pedidosDeOutraTransportadora} de outra transportadora.`,
      payload: JSON.stringify(resumo),
    },
  });

  return resumo;
}

function linhaVazia(linha: number, pedido: string, status: ResultadoLinha["status"], mensagem?: string): ResultadoLinha {
  return {
    linha,
    pedido,
    status,
    errosValidacao: mensagem ? [{ linha, coluna: "Pedido", valor: pedido, mensagem }] : [],
    violacoesProtegidas: [],
    tentativasBloqueadas: [],
    alteracoesAplicadas: [],
    updateData: {},
  };
}
