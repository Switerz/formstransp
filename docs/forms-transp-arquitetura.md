# Forms Transp — Documentação (estado real do projeto)

## Arquitetura

```
Intelipost (relatório de pedidos)
  → rotina Python (buscar_pedidos_forms_transp.py)
    → POST /api/jobs/import-pedidos (autenticado por secret)
      → lib/pedidos.ts: upsertPedidosFromIntelipost()
        → Supabase/Postgres via Prisma (model Pedido)
          → Portal Next.js:
              /portal/minha-base   (transportadora)
              /base-completa       (interno)
```

## Chave do pedido

`Pedido.pedido` — única, define se a carga da Intelipost insere um registro novo ou atualiza um existente. Nunca há duplicidade: o `upsert` sempre busca por essa chave antes de decidir.

## Campos de origem (atualizados automaticamente pela Intelipost)

Os 14 campos de origem (nome do destinatário, canal de vendas, cidade, UF, CEP, pedido de venda, código de rastreio, nota fiscal, método de envio, transportadora, valor da nota, peso, chave da nota) são **sempre sobrescritos** pela carga diária — são a "verdade" vinda da Intelipost.

## Campos operacionais (preservados nas atualizações)

Os 11 campos operacionais (datas de coleta/previsão/entrega/resolução de devolução, prazo, status atual, ocorrência, motivo devolução, SLA, justificativa de atraso) são preenchidos pela transportadora via devolução e **nunca são tocados pela carga da Intelipost**. `lib/pedidos.ts` monta o `update` do upsert usando exclusivamente os campos de origem (`origemFields`), nunca incluindo campo operacional algum — confirmado por leitura direta do código nesta rodada, sem necessidade de reescrever.

## Finalização — `dataEntregaOrigem`

A referência de pedido finalizado é **exclusivamente** `dataEntregaOrigem` (vem da Intelipost). O campo `dataEntrega` é operacional (preenchido pela transportadora) e **nunca** é usado para decidir se um pedido está finalizado — confirmado por varredura em todo o código nesta rodada (zero ocorrências de uso indevido).

## Regra de 45 dias (Base Completa)

A Base Completa hoje **não aplica nenhum filtro de data** — mostra o histórico completo, o que automaticamente satisfaz "suporta pelo menos 45 dias" (suporta qualquer intervalo). A referência de período, quando um filtro de data é aplicado nas telas (ver seção "D-1" abaixo), é sempre `dataCriacaoPedido` (Intelipost) ou `dataPrevisao` (Promessa Transporte) — nunca `createdAt` do banco.

## Minha Base

`/portal/minha-base` — mostra somente pedidos com `transportadoraId = sessão autenticada` **e** `dataEntregaOrigem IS NULL`. A transportadora é determinada exclusivamente por `requireCarrierUser()`/`user.transportadoraId`; nenhuma rota aceita transportadora vinda de query string, body ou formulário.

## Base Completa

`/base-completa` — acesso interno (`requireInternalUser`, aceita `internal_admin` e `internal_viewer`). Mostra todos os pedidos, abertos e finalizados, de todas as transportadoras, com filtro opcional por transportadora específica.

## D-1 / Promessa Transporte

Ambas as telas têm um filtro de período (`De` / `Até`), com **Promessa Transporte** (`dataPrevisao`) como referência de data. Ao abrir a página sem parâmetros, o período padrão é D-1 (ontem/ontem) — calculado dinamicamente a partir da data atual, nunca hardcoded como valor fixo de cálculo (só a *seleção inicial* é "ontem"; o cálculo em si sempre usa o intervalo efetivo). O usuário pode alterar `De`/`Até` livremente.

## Big Number "Pedidos Vencidos"

Conta pedidos onde `dataPrevisao` cai dentro do período selecionado **e** `dataEntregaOrigem IS NULL` (ainda não finalizado). Reaproveita a mesma referência de finalização de todo o resto do sistema.

## Perfis e permissões

| Perfil | Minha Base | Base Completa | Download | Devolução |
|---|---|---|---|---|
| `carrier_admin`/`carrier_operator` | própria transportadora | proibido | só própria base | só própria transportadora |
| `internal_admin` | n/a (redireciona) | permitido, consolidado ou filtrado | Base Completa | n/a |
| `internal_viewer` | n/a (redireciona) | permitido (leitura) | Base Completa | n/a |

Toda autorização acontece no servidor (`requireCarrierUser`/`requireInternalUser`/`requireInternalAdmin`), dentro da própria página/rota/Server Action — nunca depende de esconder um link de menu. Acesso direto por URL respeita o mesmo guard.

## Classificação de preenchimento

- **Pendente**: nenhum dos 11 campos operacionais preenchido.
- **Parcial**: alguns campos preenchidos, pedido ainda aberto.
- **Completo/Respondido**: todos os 11 campos preenchidos.
- **Finalizado**: `dataEntregaOrigem` preenchida — some da Minha Base, permanece na Base Completa com as respostas intactas.

## Processo incremental

1. Pedido novo → `INSERT` com todos os campos de origem.
2. Pedido existente (mesma chave `Pedido`) → `UPDATE` só dos campos de origem.
3. Campos operacionais → nunca apagados pela carga da Intelipost.
4. Pedido finalizado → permanece no banco/Base Completa; some da Minha Base.
5. Nenhuma duplicidade — a chave `Pedido` é única e o `upsert` sempre busca por ela primeiro.

## Auditoria

`PedidoFieldChangeAttempt` registra toda tentativa de alterar um campo protegido (de origem) ou um campo operacional já respondido durante a devolução — nunca aplicada, sempre logada com valor atual/tentado, pedido, transportadora e usuário.

## Pendências pós-MVP

- Drill-down/detalhamento a partir dos Big Numbers e motivos (explicitamente adiado para uma etapa futura).
- Homologação final com as áreas de negócio responsáveis (transportadoras reais, time de operação) — depende de pessoas externas ao desenvolvimento.
- 9 KPIs do carrossel da Minha Base sem fórmula definida (SLA Ajuste Transporte, SLA Transporte, SLA Cliente, Taxa de Insucesso, Taxa de Devolução, Tratativa CX, Processado, Perdas Extr/Sint/Avar) — mantidos na interface como "Aguardando regra", conforme decisão já validada.
- Ajuste visual pendente (não incluído nesta rodada): tamanho do botão "Baixar minha base" e altura dinâmica do carrossel de KPIs por slide — tarefa em andamento, retomada na próxima rodada.
