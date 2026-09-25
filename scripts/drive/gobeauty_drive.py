# ============================================================
# FORMS TRANSP - SUBIR BASE D-1
# NÃO consulta a Intelipost. Usa arquivo local já coletado.
# ============================================================
# ============================================================
# FORMS TRANSP
# Coleta via RELATÓRIO COMPLETO da Intelipost
#
# Objetivo:
# - evitar milhares de chamadas paginadas no GraphQL de pedidos;
# - solicitar o relatório XLSX nativo da Intelipost;
# - baixar o arquivo quando ficar pronto;
# - mapear somente as colunas do layout oficial do Forms Transp;
# - manter as duas abas DE/PARA da "Base Padrão.xlsx";
# - deixar os campos operacionais em branco;
# - proteger no Excel os campos de origem e as abas DE/PARA.
#
# MODO DE TESTE:
# - 1 dia (D-1)
# - máximo 50 registros no arquivo final
#
# Quando validarmos:
#   MODO_TESTE = False
#   DIAS_BASE_COMPLETA = 45
# ============================================================

from __future__ import annotations

import gc
import io
import os
import re
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
# CONFIGURAÇÕES
# ============================================================

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

GRAPHQL_URL = "https://graphql.intelipost.com.br/"
API_BASE = "https://api.intelipost.com.br/api/v1"

CONTAS_GOBEAUTY = (
    {
        "nome": "Apice",
        "usuario": os.getenv("GOBEAUTY_APICE_USUARIO"),
        "senha": os.getenv("GOBEAUTY_APICE_SENHA"),
        "canais": {"APSE-RJ", "APSE-ES"},
    },
    {
        "nome": "Barbours",
        "usuario": os.getenv("GOBEAUTY_BARBOURS_USUARIO"),
        "senha": os.getenv("GOBEAUTY_BARBOURS_SENHA"),
        "canais": {
            "BARBOURS-ES",
            "RITUARIA-ES",
            "YENZAH-ES",
            "BARBOURS-RJ",
        },
    },
    {
        "nome": "Lescent",
        "usuario": os.getenv("GOBEAUTY_LESCENT_USUARIO"),
        "senha": os.getenv("GOBEAUTY_LESCENT_SENHA"),
        "canais": {
            "AUA-ES",
            "BY SAMIA-ES",
            "KOKESHI-ES",
            "LESCENT-ES",
        },
    },
)

# Opcional. Sem definir, executa as tres contas nesta ordem.
# Para homologar uma por vez no PowerShell, use por exemplo:
# $env:GOBEAUTY_CONTAS_EXECUTAR="APICE"
GOBEAUTY_CONTAS_EXECUTAR = os.getenv(
    "GOBEAUTY_CONTAS_EXECUTAR",
    "APICE,BARBOURS,LESCENT",
)


PASTA = Path(__file__).resolve().parent

ARQUIVO_MODELO = Path(
    os.getenv(
        "FORMS_TRANSP_TEMPLATE",
        str(PASTA / "Base Padrão.xlsx"),
    )
)

ARQUIVO_OPERACIONAL = PASTA / "pedidos_forms_transp.xlsx"
ARQUIVO_COMPLETO = PASTA / "pedidos_forms_transp_todos.xlsx"

# Durante a validação, mantém a carga pequena.
MODO_TESTE = False
DIAS_BASE_TESTE = 1
MAX_REGISTROS_TESTE = 500

# Quando MODO_TESTE = False, esta será a janela.
DIAS_BASE_COMPLETA = 45

# Performance para carga grande
GERAR_XLSX_LOCAL = True
TAMANHO_LOTE_BACKEND = int(os.getenv("TAMANHO_LOTE_BACKEND", "500"))
TIMEOUT_BACKEND_SEGUNDOS = int(os.getenv("TIMEOUT_BACKEND_SEGUNDOS", "300"))
MAX_TENTATIVAS_BACKEND = int(os.getenv("MAX_TENTATIVAS_BACKEND", "8"))

