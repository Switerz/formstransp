# Product

## Register

product

## Users

O sistema atende dois grupos principais. O time interno de operacoes e logistica usa o admin, historico, logs e dashboard para acompanhar diariamente SLA, pendencias e qualidade operacional das transportadoras. As transportadoras usam o portal autenticado para preencher dados diarios de maneira rapida, principalmente no inicio do dia, antes do horario esperado de envio.

## Product Purpose

O produto existe para transformar preenchimentos diarios das transportadoras em um diario de bordo operacional confiavel, historico e compartilhavel. O sucesso do produto e permitir que o time interno veja rapidamente quem enviou, quem esta pendente, quais indicadores exigem atencao e consiga abrir ou exportar um report executivo sem retrabalho manual.

## Current MVP Scope

O MVP ja cobre cadastro de transportadoras, usuarios e sessoes proprias, portal autenticado para envio diario, rascunho/submissao diaria, historico, report diario, exportacao PDF, job manual/dry-run e logs. O banco alvo atual e PostgreSQL/Supabase via Prisma.

O dashboard cross-transportadora e o report diario sao as superficies mais lapidadas no momento. Eles possuem KPIs com interpretacao de saude, graficos de SLA com meta de referencia, calendario de envio, heatmap UF x transportadora, rankings operacionais, tabelas por UF/status, navegacao entre reports, link de historico e exportacao PDF.

## Brand Personality

Executivo, confiavel, operacional.

A voz deve ser direta, clara e calma. A interface deve transmitir controle e confianca nos numeros, sem parecer fria demais para quem precisa preencher dados sob pressao de rotina.

## Anti-references

Nao deve parecer Power BI generico, planilha cinza, SaaS coloridinho demais, dashboard escuro de NOC ou site marketing. O produto deve evitar excesso decorativo, hero de venda, visual promocional e densidade confusa de planilha.

## Design Principles

1. Clareza operacional antes de ornamento.
2. Indicadores precisam explicar acao, nao apenas exibir numeros.
3. O fluxo diario deve ser rapido para preencher e facil de auditar.
4. A experiencia deve diferenciar pendencia, sucesso e problema sem depender apenas de cor.
5. O dashboard deve parecer apresentavel para uma conversa executiva, mas continuar funcional como ferramenta de rotina.

## Current UX Priorities

1. Refinar a visao detalhada por transportadora em `/transportadoras/[id]` com filtros de periodo e eventual grafico dedicado.
2. Exibir agregados dos logs de qualidade do formulario no dashboard cross-transportadora.
3. Completar auditoria de usuarios: criacao, reset, inativacao e entrega de credenciais.
4. Garantir foco visivel, contraste e estados de erro/disabled em todos os controles.
5. Preparar caminho de producao: rate limit persistente, agendamento do job e revisao final de seguranca.

## Accessibility & Inclusion

Buscar WCAG AA como referencia minima para contraste, foco visivel e leitura de tabelas/formularios. Nao depender apenas de cor para comunicar status. Preservar compatibilidade com navegacao por teclado nos formularios, botoes e links. Animacoes devem respeitar `prefers-reduced-motion`.
