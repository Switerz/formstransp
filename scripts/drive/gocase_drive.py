# ============================================================
# FORMS TRANSP - SUBIR BASE D-1
# NÃƒO consulta a Intelipost. Usa arquivo local jÃ¡ coletado.
# ============================================================
# ============================================================
# FORMS TRANSP
# Coleta via RELATÃ“RIO COMPLETO da Intelipost
#
# Objetivo:
# - evitar milhares de chamadas paginadas no GraphQL de pedidos;
# - solicitar o relatÃ³rio XLSX nativo da Intelipost;
# - baixar o arquivo quando ficar pronto;
# - mapear somente as colunas do layout oficial do Forms Transp;
# - manter as duas abas DE/PARA da "Base PadrÃ£o.xlsx";
# - deixar os campos operacionais em branco;
# - proteger no Excel os campos de origem e as abas DE/PARA.
#
# MODO DE TESTE:
# - 1 dia (D-1)
# - mÃ¡ximo 50 registros no arquivo final
#
# Quando validarmos:
#   MODO_TESTE = False
#   DIAS_BASE_COMPLETA = 45
# ============================================================

from __future__ import annotations

import io
import os
import time
import unicodedata
from copy import copy
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv
from openpyxl import load_workbook
from openpyxl.styles import Protection


# ============================================================
# CONFIGURAÃ‡Ã•ES
# ============================================================

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

GRAPHQL_URL = "https://graphql.intelipost.com.br/"
API_BASE = "https://api.intelipost.com.br/api/v1"

USUARIO = os.getenv("USUARIO")
SENHA = os.getenv("SENHA")


PASTA = Path(__file__).resolve().parent

ARQUIVO_MODELO = Path(
    os.getenv(
        "FORMS_TRANSP_TEMPLATE",
        str(PASTA / "Base PadrÃ£o.xlsx"),
    )
)

ARQUIVO_OPERACIONAL = PASTA / "pedidos_forms_transp.xlsx"
ARQUIVO_COMPLETO = PASTA / "pedidos_forms_transp_todos.xlsx"

# Durante a validaÃ§Ã£o, mantÃ©m a carga pequena.
MODO_TESTE = False
DIAS_BASE_TESTE = 1
MAX_REGISTROS_TESTE = 500

# Quando MODO_TESTE = False, esta serÃ¡ a janela.
DIAS_BASE_COMPLETA = 45

# Performance para carga grande
GERAR_XLSX_LOCAL = True
# 500 mantÃ©m cada transaÃ§Ã£o abaixo do limite do backend com mais folga.
# Pode ser sobrescrito no .env sem editar novamente o cÃ³digo.
TAMANHO_LOTE_BACKEND = int(os.getenv("TAMANHO_LOTE_BACKEND", "500"))
TIMEOUT_BACKEND_SEGUNDOS = int(os.getenv("TIMEOUT_BACKEND_SEGUNDOS", "300"))
MAX_TENTATIVAS_BACKEND = int(os.getenv("MAX_TENTATIVAS_BACKEND", "8"))

# Polling do relatÃ³rio assÃ­ncrono.
INTERVALO_POLL_SEGUNDOS = 10
TIMEOUT_RELATORIO_SEGUNDOS = 60 * 30

# ------------------------------------------------------------
# Envio para o backend Forms Transp (Fase 2 - upsert jÃ¡ homologado)
# ------------------------------------------------------------
# Desliga sem tocar no resto do script, se precisar rodar sÃ³ a
# geraÃ§Ã£o local dos XLSX de novo.
ENVIAR_PARA_BACKEND = True

FORMS_TRANSP_API_URL = os.getenv("FORMS_TRANSP_API_URL")
PEDIDOS_IMPORT_SECRET = os.getenv("PEDIDOS_IMPORT_SECRET")

if ENVIAR_PARA_BACKEND and not FORMS_TRANSP_API_URL:
    raise RuntimeError(
        "ENVIAR_PARA_BACKEND=True mas FORMS_TRANSP_API_URL nÃ£o estÃ¡ "
        "definido no .env. Ex.: FORMS_TRANSP_API_URL=https://formstransp.vercel.app/api/jobs/import-pedidos"
    )

if ENVIAR_PARA_BACKEND and not PEDIDOS_IMPORT_SECRET:
    raise RuntimeError(
        "ENVIAR_PARA_BACKEND=True mas PEDIDOS_IMPORT_SECRET nÃ£o estÃ¡ "
        "definido no .env (precisa ser o mesmo valor configurado no backend)."
    )

# Senha de proteÃ§Ã£o do XLSX.
# Ã‰ apenas uma barreira preventiva; seguranÃ§a real deve ficar no backend.
SENHA_PROTECAO_XLSX = os.getenv(
    "FORMS_TRANSP_XLSX_PASSWORD",
    "forms-transp"
)


# ============================================================
# LAYOUT OFICIAL
# ============================================================

COLUNAS_BASE = [
    "Nome do DestinatÃ¡rio",
    "Canal de Vendas",
    "Cidade do DestinatÃ¡rio",
    "UF",
    "CEP do destinatÃ¡rio",
    "Pedido de Venda",
    "Pedido",
    "CÃ³digo de rastreio",
    "Nota Fiscal",
    "MÃ©todo de envio",
    "Transportadora",
    "Valor da Nota",
    "Peso fisico",
    "Chave da Nota",
    "DATA COLETA/PROCESSAMENTO",
    "DATA DE PREVISÃƒO",
    "PRAZO DE ENTREGA (DIAS ÃšTEIS)",
    "DATA DE ENTREGA",
    "STATUS ATUAL",
    "OCORRÃŠNCIA",
    "MOTIVO DEVOLUÃ‡ÃƒO",
    "SLA (NO PRAZO/ATRASADO)",
    "JUSTIFICATIVA DE ATRASO",
    "NOVA DATA DE PREVISÃƒO (SE ATRASADO)",
    "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÃ‡ÃƒO",
]

