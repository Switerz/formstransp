export type MacroStatus =
  | "N\u00E3o Processado"
  | "Em Tr\u00E2nsito"
  | "Tratativa CX"
  | "Saiu Para Entrega"
  | "Entregue"
  | "Retirada Correios"
  | "Devolu\u00E7\u00E3o"
  | "Devolvido"
  | "Extravio/Sinistro/Avaria";

function normalizar(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const GOBEAUTE_MICRO_NAO_PROCESSADO = new Set([
  "PRONTO PARA DESPACHO",
  "FALHA AO CRIAR PEDIDO COM A TRANSPORTADORA",
  "ETIQUETA CRIADA",
  "OPERACAO CANCELADA",
  "DESPACHO",
]);

const MICRO_NAO_PROCESSADO = new Set([
  "ARQUIVO RECEBIDO",
  "DESPACHADO",
  "CRIADO",
]);

const TRATATIVA_DIRETA = new Set([
  "AGUARDANDO INSTRUCAO",
  "DESTINATARIO DESCONHECIDO",
  "DESTINATARIO MUDOU-SE",
  "DESTINATARIO NAO LOCALIZADO",
  "ENDERECO INCORRETO",
  "ENDERECO INSUFICIENTE",
  "ENDERECO NAO LOCALIZADO",
  "CARGA RECUSADA PELO DESTINATARIO",
]);

const SAIU_PARA_ENTREGA = new Set([
  "EM ROTA DE ENTREGA",
  "SAIU PARA ENTREGA",
  "REMESSA EM ROTA DE ENTREGA.",
  "REMESSA EM ROTA DE ENTREGA",
]);

const RETIRADA_CORREIOS = new Set([
  "NAO FOI POSSIVEL ENTREGAR. AGUARDANDO RETIRADA.",
  "NAO FOI POSSIVEL ENTREGAR. AGUARDANDO RETIRADA",
]);

const PERDAS = new Set([
  "AVARIA CONFIRMADA",
  "SINISTRO CONFIRMADO",
  "EXTRAVIO CONFIRMADO",
]);

const DEVOLUCAO_EM_ANDAMENTO = new Set([
  "EM DEVOLUCAO",
  "INSUCESSO NA DEVOLUCAO AO CLIENTE OU PA",
]);

const DEVOLVIDO = new Set([
  "DEVOLUCAO REALIZADA",
  "DEVOLVIDO",
]);

export interface ClassificarMacroStatusInput {
  microStatus?: string | null;
  statusTransportador?: string | null;
  quantidadeOcorrencias?: number | null;
  ehGocase?: boolean;
}

export function classificarMacroStatus({
  microStatus,
  statusTransportador,
  quantidadeOcorrencias,
  ehGocase = true,
}: ClassificarMacroStatusInput): MacroStatus {
  const micro = normalizar(microStatus);
  const statusT = normalizar(statusTransportador);
  const ocorrencias = quantidadeOcorrencias ?? 0;

  // Prioridades do BI original.
  if (statusT === "ENTREGUE") {
    return "Entregue";
  }

  if (statusT === "DEVOLVIDO") {
    return "Devolvido";
  }

  if (statusT === "EM DEVOLUCAO") {
    return "Devolu\u00E7\u00E3o";
  }

  if (DEVOLVIDO.has(micro)) {
    return "Devolvido";
  }

  if (DEVOLUCAO_EM_ANDAMENTO.has(micro)) {
    return "Devolu\u00E7\u00E3o";
  }

  if (RETIRADA_CORREIOS.has(micro)) {
    return "Retirada Correios";
  }

  if (PERDAS.has(micro)) {
    return "Extravio/Sinistro/Avaria";
  }

  if (SAIU_PARA_ENTREGA.has(micro)) {
    return "Saiu Para Entrega";
  }

  if (MICRO_NAO_PROCESSADO.has(micro)) {
    return "N\u00E3o Processado";
  }

  // Regra adicional da GoBeaut?.
  if (!ehGocase && GOBEAUTE_MICRO_NAO_PROCESSADO.has(micro)) {
    return "N\u00E3o Processado";
  }

  /*
   * EM TRANSITO ainda ? considerado N?o Processado quando a
   * transportadora s? registrou Criado/Despachado.
   */
  if (
    micro === "EM TRANSITO" &&
    (statusT === "CRIADO" || statusT === "DESPACHADO")
  ) {
    return "N\u00E3o Processado";
  }

  /*
   * Ausente / estabelecimento fechado:
   * menos de 3 tentativas = Em Tr?nsito;
   * 3 ou mais = Tratativa CX.
   */
  if (
    micro === "DESTINATARIO AUSENTE" ||
    micro === "ESTABELECIMENTO FECHADO"
  ) {
    return ocorrencias >= 3 ? "Tratativa CX" : "Em Tr\u00E2nsito";
  }

  if (TRATATIVA_DIRETA.has(micro)) {
    return "Tratativa CX";
  }

  if (micro === "ENTREGUE" || micro === "ENTREGUE NO DESTINO.") {
    return "Entregue";
  }

  // Demais status operacionais seguem em tr?nsito.
  return "Em Tr\u00E2nsito";
}


export type MacroInsucesso =
  | "Cliente Ausente"
  | "N\u00E3o Visitado"
  | "Problemas De Endere\u00E7o"
  | "Destinat\u00E1rio Desconhecido"
  | "Destinat\u00E1rio Mudou-se"
  | "Estabelecimento Fechado"
  | "Carga Recusada Pelo Destinat\u00E1rio"
  | "Bloqueio De Entrega Pelo Remetente"
  | "Retirada Correios"
  | "Fatores Naturais";

export function classificarMacroInsucesso(
  ocorrencia: string | null | undefined,
): MacroInsucesso | null {
  const valor = normalizar(ocorrencia).replace(/\.+$/, "");

  if (
    [
      "DESTINATARIO AUSENTE",
      "DESTINATARIO NAO LOCALIZADO",
    ].includes(valor)
  ) {
    return "Cliente Ausente";
  }

  if (valor === "NAO VISITADO") {
    return "N\u00E3o Visitado";
  }

  if (
    [
      "ENDERECO INCORRETO",
      "ENDERECO INSUFICIENTE",
      "ENDERECO NAO LOCALIZADO",
    ].includes(valor)
  ) {
    return "Problemas De Endere\u00E7o";
  }

  if (valor === "DESTINATARIO DESCONHECIDO") {
    return "Destinat\u00E1rio Desconhecido";
  }

  if (valor === "DESTINATARIO MUDOU-SE") {
    return "Destinat\u00E1rio Mudou-se";
  }

  if (valor === "ESTABELECIMENTO FECHADO") {
    return "Estabelecimento Fechado";
  }

  if (valor === "CARGA RECUSADA PELO DESTINATARIO") {
    return "Carga Recusada Pelo Destinat\u00E1rio";
  }

  if (
    valor === "BLOQUEADO PELO REMETENTE" ||
    valor === "ENTREGA BARRADA" ||
    valor === "BLOQUEADO PELO REMETENTE/ENTREGA BARRADA"
  ) {
    return "Bloqueio De Entrega Pelo Remetente";
  }

  if (
    valor === "NAO FOI POSSIVEL ENTREGAR. AGUARDANDO RETIRADA." ||
    valor === "NAO FOI POSSIVEL ENTREGAR. AGUARDANDO RETIRADA"
  ) {
    return "Retirada Correios";
  }

  if (
    valor === "ACIDENTES DE NATUREZA" ||
    valor === "FATORES NATURAIS"
  ) {
    return "Fatores Naturais";
  }

  return null;
}
