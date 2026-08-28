# Importação de pedidos (carga diária Intelipost) — Fase 2

## Endpoint

```
POST /api/jobs/import-pedidos
```

## Autenticação

Por secret, mesmo padrão do job `send-daily-reports` já existente. Envie **um** dos dois:

- Header: `x-pedidos-import-secret: <valor de PEDIDOS_IMPORT_SECRET>`
- Querystring: `?secret=<valor de PEDIDOS_IMPORT_SECRET>`

`PEDIDOS_IMPORT_SECRET` é uma variável de ambiente nova (ver `.env.example`). Sem ela configurada no servidor, o endpoint responde `401` para qualquer chamada.

## Corpo da requisição

```json
{
  "pedidos": [
    { "...": "ver campos abaixo" }
  ]
}
```

- `pedidos` é obrigatório, precisa ser uma lista não vazia.
- Limite de **5000 pedidos por requisição** (a rotina Python deve dividir a carga em lotes se precisar).
- Para o teste inicial: envie só os 50 pedidos de teste em uma única requisição.

## Campos de cada item de `pedidos`

Nomes em `snake_case` (é o contrato externo; internamente viram camelCase). Datas em `"YYYY-MM-DD"` ou ISO 8601 completo (`"YYYY-MM-DDTHH:mm:ss"`).

| Campo | Obrigatório | Tipo | Observação |
|---|---|---|---|
| `pedido` | **sim** | string | Chave única. Se já existir, atualiza; se não, insere. |
| `nome_destinatario` | sim | string | |
| `canal_vendas` | sim | string | Marca/canal (ex.: `LESCENT-ES`), **não é a transportadora**. |
| `cidade_destinatario` | sim | string | |
| `uf` | sim | string | Normalizado para maiúsculo automaticamente. |
| `cep_destinatario` | sim | string | Mantido como veio (com ou sem hífen). |
| `pedido_de_venda` | sim | string | |
| `codigo_rastreio` | não | string \| null | |
| `nota_fiscal` | não | string \| null | |
| `metodo_envio` | não | string \| null | |
| `transportadora` | **sim** | string | Texto livre. Casado contra `Transportadora.nome` ou `Transportadora.codigoSlug`, ignorando caixa/acentos/espaços. Se não achar correspondência, o pedido **não é gravado** e fica registrado em log (ver abaixo) — não falha a requisição inteira. |
| `valor_nota` | não | number \| string \| null | Aceita `189.9` ou `"189,90"`. Se vier em formato inválido, é salvo como vazio e um aviso é retornado (não rejeita a linha). |
| `peso_fisico` | não | number \| string \| null | Mesma regra de `valor_nota`. |
| `chave_nota` | não | string \| null | |
| `data_criacao` | **sim** | string (data) | Vem da coluna **"Data Criação"** da Intelipost. Define a janela dos 45 dias da Base Completa (Fase 5, ainda não implementada). Se ausente/inválida, a linha inteira é rejeitada. |
| `data_entrega` | não | string (data) \| null | Vem da coluna **"Data Entrega"** da Intelipost — **não confundir com a `DATA DE ENTREGA` operacional preenchida pela transportadora**, que é um campo separado (`dataEntrega`) e nunca é tocado por esta importação. Quando preenchida, o pedido é considerado finalizado para a visão da transportadora. |

### Exemplo de item completo

```json
{
  "pedido": "BR123456789",
  "nome_destinatario": "Maria da Silva",
  "canal_vendas": "LESCENT-ES",
  "cidade_destinatario": "São Paulo",
  "uf": "SP",
  "cep_destinatario": "01311-000",
  "pedido_de_venda": "PV-000123",
  "codigo_rastreio": "BR123456789BR",
  "nota_fiscal": "000123456",
  "metodo_envio": "PAC",
  "transportadora": "Log Servicos",
  "valor_nota": 189.90,
  "peso_fisico": 0.550,
  "chave_nota": "35260812345678000199550010000123451123456789",
  "data_criacao": "2026-08-20",
  "data_entrega": null
}
```

## O que a importação faz por linha

1. Valida os campos obrigatórios e o formato de `data_criacao`. Se falhar → linha rejeitada, não grava nada, entra em `erros_validacao` na resposta.
2. Resolve `transportadora` contra o cadastro. Se não encontrar → linha rejeitada, não grava nada, entra em `transportadora_nao_encontrada` na resposta **e** vira um registro em `AutomationLog` (`tipo: "pedidos_import_transportadora_nao_encontrada"`) com o número do pedido e o nome recebido — nunca é descartada silenciosamente.
3. Se `pedido` já existe: **atualiza só os 14 campos de origem** (+ `dataCriacaoPedido`, `dataEntregaOrigem`, `origemAtualizadoEm`). Os campos operacionais (do bloco `DATA COLETA/PROCESSAMENTO` até `DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO`, incluindo a `dataEntrega` operacional) **nunca são alterados por este endpoint**.
4. Se `pedido` não existe: insere um registro novo.
5. Falha de gravação em uma linha específica não interrompe as demais (fica em `erros_persistencia`).

Ao final do lote inteiro, é gravado um `AutomationLog` de resumo (`tipo: "pedidos_import"`) com as contagens.

## Resposta

`200` se tudo certo, `207` se houve qualquer erro/rejeição parcial, `400`/`401` para erros de requisição/autenticação.

```json
{
  "recebidos": 50,
  "inseridos": 32,
  "atualizados": 17,
  "erros_validacao": [
    { "index": 4, "pedido": "PED-INVALIDO-SEM-CEP", "motivo": "Campo obrigatório ausente ou vazio: \"cep_destinatario\"." }
  ],
  "transportadora_nao_encontrada": [
    { "index": 12, "pedido": "PED-123", "motivo": "Transportadora \"Transportadora Que Não Existe\" não encontrada no cadastro." }
  ],
  "erros_persistencia": [],
  "avisos": [
    { "index": 7, "pedido": "PED-456", "motivo": "Campo \"valor_nota\" com formato inválido, salvo como vazio." }
  ]
}
```

## Exemplo de chamada (curl)

```bash
curl -X POST "https://<host>/api/jobs/import-pedidos" \
  -H "content-type: application/json" \
  -H "x-pedidos-import-secret: <PEDIDOS_IMPORT_SECRET>" \
  -d @pedidos-teste.json
```

Onde `pedidos-teste.json` é `{ "pedidos": [ ... ] }`.

## Fora do escopo desta fase

Download ("Minha Base"/"Base Completa"), upload de devolução da transportadora e qualquer interface — **não implementados ainda**, propositalmente (Fases 3 a 6).