# Da primeira coluna atÃ© Chave da Nota = origem / bloqueado.
QTDE_COLUNAS_ORIGEM = 14

# O restante Ã© operacional e deve iniciar vazio.
COLUNAS_OPERACIONAIS = COLUNAS_BASE[QTDE_COLUNAS_ORIGEM:]


# ============================================================
# MAPEAMENTO DO RELATÃ“RIO INTELIPOST
#
# Colocamos aliases porque o nome exato pode variar entre versÃµes
# do export. O script procura o primeiro nome existente.
# ============================================================

ALIASES = {
    "Nome do DestinatÃ¡rio": [
        "Nome do DestinatÃ¡rio",
        "DestinatÃ¡rio",
        "Nome DestinatÃ¡rio",
        "Nome do Cliente",
        "Cliente",
    ],
    "Canal de Vendas": [
        "Canal de Vendas",
        "Canal Venda",
        "Sales Channel",
        "Canal",
    ],
    "Cidade do DestinatÃ¡rio": [
        "Cidade do DestinatÃ¡rio",
        "Cidade Destino",
        "Cidade de Destino",
        "Cidade Cliente",
    ],
    "UF": [
        "UF",
        "UF Destino",
        "UF de Destino",
        "Estado Destino",
    ],
    "CEP do destinatÃ¡rio": [
        "CEP do destinatÃ¡rio",
        "CEP DestinatÃ¡rio",
        "CEP Destino",
        "CEP de Destino",
        "CEP",
    ],
    "Pedido de Venda": [
        "Pedido de Venda",
        "Pedido Venda",
        "Pedido Externo",
        "Pedido Marketplace",
        "External Order Number",
    ],
    "Pedido": [
        "Pedido",
        "NÃºmero do Pedido",
        "Numero do Pedido",
        "Order Number",
    ],
    "CÃ³digo de rastreio": [
        "CÃ³digo de rastreio",
        "CÃ³digo de Rastreio",
        "Codigo de Rastreio",
        "Tracking Code",
        "Rastreio",
    ],
    "Nota Fiscal": [
        "Nota Fiscal",
        "NÃºmero Nota Fiscal",
        "Numero Nota Fiscal",
        "NF",
        "Invoice Number",
    ],
    "MÃ©todo de envio": [
        "MÃ©todo de envio",
        "MÃ©todo de Envio",
        "Metodo de Envio",
        "MÃ©todo Entrega",
        "Delivery Method",
    ],
    "Transportadora": [
        "Transportadora",
        "Nome Transportadora",
        "Logistic Provider",
    ],
    "Valor da Nota": [
        "Valor da Nota",
        "Valor Nota",
        "Valor NF",
        "Valor da NF",
        "Invoice Value",
        "Valor Nota Fiscal",
    ],
    "Peso fisico": [
        "Peso fisico",
        "Peso fÃ­sico",
        "Peso FÃ­sico",
        "Peso",
        "Peso Real",
        "Weight",
    ],
    "Chave da Nota": [
        "Chave da Nota",
        "Chave Nota",
        "Chave NF",
        "Chave da NF",
        "Chave NFe",
        "Chave NFe/NF-e",
        "Invoice Key",
    ],
}

# Campos auxiliares SOMENTE para decidir se um pedido deve
# sair da visÃ£o operacional da transportadora.
ALIASES_DATA_ENTREGA = [
    "Data de Entrega",
    "Data Entrega",
    "Data Entregue",
    "Delivered Date",
]

# Campo auxiliar exigido pelo payload do backend (data_criacao), mas que
# nÃ£o faz parte das 14 colunas de origem do layout Forms Transp em si -
# por isso fica fora de ALIASES/COLUNAS_BASE, do mesmo jeito que
# ALIASES_DATA_ENTREGA jÃ¡ era tratado.
ALIASES_DATA_CRIACAO = [
    "Data CriaÃ§Ã£o",
    "Data de CriaÃ§Ã£o",
    "Data Criacao",
    "Data de Criacao",
    "Data do Pedido",
    "Created At",
    "Order Created At",
    "Creation Date",
]


# Campos adicionais de origem Intelipost.
# Sao protegidos: a carga atualiza estes valores, mas nunca os
# campos operacionais preenchidos pela transportadora.

ALIASES_PREVISAO_ENTREGA_CLIENTE = [
    "Previs?o Entrega Cliente",
    "Previsao Entrega Cliente",
]

ALIASES_PREVISAO_ENTREGA_TRANSPORTADORA = [
    "Previs?o Entrega Transp.",
    "Previsao Entrega Transp.",
    "Previs?o Entrega Transportadora",
    "Previsao Entrega Transportadora",
]

ALIASES_DATA_DESPACHO = [
    "Data Despacho",
    "Data de Despacho",
]

ALIASES_PREVISAO_ENTREGA_TRANSPORTADORA_ORIGINAL = [
    "Previs?o Entrega Transp. Original",
    "Previsao Entrega Transp. Original",
    "Previs?o Entrega Transportadora Original",
    "Previsao Entrega Transportadora Original",
]

ALIASES_MICRO_STATUS = [
    "MicroStatus",
    "Micro Status",
    "Microstatus",
]

