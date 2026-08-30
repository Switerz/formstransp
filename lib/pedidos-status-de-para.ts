/**
 * DE/PARA — STATUS ATUAL / OFENSORES GB
 *
 * Porta fiel do STATUS_DE_PARA / getStatusPadrao definidos no HTML oficial
 * (portal_bases_transportadoras_formstransp_V2_controle_integridade.html).
 * Regra equivalente ao Power Query original - NÃO alterar os mapeamentos
 * sem necessidade (conforme instrução explícita).
 */

export const STATUS_DE_PARA: Record<string, string> = {
  // TRANSPORTADORA
  "Encomenda expedido mas não chegou": "Transportadora",
  "AVERIGUAR FALHA NA ENTREGA": "Transportadora",
  "FATORES NATURAIS": "Transportadora",
  "Erro de triagem no SC": "Transportadora",
  "PROBLEMA OPERACIONAL": "Transportadora",
  "NÃO VISITADO": "Transportadora",
  "CARGA RECUSADA PELO DESTINATARIO": "Transportadora",
  "ATRASO TRANSPORTADOR": "Transportadora",
  "GREVE GERAL": "Transportadora",
  "FALHA NA ENTREGA": "Transportadora",
  "AGUARDANDO INSTRUÇÃO": "Transportadora",
  "CARGA RECUSADA PELA TRANSPORTADORA": "Transportadora",
  "CARGA INCOMPLETA": "Transportadora",
  "Acidentes de natureza": "Transportadora",
  "CORRECAO INFORMACAO DE EVENTO": "Transportadora",
  "Pedidos problemáticos na coleta": "Transportadora",
  "SUSPENSÃO DE ENTREGA AO DESTINATÁRIO": "Transportadora",
  "CARGA ERRADA": "Transportadora",
  "Envio errado": "Transportadora",
  "Pedidos problemáticos na entrega": "Transportadora",
  "Imprevisto na entrega": "Transportadora",

  // AUSENTE
  "DESTINATARIO AUSENTE": "Ausente",
  "DESTINATÁRIO AUSENTE": "Ausente",
  "DESTINATÁRIO MUDOU-SE": "Ausente",
  "ESTABELECIMENTO FECHADO": "Ausente",
  "DESTINATÁRIO DESCONHECIDO": "Ausente",

  // EXTRAVIO
  "EXTRAVIO TOTAL": "Extravio",
  "EXTRAVIO CONFIRMADO": "Extravio",
  "Pedido extraviado dentro das bases": "Extravio",
  "ROUBO / FURTO / SINISTRO": "Extravio",
  Perdido: "Extravio",
  "AVARIA CONFIRMADA": "Extravio",
  ROUBO: "Extravio",
  "CLIENTE ALEGA FALTA DE MERCADORIA": "Extravio",
  "AVARIA/EXTRAVIO": "Extravio",

  // DEVOLUÇÃO
  DEVOLVIDO: "Devolução",
  "Insucesso na devolução ao cliente ou PA": "Devolução",
  "Devolução realizada": "Devolução",
  "Carga devolvida ao remetente": "Devolução",

  // CANCELADO
  "BLOQUEADO PELO REMETENTE": "Cancelado",
  CANCELADO: "Cancelado",

  // ENDEREÇO INCORRETO
  "ENDERECO INCORRETO": "End. Incorreto",
  "ENDEREÇO NÃO LOCALIZADO": "End. Incorreto",
  "DESTINATÁRIO NÃO LOCALIZADO": "End. Incorreto",
  "ENDEREÇO INSUFICIENTE": "End. Incorreto",

  // RETIRADA
  "NÃO FOI POSSÍVEL ENTREGAR. AGUARDANDO RETIRADA": "Retirada",
  "CLIENTE DEVERA RETIRAR PEDIDO EM AGENCIA DOS CORREIOS": "Retirada",
  "PACOTE NÃO RETIRADO": "Retirada",

  // RETENÇÃO FISCAL
  "PARADO NA FISCALIZACAO": "Ret. Fiscal",
};

/** Mesma normalização usada em todo o HTML oficial (acento/caixa/espaços). */
export function normHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const STATUS_DE_PARA_NORMALIZADO = new Map(
  Object.entries(STATUS_DE_PARA).map(([origem, destino]) => [normHeader(origem), destino]),
);

/**
 * Classifica um STATUS ATUAL na categoria padronizada de Ofensores GB.
 * Mesma prioridade da regra original: null/vazio/"-" => "Transportadora";
 * valor fora do DE/PARA => null (não é tratado como erro).
 */
export function getStatusPadrao(value: unknown): string | null {
  if (value === null || value === undefined) return "Transportadora";

  const raw = String(value).trim();
  if (raw === "" || raw === "-") return "Transportadora";

  return STATUS_DE_PARA_NORMALIZADO.get(normHeader(raw)) ?? null;
}