# Polling do relatório assíncrono.
INTERVALO_POLL_SEGUNDOS = 10
TIMEOUT_RELATORIO_SEGUNDOS = 60 * 30

# ------------------------------------------------------------
# Envio para o backend Forms Transp (Fase 2 - upsert já homologado)
# ------------------------------------------------------------
# Desliga sem tocar no resto do script, se precisar rodar só a
# geração local dos XLSX de novo.
ENVIAR_PARA_BACKEND = True

FORMS_TRANSP_API_URL = os.getenv("FORMS_TRANSP_API_URL")
PEDIDOS_IMPORT_SECRET = os.getenv("PEDIDOS_IMPORT_SECRET")

if ENVIAR_PARA_BACKEND and not FORMS_TRANSP_API_URL:
    raise RuntimeError(
        "ENVIAR_PARA_BACKEND=True mas FORMS_TRANSP_API_URL não está "
        "definido no .env. Ex.: FORMS_TRANSP_API_URL=https://formstransp.vercel.app/api/jobs/import-pedidos"
    )

if ENVIAR_PARA_BACKEND and not PEDIDOS_IMPORT_SECRET:
    raise RuntimeError(
        "ENVIAR_PARA_BACKEND=True mas PEDIDOS_IMPORT_SECRET não está "
        "definido no .env (precisa ser o mesmo valor configurado no backend)."
    )

# Senha de proteção do XLSX.
# É apenas uma barreira preventiva; segurança real deve ficar no backend.
SENHA_PROTECAO_XLSX = os.getenv(
    "FORMS_TRANSP_XLSX_PASSWORD",
    "forms-transp"
)


# ============================================================
# LAYOUT OFICIAL
# ============================================================

COLUNAS_BASE = [
    "Nome do Destinatário",
    "Canal de Vendas",
    "Cidade do Destinatário",
    "UF",
    "CEP do destinatário",
    "Pedido de Venda",
    "Pedido",
    "Código de rastreio",
    "Nota Fiscal",
    "Método de envio",
    "Transportadora",
    "Valor da Nota",
    "Peso fisico",
    "Chave da Nota",
    "DATA COLETA/PROCESSAMENTO",
    "DATA DE PREVISÃO",
    "PRAZO DE ENTREGA (DIAS ÚTEIS)",
    "DATA DE ENTREGA",
    "STATUS ATUAL",
    "OCORRÊNCIA",
    "MOTIVO DEVOLUÇÃO",
    "SLA (NO PRAZO/ATRASADO)",
    "JUSTIFICATIVA DE ATRASO",
    "NOVA DATA DE PREVISÃO (SE ATRASADO)",
    "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO",
]

# Da primeira coluna até Chave da Nota = origem / bloqueado.
QTDE_COLUNAS_ORIGEM = 14

# O restante é operacional e deve iniciar vazio.
COLUNAS_OPERACIONAIS = COLUNAS_BASE[QTDE_COLUNAS_ORIGEM:]


# ============================================================
# MAPEAMENTO DO RELATÓRIO INTELIPOST
#
# Colocamos aliases porque o nome exato pode variar entre versões
# do export. O script procura o primeiro nome existente.
# ============================================================