ALIASES_STATUS_TRANSPORTADOR = [
    "Status Transportador",
]

ALIASES_QUANTIDADE_OCORRENCIAS = [
    "Quantidade de Ocorr?ncias",
    "Quantidade de Ocorrencias",
]

ALIASES_ULTIMA_OCORRENCIA_MICRO = [
    "\u00daltima Ocorr\u00eancia (Micro)",
    "Ultima Ocorrencia (Micro)",
]

ALIASES_STATUS = [
    "Status Atual",
    "Status",
    "Status Pedido",
    "Macro Status",
    "Status da Entrega",
]

STATUS_FINALIZADOS = {
    "ENTREGUE",
    "DELIVERED",
    "FINALIZADO",
    "FINALIZED",
    "CANCELADO",
    "CANCELED",
    "CANCELLED",
    "DEVOLVIDO",
    "RETURNED",
}


# ============================================================
# LOGIN
# ============================================================

LOGIN_QUERY = """
query ($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    user {
      access_token
    }
  }
}
"""


def log(msg=""):
    print(msg, flush=True)


def login() -> str:
    log("Autenticando na Intelipost...")

    resposta = requests.post(
        GRAPHQL_URL,
        json={
            "query": LOGIN_QUERY,
            "variables": {
                "email": USUARIO,
                "password": SENHA,
            },
        },
        timeout=60,
    )

    resposta.raise_for_status()
    dados = resposta.json()

    if dados.get("errors"):
        raise RuntimeError(
            f"Erro no login Intelipost: {dados['errors']}"
        )

    token = (
        (dados.get("data") or {})
        .get("login", {})
        .get("user", {})
        .get("access_token")
    )

    if not token:
        raise RuntimeError(
            "A Intelipost nÃ£o retornou access_token."
        )

    log("Login realizado com sucesso.")
    return token


# ============================================================
# JANELA
# ============================================================

def janela_execucao() -> tuple[date, date]:
    # Usa D-1 porque esse endpoint de relatÃ³rio jÃ¡ era usado assim
    # no processo existente.
    fim = date.today() - timedelta(days=1)

    if MODO_TESTE:
        dias = DIAS_BASE_TESTE
    else:
        dias = DIAS_BASE_COMPLETA

    inicio = fim - timedelta(days=dias - 1)

    return inicio, fim


def nome_relatorio(inicio: date, fim: date) -> str:
    return (
        f"transactions_"
        f"{inicio:%Y-%m-%d}_"
        f"{fim:%Y-%m-%d}.xlsx"
    )


# ============================================================
# RELATÃ“RIO INTELIPOST
# ============================================================

def solicitar_relatorio(
    token: str,
    inicio: date,
    fim: date,
) -> None:
    headers = {
        "Authorization": f"Bearer {token}",
        "content-type": "application/json",
    }

    corpo = {
        "config": {
            "sort_field": "order_number",
            "sort_direction": "ascending",
            "start_date": inicio.isoformat(),
            "end_date": fim.isoformat(),

            # Estes valores sÃ£o os usados pelo cÃ³digo de produÃ§Ã£o
            # que jÃ¡ baixa a tabela completa da Intelipost.
            "rows_per_page": 20,
            "requested_page": 1,
            "shipment_table_state": None,
            "cep_state": None,
            "logistic_provider_id": None,
            "delivery_method_id": None,
            "to_be_delivered": None,
            "view_type": "LOGISTIC_PROVIDER",
            "volume_state": None,
            "scheduled": None,
            "search_by": None,
            "search_value": None,
            "total_per_client": None,
            "table_status": None,
        }
    }

    log(
        f"Solicitando relatÃ³rio Intelipost "
        f"de {inicio:%d/%m/%Y} a {fim:%d/%m/%Y}..."
    )

    resposta = requests.post(
        f"{API_BASE}/shipment_table/excel/",
        json=corpo,
        headers=headers,
        timeout=60,
    )

    if resposta.status_code == 401:
        raise RuntimeError(
            "Token expirado/invÃ¡lido ao solicitar relatÃ³rio."
        )

    resposta.raise_for_status()

    log("RelatÃ³rio solicitado. Aguardando processamento...")


def listar_downloads(token: str) -> list[dict]:
    resposta = requests.get(
        f"{API_BASE}/client/my_downloads/transactions/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        timeout=60,
    )

    resposta.raise_for_status()

    return (
        (resposta.json().get("content") or {})
        .get("result")
        or []
    )


def aguardar_relatorio(
    token: str,
    inicio: date,
    fim: date,
) -> str:
    esperado = nome_relatorio(inicio, fim)

    inicio_espera = time.time()
    tentativas = 0

    while (
        time.time() - inicio_espera
        < TIMEOUT_RELATORIO_SEGUNDOS
    ):
        tentativas += 1

        downloads = listar_downloads(token)

        arquivo = next(
            (
                item
                for item in downloads
                if item.get("file_name") == esperado
            ),
            None,
        )

        if (
            arquivo
            and arquivo.get("ready_for_download")
            and arquivo.get("url")
        ):
            log(
                f"RelatÃ³rio pronto apÃ³s "
                f"{tentativas} consulta(s) de status."
            )
            return arquivo["url"]

        log(
            f"RelatÃ³rio ainda processando "
            f"(consulta {tentativas})."
        )

        time.sleep(INTERVALO_POLL_SEGUNDOS)

    raise TimeoutError(
        f"O relatÃ³rio {esperado} nÃ£o ficou pronto "
        f"dentro do tempo limite."
    )