ALIASES = {
    "Nome do Destinatário": [
        "Nome do Destinatário",
        "Destinatário",
        "Nome Destinatário",
        "Nome do Cliente",
        "Cliente",
    ],
    "Canal de Vendas": [
        "Canal de Vendas",
        "Canal Venda",
        "Sales Channel",
        "Canal",
    ],
    "Cidade do Destinatário": [
        "Cidade do Destinatário",
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
    "CEP do destinatário": [
        "CEP do destinatário",
        "CEP Destinatário",
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
        "Número do Pedido",
        "Numero do Pedido",
        "Order Number",
    ],
    "Código de rastreio": [
        "Código de rastreio",
        "Código de Rastreio",
        "Codigo de Rastreio",
        "Tracking Code",
        "Rastreio",
    ],
    "Nota Fiscal": [
        "Nota Fiscal",
        "Número Nota Fiscal",
        "Numero Nota Fiscal",
        "NF",
        "Invoice Number",
    ],
    "Método de envio": [
        "Método de envio",
        "Método de Envio",
        "Metodo de Envio",
        "Método Entrega",
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
        "Peso físico",
        "Peso Físico",
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
# sair da visão operacional da transportadora.
ALIASES_DATA_ENTREGA = [
    "Data de Entrega",
    "Data Entrega",
    "Data Entregue",
    "Delivered Date",
]

# Campo auxiliar exigido pelo payload do backend (data_criacao), mas que
# não faz parte das 14 colunas de origem do layout Forms Transp em si -
# por isso fica fora de ALIASES/COLUNAS_BASE, do mesmo jeito que
# ALIASES_DATA_ENTREGA já era tratado.
ALIASES_DATA_CRIACAO = [
    "Data Criação",
    "Data de Criação",
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


def login(usuario: str, senha: str, nome_conta: str) -> str:
    log(f"[{nome_conta}] Autenticando na Intelipost...")

    resposta = requests.post(
        GRAPHQL_URL,
        json={
            "query": LOGIN_QUERY,
            "variables": {
                "email": usuario,
                "password": senha,
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
            "A Intelipost não retornou access_token."
        )

    log(f"[{nome_conta}] Login realizado com sucesso.")
    return token


# ============================================================
# JANELA
# ============================================================

def janela_execucao() -> tuple[date, date]:
    # Usa D-1 porque esse endpoint de relatório já era usado assim
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
# RELATÓRIO INTELIPOST
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

            # Estes valores são os usados pelo código de produção
            # que já baixa a tabela completa da Intelipost.
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
        f"Solicitando relatório Intelipost "
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
            "Token expirado/inválido ao solicitar relatório."
        )

    resposta.raise_for_status()

    log("Relatório solicitado. Aguardando processamento...")


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
                f"Relatório pronto após "
                f"{tentativas} consulta(s) de status."
            )
            return arquivo["url"]

        log(
            f"Relatório ainda processando "
            f"(consulta {tentativas})."
        )

        time.sleep(INTERVALO_POLL_SEGUNDOS)

    raise TimeoutError(
        f"O relatório {esperado} não ficou pronto "
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
        f"Download concluído: "
        f"{len(resposta.content):,} bytes."
    )

    return resposta.content


# ============================================================
# LEITURA / NORMALIZAÇÃO
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
    log("Lendo relatório Intelipost...")

    df = pd.read_excel(
        io.BytesIO(conteudo),
        engine="openpyxl",
        dtype=str,
        engine_kwargs={"read_only": True},
    )

    # Remove linhas 100% vazias.
    df = df.dropna(how="all").copy()

    log(
        f"Relatório recebido: "
        f"{len(df):,} linha(s) | "
        f"{len(df.columns)} coluna(s)."
    )

    log("")
    log("COLUNAS DISPONÍVEIS NO EXPORT:")
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
            "ERRO: colunas de origem obrigatórias não foram identificadas:"
        )
        for coluna in faltantes:
            log(f" - {coluna}")

        # Não gerar/publicar base parcial silenciosamente.
        # Chave da Nota também é obrigatória: não publicamos NF-e incompleta.
        faltantes_criticos = list(faltantes)
        if faltantes_criticos:
            raise RuntimeError(
                "Export Intelipost incompleto/mapeamento ausente. "
                "Corrija antes de publicar: "
                + ", ".join(faltantes_criticos)
            )
    else:
        log(
            "Todas as 14 colunas de origem "
            "foram identificadas."
        )

    return mapeamento


def normalizar_canal_vendas(valor) -> str:
    texto = normalizar_texto(valor)
    texto = (
        unicodedata.normalize("NFKD", texto)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    return " ".join(texto.upper().split())


def filtrar_canais_da_conta(
    df: pd.DataFrame,
    mapeamento: dict[str, str | None],
    nome_conta: str,
    canais_permitidos: set[str],
) -> pd.DataFrame:
    coluna_canal = mapeamento.get("Canal de Vendas")
    if not coluna_canal:
        raise RuntimeError(
            f"[{nome_conta}] A coluna Canal de Vendas nao foi encontrada."
        )

    canais_normalizados = df[coluna_canal].map(normalizar_canal_vendas)
    permitidos_normalizados = {
        normalizar_canal_vendas(canal)
        for canal in canais_permitidos
    }

    mascara_teste = canais_normalizados.str.contains(
        r"(?:^|[^A-Z0-9])TESTE(?:[^A-Z0-9]|$)",
        regex=True,
        na=False,
    )
    mascara_permitidos = canais_normalizados.isin(
        permitidos_normalizados
    )

    ignorados_teste = int(mascara_teste.sum())
    ignorados_outros = int((~mascara_permitidos & ~mascara_teste).sum())

    log("")
    log(f"[{nome_conta}] Filtro de Canal de Vendas")
    log(f"[{nome_conta}] Linhas recebidas: {len(df):,}")
    log(f"[{nome_conta}] Canais TESTE ignorados: {ignorados_teste:,}")
    log(f"[{nome_conta}] Outros canais ignorados: {ignorados_outros:,}")

    if ignorados_outros:
        contagem_outros = (
            canais_normalizados[~mascara_permitidos & ~mascara_teste]
            .value_counts(dropna=False)
        )
        for canal, quantidade in contagem_outros.items():
            log(
                f"[{nome_conta}] [IGNORADO] "
                f"{canal or '(vazio)'}: {quantidade:,}"
            )

    filtrado = df.loc[mascara_permitidos & ~mascara_teste].copy()
    log(f"[{nome_conta}] Linhas aceitas: {len(filtrado):,}")

    return filtrado


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

    # Campos operacionais: SEMPRE começam em branco.
    for coluna in COLUNAS_OPERACIONAIS:
        resultado[coluna] = ""

    # Mantém a ordem exata.
    resultado = resultado[COLUNAS_BASE]

    return resultado


# ============================================================
# CLASSIFICAÇÃO ABERTO / FINALIZADO
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
    log("CLASSIFICAÇÃO DE FINALIZADOS:")

    if col_data_entrega:
        log(
            f" - Data entrega: {col_data_entrega}"
        )
    else:
        log(
            " - Data entrega: não identificada"
        )

    if col_status:
        log(
            f" - Status: {col_status}"
        )
    else:
        log(
            " - Status: não identificado"
        )

    # Começa com tudo NÃO finalizado.
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
            "ATENÇÃO: sem colunas para identificar "
            "finalização. A base operacional ficará "
            "igual à base completa até validarmos."
        )

    log(
        f"Finalizados identificados: "
        f"{int(finalizado.sum()):,}"
    )

    return finalizado


# ============================================================
# PAYLOAD PARA O BACKEND (Fase 2 - upsert já homologado)
#
# Constrói o payload EXATAMENTE no formato de
# docs/pedidos-import-payload.md e envia para
# POST /api/jobs/import-pedidos. Não decide nada sobre upsert,
# transportadora não encontrada, campo já respondido etc. -
# isso é 100% responsabilidade do backend, já homologado.
# ============================================================

# Campos que o payload EXIGE (ver docs/pedidos-import-payload.md).
# Se qualquer um estiver vazio numa linha, a linha é pulada aqui
# mesmo (não enviamos linha incompleta com valor inventado).
CAMPOS_OBRIGATORIOS_PAYLOAD = [
    "Nome do Destinatário",
    "Canal de Vendas",
    "Cidade do Destinatário",
    "UF",
    "CEP do destinatário",
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
    partir do relatório cru da Intelipost (não da base já montada
    para o XLSX, para poder acessar a coluna "Data Criação" e o
    valor real de "Data Entrega", que não fazem parte de
    COLUNAS_BASE).

    Retorna (pedidos, linhas_ignoradas) - linhas_ignoradas é uma
    lista de mensagens (para log), uma por linha pulada por falta
    de algum campo obrigatório.
    """
    col_data_criacao = encontrar_coluna(
        df_relatorio,
        ALIASES_DATA_CRIACAO,
    )

    if not col_data_criacao:
        raise RuntimeError(
            "Não encontrei a coluna 'Data Criação' (ou equivalente) "
            "no relatório da Intelipost. Como esse campo é "
            "obrigatório no payload (data_criacao) e não pode ser "
            "inventado, o envio ao backend foi interrompido.\n"
            "Colunas disponíveis no export: "
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

    log(f"[payload] Data Criação <- {col_data_criacao}")
    log(
        f"[payload] Data Entrega <- {col_data_entrega}"
        if col_data_entrega
        else "[payload] Data Entrega: não identificada (data_entrega sempre nulo)"
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
            faltando.append("Data Criação")

        if faltando:
            linhas_ignoradas.append(
                f"Linha {indice}: campo(s) obrigatório(s) ausente(s): "
                + ", ".join(faltando)
            )
            continue

        pedidos.append(
            {
                "pedido": valor_texto_ou_none(valores_origem["Pedido"]),
                "nome_destinatario": valor_texto_ou_none(valores_origem["Nome do Destinatário"]),
                "canal_vendas": valor_texto_ou_none(valores_origem["Canal de Vendas"]),
                "cidade_destinatario": valor_texto_ou_none(valores_origem["Cidade do Destinatário"]),
                "uf": valor_texto_ou_none(valores_origem["UF"]),
                "cep_destinatario": valor_texto_ou_none(valores_origem["CEP do destinatário"]),
                "pedido_de_venda": valor_texto_ou_none(valores_origem["Pedido de Venda"]),
                "codigo_rastreio": valor_texto_ou_none(valores_origem["Código de rastreio"]),
                "nota_fiscal": valor_texto_ou_none(valores_origem["Nota Fiscal"]),
                "metodo_envio": valor_texto_ou_none(valores_origem["Método de envio"]),
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
                    if status is not None and status != 429 and status < 500:
                        raise

                    if tentativa >= max_tentativas:
                        log(
                            f"[backend] lote {numero_lote}/{total_lotes} "
                            f"falhou apos {max_tentativas} tentativas."
                        )
                        raise

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

def selecionar_contas_gobeauty() -> list[dict]:
    nomes = {
        normalizar_canal_vendas(nome)
        for nome in GOBEAUTY_CONTAS_EXECUTAR.split(",")
        if normalizar_canal_vendas(nome)
    }
    contas = [
        conta
        for conta in CONTAS_GOBEAUTY
        if normalizar_canal_vendas(conta["nome"]) in nomes
    ]

    desconhecidas = nomes - {
        normalizar_canal_vendas(conta["nome"])
        for conta in CONTAS_GOBEAUTY
    }
    if desconhecidas:
        raise RuntimeError(
            "Conta(s) desconhecida(s) em GOBEAUTY_CONTAS_EXECUTAR: "
            + ", ".join(sorted(desconhecidas))
        )
    if not contas:
        raise RuntimeError(
            "GOBEAUTY_CONTAS_EXECUTAR nao selecionou nenhuma conta."
        )

    return contas


def validar_credenciais_gobeauty(contas: list[dict]) -> None:
    faltantes = []

    for conta in contas:
        if not conta["usuario"]:
            faltantes.append(
                f"GOBEAUTY_{conta['nome'].upper()}_USUARIO"
            )
        if not conta["senha"]:
            faltantes.append(
                f"GOBEAUTY_{conta['nome'].upper()}_SENHA"
            )

    if faltantes:
        raise RuntimeError(
            "Variaveis ausentes no .env: " + ", ".join(faltantes)
        )


def processar_conta_gobeauty(
    conta: dict,
    inicio: date,
    fim: date,
) -> dict:
    nome_conta = conta["nome"]

    log("")
    log("=" * 65)
    log(f"GOBEAUTY - INICIANDO CONTA {nome_conta.upper()}")
    log("=" * 65)

    token = login(
        usuario=conta["usuario"],
        senha=conta["senha"],
        nome_conta=nome_conta,
    )

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
    df_relatorio = ler_relatorio(conteudo)
    mapeamento = validar_mapeamento(df_relatorio)

    df_filtrado = filtrar_canais_da_conta(
        df=df_relatorio,
        mapeamento=mapeamento,
        nome_conta=nome_conta,
        canais_permitidos=conta["canais"],
    )

    # Monta a base no layout oficial do Forms Transp
    base_forms = montar_base_forms(df_filtrado, mapeamento)

    # Remove pedidos finalizados
    finalizados = mascara_finalizados(df_filtrado)
    base_forms = base_forms.loc[~finalizados].copy()

    log('')
    log(f'[{nome_conta}] Pedidos abertos: {len(base_forms):,}')

    # Cada conta grava em sua propria pasta.
    # Assim Apice, Barbours e Lescent nao sobrescrevem umas as outras.
    pasta_saida = PASTA / 'bases_transportadoras' / 'gobeauty' / nome_conta.lower()
    pasta_saida.mkdir(parents=True, exist_ok=True)

    for arquivo_antigo in pasta_saida.glob('base_*.xlsx'):
        arquivo_antigo.unlink()

    coluna_transportadora = 'Transportadora'
    base_forms[coluna_transportadora] = (
        base_forms[coluna_transportadora]
        .fillna('')
        .astype(str)
        .str.strip()
    )
    base_forms = base_forms[base_forms[coluna_transportadora] != ''].copy()

    arquivos_gerados = 0

    for transportadora, df_transportadora in base_forms.groupby(coluna_transportadora, sort=True):
        nome_seguro = re.sub(r'[^A-Za-z0-9_-]+', '_', str(transportadora)).strip('_')
        caminho = pasta_saida / f'base_{nome_seguro}.xlsx'

        df_transportadora.to_excel(
            caminho,
            index=False,
            sheet_name='Pedidos',
        )

        arquivos_gerados += 1
        log(f'[OK] [{nome_conta}] {transportadora}: {len(df_transportadora):,} pedidos -> {caminho.name}')

    resultado = {
        'conta': nome_conta,
        'pedidos_validos': len(base_forms),
        'inseridos': 0,
        'atualizados': 0,
        'linhas_ignoradas_localmente': 0,
        'arquivos_gerados': arquivos_gerados,
    }

    del base_forms
    del df_filtrado
    del df_relatorio
    del conteudo
    gc.collect()

    log(f'[{nome_conta}] Finalizada: {arquivos_gerados} bases geradas.')
    return resultado


def main():
    log("=" * 65)
    log("FORMS TRANSP - GOBEAUTY - 3 CONTAS SEQUENCIAIS")
    log("=" * 65)

    contas = selecionar_contas_gobeauty()
    validar_credenciais_gobeauty(contas)
    log(
        "Contas selecionadas: "
        + " -> ".join(conta["nome"] for conta in contas)
    )

    inicio, fim = janela_execucao()

    log(
        f"Janela da carga: "
        f"{inicio:%d/%m/%Y} ate {fim:%d/%m/%Y}"
    )

    resultados = []
    for conta in contas:
        resultados.append(
            processar_conta_gobeauty(
                conta=conta,
                inicio=inicio,
                fim=fim,
            )
        )

    log("")
    log("=" * 65)
    log("CARGA GOBEAUTY FINALIZADA")
    log(
        f"Periodo processado: "
        f"{inicio:%d/%m/%Y} ate {fim:%d/%m/%Y}"
    )
    for resultado in resultados:
        log(
            f"{resultado['conta']}: "
            f"validos={resultado['pedidos_validos']:,} | "
            f"inseridos={resultado.get('inseridos', 0):,} | "
            f"atualizados={resultado.get('atualizados', 0):,} | "
            f"ignorados={resultado['linhas_ignoradas_localmente']:,}"
        )
    log("=" * 65)


if __name__ == "__main__":
    main()