def baixar_relatorio(url: str) -> bytes:
    log("Baixando XLSX gerado pela Intelipost...")

    resposta = requests.get(
        url,
        timeout=180,
    )

    resposta.raise_for_status()

    log(
        f"Download concluÃ­do: "
        f"{len(resposta.content):,} bytes."
    )

    return resposta.content


# ============================================================
# LEITURA / NORMALIZAÃ‡ÃƒO
# ============================================================

def normalizar_texto(valor) -> str:
    if valor is None:
        return ""

    texto = str(valor).strip()

    if texto.lower() in {
        "nan",
        "nat",
        "none",
    }:
        return ""

    return texto



def normalizar_chave_nota(valor) -> str:
    """Preserva NF-e como texto e impede publicação de chave já corrompida."""
    texto = normalizar_texto(valor)
    if not texto or texto.lower() in {"nan", "none"}:
        return ""
    texto = texto.strip().replace(" ", "")
    # Uma chave NF-e válida possui 44 dígitos. Não tentamos reconstruir
    # notação científica: nesse ponto os dígitos podem já ter sido perdidos.
    if "e+" in texto.lower() or "e-" in texto.lower():
        raise ValueError(
            f"Chave da Nota chegou em notação científica e perdeu precisão: {texto}. "
            "A publicação foi interrompida para não gravar uma chave incorreta."
        )
    # Remove o .0 criado por leitores de planilha apenas quando for inteiro.
    if re.fullmatch(r"\d+\.0", texto):
        texto = texto[:-2]
    if texto and (not texto.isdigit() or len(texto) != 44):
        raise ValueError(f"Chave da Nota inválida (esperados 44 dígitos): {texto}")
    return texto


def normalizar_transportadora_saida(valor) -> str:
    texto = normalizar_texto(valor)
    chave = (unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii").lower())
    if "dialog" in chave:
        return "Diálogo"
    if "log serv" in chave:
        return "Log Serviços"
    return texto

def normalizar_nome_coluna(valor) -> str:
    valor = normalizar_texto(valor)

    valor = (
        unicodedata.normalize("NFKD", valor)
        .encode("ascii", "ignore")
        .decode("ascii")
    )

    valor = " ".join(valor.lower().split())

    return valor


def mapa_colunas(df: pd.DataFrame) -> dict[str, str]:
    return {
        normalizar_nome_coluna(c): c
        for c in df.columns
    }


def encontrar_coluna(
    df: pd.DataFrame,
    candidatos: list[str],
) -> str | None:
    mapa = mapa_colunas(df)

    for candidato in candidatos:
        real = mapa.get(
            normalizar_nome_coluna(candidato)
        )

        if real:
            return real

    return None


def ler_relatorio(conteudo: bytes) -> pd.DataFrame:
    log("Lendo relatÃ³rio Intelipost...")

    df = pd.read_excel(
        io.BytesIO(conteudo),
        engine="openpyxl",
        dtype=str,
        engine_kwargs={"read_only": True},
    )

    # Remove linhas 100% vazias.
    df = df.dropna(how="all").copy()

    log(
        f"RelatÃ³rio recebido: "
        f"{len(df):,} linha(s) | "
        f"{len(df.columns)} coluna(s)."
    )

    log("")
    log("COLUNAS DISPONÃVEIS NO EXPORT:")
    for coluna in df.columns:
        log(f" - {coluna}")

    return df


# ============================================================
# MAPEAMENTO PARA O FORMS TRANSP
# ============================================================

def validar_mapeamento(
    df: pd.DataFrame,
) -> dict[str, str | None]:
    mapeamento = {}

    log("")
    log("=" * 65)
    log("MAPEAMENTO DO LAYOUT FORMS TRANSP")
    log("=" * 65)

    for coluna_forms, aliases in ALIASES.items():
        encontrada = encontrar_coluna(
            df,
            aliases,
        )

        mapeamento[coluna_forms] = encontrada

        if encontrada:
            log(
                f"[OK] {coluna_forms} "
                f"<- {encontrada}"
            )
        else:
            log(
                f"[FALTA] {coluna_forms}"
            )

    faltantes = [
        k
        for k, v in mapeamento.items()
        if not v
    ]

    log("=" * 65)

    if faltantes:
        log(
            "ATENÃ‡ÃƒO: ainda nÃ£o consegui identificar "
            "automaticamente:"
        )
        for coluna in faltantes:
            log(f" - {coluna}")
    else:
        log(
            "Todas as 14 colunas de origem "
            "foram identificadas."
        )

    return mapeamento


def montar_base_forms(
    df: pd.DataFrame,
    mapeamento: dict[str, str | None],
) -> pd.DataFrame:
    resultado = pd.DataFrame(
        index=df.index
    )

    # 14 campos de origem.
    for destino in COLUNAS_BASE[:QTDE_COLUNAS_ORIGEM]:
        origem = mapeamento.get(destino)

        if origem:
            if destino == "Chave da Nota":
                resultado[destino] = df[origem].apply(normalizar_chave_nota)
            elif destino == "Transportadora":
                resultado[destino] = df[origem].apply(normalizar_transportadora_saida)
            else:
                resultado[destino] = df[origem].apply(normalizar_texto)
        else:
            resultado[destino] = ""

    # Campos operacionais: SEMPRE comeÃ§am em branco.
    for coluna in COLUNAS_OPERACIONAIS:
        resultado[coluna] = ""

    # MantÃ©m a ordem exata.
    resultado = resultado[COLUNAS_BASE]

    return resultado


# ============================================================
# CLASSIFICAÃ‡ÃƒO ABERTO / FINALIZADO
# ============================================================

def normalizar_status(valor) -> str:
    valor = normalizar_texto(valor).upper()

    return (
        unicodedata.normalize("NFKD", valor)
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
    )


def mascara_finalizados(
    df_relatorio: pd.DataFrame,
) -> pd.Series:
    col_data_entrega = encontrar_coluna(
        df_relatorio,
        ALIASES_DATA_ENTREGA,
    )

    col_previsao_cliente = encontrar_coluna(
        df_relatorio,
        ALIASES_PREVISAO_ENTREGA_CLIENTE,
    )

    col_previsao_transportadora = encontrar_coluna(
        df_relatorio,
        ALIASES_PREVISAO_ENTREGA_TRANSPORTADORA,
    )

    col_data_despacho = encontrar_coluna(
        df_relatorio,
        ALIASES_DATA_DESPACHO,
    )

    col_previsao_transportadora_original = encontrar_coluna(
        df_relatorio,
        ALIASES_PREVISAO_ENTREGA_TRANSPORTADORA_ORIGINAL,
    )

    col_micro_status = encontrar_coluna(
        df_relatorio,
        ALIASES_MICRO_STATUS,
    )

    col_status_transportador = encontrar_coluna(
        df_relatorio,
        ALIASES_STATUS_TRANSPORTADOR,
    )

    col_status = encontrar_coluna(
        df_relatorio,
        ALIASES_STATUS,
    )

    log("")
    log("CLASSIFICAÃ‡ÃƒO DE FINALIZADOS:")

    if col_data_entrega:
        log(
            f" - Data entrega: {col_data_entrega}"
        )
    else:
        log(
            " - Data entrega: nÃ£o identificada"
        )

    if col_status:
        log(
            f" - Status: {col_status}"
        )
    else:
        log(
            " - Status: nÃ£o identificado"
        )

    # ComeÃ§a com tudo NÃƒO finalizado.
    finalizado = pd.Series(
        False,
        index=df_relatorio.index,
    )

    if col_data_entrega:
        datas = pd.to_datetime(
            df_relatorio[col_data_entrega],
            errors="coerce",
        )

        finalizado = (
            finalizado
            | datas.notna()
        )

    if col_status:
        status = (
            df_relatorio[col_status]
            .apply(normalizar_status)
        )

        finalizado = (
            finalizado
            | status.isin(STATUS_FINALIZADOS)
        )

    if not col_data_entrega and not col_status:
        log(
            "ATENÃ‡ÃƒO: sem colunas para identificar "
            "finalizaÃ§Ã£o. A base operacional ficarÃ¡ "
            "igual Ã  base completa atÃ© validarmos."
        )

    log(
        f"Finalizados identificados: "
        f"{int(finalizado.sum()):,}"
    )

    return finalizado


# ============================================================
# PAYLOAD PARA O BACKEND (Fase 2 - upsert jÃ¡ homologado)
#
# ConstrÃ³i o payload EXATAMENTE no formato de
# docs/pedidos-import-payload.md e envia para
# POST /api/jobs/import-pedidos. NÃ£o decide nada sobre upsert,
# transportadora nÃ£o encontrada, campo jÃ¡ respondido etc. -
# isso Ã© 100% responsabilidade do backend, jÃ¡ homologado.
# ============================================================

# Campos que o payload EXIGE (ver docs/pedidos-import-payload.md).
# Se qualquer um estiver vazio numa linha, a linha Ã© pulada aqui
# mesmo (nÃ£o enviamos linha incompleta com valor inventado).
CAMPOS_OBRIGATORIOS_PAYLOAD = [
    "Nome do DestinatÃ¡rio",
    "Canal de Vendas",
    "Cidade do DestinatÃ¡rio",
    "UF",
    "CEP do destinatÃ¡rio",
    "Pedido de Venda",
    "Pedido",
    "Transportadora",
]


def valor_texto_ou_none(valor) -> str | None:
    texto = normalizar_texto(valor)
    return texto if texto else None


def valor_numero_ou_none(valor) -> float | None:
    texto = normalizar_texto(valor)

    if not texto:
        return None

    texto = texto.replace(".", "").replace(",", ".") if "," in texto else texto

    numero = pd.to_numeric(texto, errors="coerce")

    if pd.isna(numero):
        return None

    return float(numero)


def valor_data_iso_ou_none(valor) -> str | None:
    if valor is None:
        return None

    data = pd.to_datetime(valor, errors="coerce")

    if pd.isna(data):
        return None

    return data.strftime("%Y-%m-%d")


def montar_payload_pedidos(
    df_relatorio: pd.DataFrame,
    mapeamento: dict[str, str | None],
) -> tuple[list[dict], list[str]]:
    """
    Monta a lista de pedidos no formato do payload homologado, a
    partir do relatÃ³rio cru da Intelipost (nÃ£o da base jÃ¡ montada
    para o XLSX, para poder acessar a coluna "Data CriaÃ§Ã£o" e o
    valor real de "Data Entrega", que nÃ£o fazem parte de
    COLUNAS_BASE).

    Retorna (pedidos, linhas_ignoradas) - linhas_ignoradas Ã© uma
    lista de mensagens (para log), uma por linha pulada por falta
    de algum campo obrigatÃ³rio.
    """
    col_data_criacao = encontrar_coluna(
        df_relatorio,
        ALIASES_DATA_CRIACAO,
    )

    if not col_data_criacao:
        raise RuntimeError(
            "NÃ£o encontrei a coluna 'Data CriaÃ§Ã£o' (ou equivalente) "
            "no relatÃ³rio da Intelipost. Como esse campo Ã© "
            "obrigatÃ³rio no payload (data_criacao) e nÃ£o pode ser "
            "inventado, o envio ao backend foi interrompido.\n"
            "Colunas disponÃ­veis no export: "
            + ", ".join(str(c) for c in df_relatorio.columns)
        )

    col_data_entrega = encontrar_coluna(
        df_relatorio,
        ALIASES_DATA_ENTREGA,
    )

    col_previsao_cliente = encontrar_coluna(
        df_relatorio,
        ALIASES_PREVISAO_ENTREGA_CLIENTE,
    )

    col_previsao_transportadora = encontrar_coluna(
        df_relatorio,
        ALIASES_PREVISAO_ENTREGA_TRANSPORTADORA,
    )

    col_data_despacho = encontrar_coluna(
        df_relatorio,
        ALIASES_DATA_DESPACHO,
    )

    col_previsao_transportadora_original = encontrar_coluna(
        df_relatorio,
        ALIASES_PREVISAO_ENTREGA_TRANSPORTADORA_ORIGINAL,
    )

    col_micro_status = encontrar_coluna(
        df_relatorio,
        ALIASES_MICRO_STATUS,
    )

    col_status_transportador = encontrar_coluna(
        df_relatorio,
        ALIASES_STATUS_TRANSPORTADOR,
    )

    col_quantidade_ocorrencias = encontrar_coluna(
        df_relatorio,
        ALIASES_QUANTIDADE_OCORRENCIAS,
    )

    col_ultima_ocorrencia_micro = encontrar_coluna(
        df_relatorio,
        ALIASES_ULTIMA_OCORRENCIA_MICRO,
    )

    log(f"[payload] Data CriaÃ§Ã£o <- {col_data_criacao}")
    log(
        f"[payload] Data Entrega <- {col_data_entrega}"
        if col_data_entrega
        else "[payload] Data Entrega: nÃ£o identificada (data_entrega sempre nulo)"
    )

    log(
        f"[payload] Previs?o Entrega Cliente <- {col_previsao_cliente}"
        if col_previsao_cliente
        else "[payload] Previs?o Entrega Cliente: n?o identificada"
    )
    log(
        f"[payload] Previs?o Entrega Transportadora <- {col_previsao_transportadora}"
        if col_previsao_transportadora
        else "[payload] Previs?o Entrega Transportadora: n?o identificada"
    )
    log(
        f"[payload] Data Despacho <- {col_data_despacho}"
        if col_data_despacho
        else "[payload] Data Despacho: n?o identificada"
    )
    log(
        f"[payload] Previs?o Entrega Transportadora Original <- {col_previsao_transportadora_original}"
        if col_previsao_transportadora_original
        else "[payload] Previs?o Entrega Transportadora Original: n?o identificada"
    )
    log(
        f"[payload] MicroStatus <- {col_micro_status}"
        if col_micro_status
        else "[payload] MicroStatus: n?o identificado"
    )
    log(
        f"[payload] Status Transportador <- {col_status_transportador}"
        if col_status_transportador
        else "[payload] Status Transportador: n?o identificado"
    )

    log(
        f"[payload] Quantidade de Ocorrencias <- {col_quantidade_ocorrencias}"
        if col_quantidade_ocorrencias
        else "[payload] Quantidade de Ocorrencias: nao identificada"
    )

    log(
        f"[payload] Ultima Ocorrencia (Micro) <- {col_ultima_ocorrencia_micro}"
        if col_ultima_ocorrencia_micro
        else "[payload] Ultima Ocorrencia (Micro): nao identificada"
    )

    pedidos: list[dict] = []
    linhas_ignoradas: list[str] = []

    for indice, linha in df_relatorio.iterrows():
        valores_origem = {
            destino: (
                linha[mapeamento[destino]]
                if mapeamento.get(destino)
                else None
            )
            for destino in COLUNAS_BASE[:QTDE_COLUNAS_ORIGEM]
        }

        faltando = [
            campo
            for campo in CAMPOS_OBRIGATORIOS_PAYLOAD
            if not valor_texto_ou_none(valores_origem.get(campo))
        ]

        data_criacao = valor_data_iso_ou_none(linha[col_data_criacao])
        if not data_criacao:
            faltando.append("Data CriaÃ§Ã£o")

        if faltando:
            linhas_ignoradas.append(
                f"Linha {indice}: campo(s) obrigatÃ³rio(s) ausente(s): "
                + ", ".join(faltando)
            )
            continue

        pedidos.append(
            {
                "pedido": valor_texto_ou_none(valores_origem["Pedido"]),
                "nome_destinatario": valor_texto_ou_none(valores_origem["Nome do DestinatÃ¡rio"]),
                "canal_vendas": valor_texto_ou_none(valores_origem["Canal de Vendas"]),
                "cidade_destinatario": valor_texto_ou_none(valores_origem["Cidade do DestinatÃ¡rio"]),
                "uf": valor_texto_ou_none(valores_origem["UF"]),
                "cep_destinatario": valor_texto_ou_none(valores_origem["CEP do destinatÃ¡rio"]),
                "pedido_de_venda": valor_texto_ou_none(valores_origem["Pedido de Venda"]),
                "codigo_rastreio": valor_texto_ou_none(valores_origem["CÃ³digo de rastreio"]),
                "nota_fiscal": valor_texto_ou_none(valores_origem["Nota Fiscal"]),
                "metodo_envio": valor_texto_ou_none(valores_origem["MÃ©todo de envio"]),
                "transportadora": valor_texto_ou_none(valores_origem["Transportadora"]),
                "valor_nota": valor_numero_ou_none(valores_origem["Valor da Nota"]),
                "peso_fisico": valor_numero_ou_none(valores_origem["Peso fisico"]),
                "chave_nota": valor_texto_ou_none(valores_origem["Chave da Nota"]),
                "data_criacao": data_criacao,
                "data_entrega": (
                    valor_data_iso_ou_none(linha[col_data_entrega])
                    if col_data_entrega
                    else None
                ),
                "previsao_entrega_cliente": (
                    valor_data_iso_ou_none(linha[col_previsao_cliente])
                    if col_previsao_cliente
                    else None
                ),
                "previsao_entrega_transportadora": (
                    valor_data_iso_ou_none(linha[col_previsao_transportadora])
                    if col_previsao_transportadora
                    else None
                ),
                "data_despacho": (
                    valor_data_iso_ou_none(linha[col_data_despacho])
                    if col_data_despacho
                    else None
                ),
                "previsao_entrega_transportadora_original": (
                    valor_data_iso_ou_none(
                        linha[col_previsao_transportadora_original]
                    )
                    if col_previsao_transportadora_original
                    else None
                ),
                "micro_status": (
                    valor_texto_ou_none(linha[col_micro_status])
                    if col_micro_status
                    else None
                ),
                "status_transportador": (
                    valor_texto_ou_none(linha[col_status_transportador])
                    if col_status_transportador
                    else None
                ),
                "quantidade_ocorrencias": (
                    None
                    if not col_quantidade_ocorrencias
                    or pd.isna(linha[col_quantidade_ocorrencias])
                    or str(linha[col_quantidade_ocorrencias]).strip() == ""
                    else int(float(linha[col_quantidade_ocorrencias]))
                ),
                "ultima_ocorrencia_micro": (
                    valor_texto_ou_none(linha[col_ultima_ocorrencia_micro])
                    if col_ultima_ocorrencia_micro
                    else None
                ),
            }
        )

    return pedidos, linhas_ignoradas


def enviar_pedidos_backend(pedidos: list[dict]) -> dict:
    """Envia pedidos em lotes com retry automatico em falhas temporarias."""
    log("")
    log("=" * 65)
    log(f"Enviando {len(pedidos):,} pedido(s) para o backend...")
    log(f"URL: {FORMS_TRANSP_API_URL}")
    log(f"Lote: {TAMANHO_LOTE_BACKEND:,} pedido(s) por requisicao")
    log("=" * 65)

    consolidado = {
        "recebidos": 0,
        "inseridos": 0,
        "atualizados": 0,
        "erros_validacao": [],
        "transportadora_nao_encontrada": [],
        "erros_persistencia": [],
        "avisos": [],
    }

    total_lotes = max(
        1,
        (len(pedidos) + TAMANHO_LOTE_BACKEND - 1) // TAMANHO_LOTE_BACKEND,
    )

    max_tentativas = MAX_TENTATIVAS_BACKEND

    with requests.Session() as sessao:
        sessao.headers.update({
            "content-type": "application/json",
            "x-pedidos-import-secret": PEDIDOS_IMPORT_SECRET,
        })

        for numero_lote, inicio_lote in enumerate(
            range(0, len(pedidos), TAMANHO_LOTE_BACKEND),
            start=1,
        ):
            lote = pedidos[
                inicio_lote:inicio_lote + TAMANHO_LOTE_BACKEND
            ]

            log(
                f"[backend] lote {numero_lote}/{total_lotes}: "
                f"{len(lote):,} pedido(s)..."
            )

            resposta = None

            for tentativa in range(1, max_tentativas + 1):
                try:
                    resposta = sessao.post(
                        FORMS_TRANSP_API_URL,
                        json={"pedidos": lote},
                        timeout=(30, TIMEOUT_BACKEND_SEGUNDOS),
                    )

                    if resposta.status_code == 401:
                        raise RuntimeError(
                            "Backend recusou a requisicao (401) - "
                            "confira PEDIDOS_IMPORT_SECRET."
                        )

                    if resposta.status_code == 400:
                        raise RuntimeError(
                            f"Backend recusou o payload (400) "
                            f"no lote {numero_lote}: {resposta.text}"
                        )

                    # Erros de sobrecarga/indisponibilidade sÃ£o temporÃ¡rios.
                    # O mesmo lote pode ser reenviado com seguranÃ§a porque o
                    # endpoint realiza upsert, sem duplicar os pedidos.
                    if resposta.status_code == 429 or resposta.status_code >= 500:
                        raise requests.exceptions.HTTPError(
                            f"HTTP {resposta.status_code}: "
                            f"{resposta.text[:500]}",
                            response=resposta,
                        )

                    resposta.raise_for_status()
                    break

                except (
                    requests.exceptions.ConnectionError,
                    requests.exceptions.Timeout,
                    requests.exceptions.HTTPError,
                ) as erro:
                    status = (
                        erro.response.status_code
                        if isinstance(erro, requests.exceptions.HTTPError)
                        and erro.response is not None
                        else None
                    )

                    # Outros HTTP 4xx representam problema definitivo de
                    # autenticaÃ§Ã£o/payload e nÃ£o devem ser repetidos.
                    if status is not None and status != 429 and status < 500:
                        raise

                    if tentativa >= max_tentativas:
                        log(
                            f"[backend] lote {numero_lote}/{total_lotes} "
                            f"falhou apos {max_tentativas} tentativas."
                        )
                        raise

                    retry_after = None
                    if (
                        isinstance(erro, requests.exceptions.HTTPError)
                        and erro.response is not None
                    ):
                        retry_after = erro.response.headers.get("Retry-After")

                    try:
                        espera = int(retry_after) if retry_after else min(tentativa * 10, 60)
                    except (TypeError, ValueError):
                        espera = min(tentativa * 10, 60)

                    log(
                        f"[backend] falha temporaria no lote "
                        f"{numero_lote}/{total_lotes} "
                        f"(tentativa {tentativa}/{max_tentativas}): "
                        f"{erro}"
                    )
                    log(
                        f"[backend] aguardando {espera}s "
                        f"antes de tentar o mesmo lote novamente..."
                    )

                    time.sleep(espera)

            if resposta is None:
                raise RuntimeError(
                    f"Nenhuma resposta recebida para o lote {numero_lote}."
                )

            resultado = resposta.json()

            consolidado["recebidos"] += int(
                resultado.get("recebidos") or 0
            )
            consolidado["inseridos"] += int(
                resultado.get("inseridos") or 0
            )
            consolidado["atualizados"] += int(
                resultado.get("atualizados") or 0
            )

            for chave in (
                "erros_validacao",
                "transportadora_nao_encontrada",
                "erros_persistencia",
                "avisos",
            ):
                consolidado[chave].extend(
                    resultado.get(chave) or []
                )

            log(
                f"[backend] lote {numero_lote}/{total_lotes} concluido | "
                f"inseridos={resultado.get('inseridos', 0)} | "
                f"atualizados={resultado.get('atualizados', 0)}"
            )

    log("")
    log("=" * 65)
    log("RESUMO DA IMPORTACAO")
    log("=" * 65)
    log(f"Recebidos:                     {consolidado['recebidos']}")
    log(f"Inseridos:                     {consolidado['inseridos']}")
    log(f"Atualizados:                   {consolidado['atualizados']}")
    log(f"Erros de validacao:            {len(consolidado['erros_validacao'])}")
    log(
        f"Transportadora nao encontrada: "
        f"{len(consolidado['transportadora_nao_encontrada'])}"
    )
    log(
        f"Erros de persistencia:         "
        f"{len(consolidado['erros_persistencia'])}"
    )
    log(f"Avisos:                        {len(consolidado['avisos'])}")
    log("=" * 65)

    return consolidado


# ============================================================
# UPLOAD LOCAL D-1
# ============================================================

ARQUIVO_CARGA_D1 = Path(
    os.getenv(
        "FORMS_TRANSP_ARQUIVO_CARGA_D1",
        str(PASTA / "relatorio_intelipost_d1.xlsx"),
    )
)

def main():
    log("=" * 65)
    log("FORMS TRANSP - GERACAO DRIVE - GOCASE")
    log("=" * 65)

    inicio, fim = janela_execucao()

    log(
        f"Janela da carga: "
        f"{inicio:%d/%m/%Y} ate {fim:%d/%m/%Y}"
    )

    # 1. Coleta o relatorio da Intelipost
    token = login()

    solicitar_relatorio(
        token=token,
        inicio=inicio,
        fim=fim,
    )

    url = aguardar_relatorio(
        token=token,
        inicio=inicio,
        fim=fim,
    )

    conteudo = baixar_relatorio(url)

    # 2. Le o relatorio e identifica as colunas
    df_relatorio = ler_relatorio(conteudo)
    mapeamento = validar_mapeamento(df_relatorio)

    # 3. Converte para o layout oficial do Forms Transp
    base_forms = montar_base_forms(
        df_relatorio,
        mapeamento,
    )

    # 4. Remove pedidos ja finalizados da base operacional
    finalizados = mascara_finalizados(df_relatorio)

    base_forms = base_forms.loc[~finalizados].copy()

    log("")
    log(f"Pedidos no relatorio: {len(df_relatorio):,}")
    log(f"Pedidos finalizados removidos: {int(finalizados.sum()):,}")
    log(f"Pedidos abertos para publicar: {len(base_forms):,}")

    if base_forms.empty:
        raise RuntimeError(
            "Nenhum pedido aberto encontrado para publicar."
        )

    # 5. Pasta temporaria com uma base por transportadora
    pasta_saida = PASTA / "bases_transportadoras"
    pasta_saida.mkdir(parents=True, exist_ok=True)

    # Limpa somente XLSX gerados anteriormente nesta pasta.
    for arquivo_antigo in pasta_saida.glob("base_*.xlsx"):
        arquivo_antigo.unlink()

    # 6. Separa e gera um XLSX por transportadora
    transportadoras = (
        base_forms["Transportadora"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    base_forms = base_forms.loc[transportadoras.ne("")].copy()

    arquivos_gerados = []

    for transportadora, df_transportadora in base_forms.groupby(
        "Transportadora",
        sort=True,
    ):
        nome_seguro = "".join(
            caractere if caractere.isalnum() else "_"
            for caractere in str(transportadora)
        )

        nome_seguro = "_".join(
            parte
            for parte in nome_seguro.split("_")
            if parte
        )

        caminho = pasta_saida / f"base_{nome_seguro}.xlsx"

        df_transportadora.to_excel(
            caminho,
            index=False,
            sheet_name="Pedidos",
        )

        arquivos_gerados.append(caminho)

        log(
            f"[OK] {transportadora}: "
            f"{len(df_transportadora):,} pedidos -> "
            f"{caminho.name}"
        )

    log("")
    log("=" * 65)
    log("GERACAO FINALIZADA")
    log(f"Transportadoras: {len(arquivos_gerados)}")
    log(f"Arquivos em: {pasta_saida}")
    log("=" * 65)


if __name__ == "__main__":
    main()
