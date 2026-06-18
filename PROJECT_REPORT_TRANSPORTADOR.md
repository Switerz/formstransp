# Projeto - Report Diario do Transportador

## Objetivo

Criar um MVP web para cadastro de transportadoras, preenchimento diario de indicadores operacionais, historico por data e dashboard executivo no formato de diario de bordo.

## Stack detectada e decisao tecnica

- Repositorio inicial estava vazio.
- Stack criada: Next.js App Router, TypeScript, Prisma, Recharts e CSS simples.
- Banco atual: PostgreSQL/Supabase via Prisma.
- O projeto ainda mantem artefatos locais antigos de SQLite em `prisma/dev.db`, mas o `schema.prisma` atual usa PostgreSQL com `DATABASE_URL` e `DIRECT_URL`.

## Arquitetura atual

- `app/`: rotas web, Server Components, Server Actions e API route do job.
- `components/`: componentes client-side de graficos.
- `lib/`: Prisma client, datas e funcoes centralizadas de calculo.
- `prisma/`: schema, migration e seed.

## Rotas planejadas/implementadas

- `/`: Home/Admin com transportadoras, status do dia e links.
- `/transportadoras/nova`: cadastro basico de transportadora.
- `/transportadoras/[id]`: diagnostico operacional consolidado por transportadora.
- `/transportadoras/[id]/editar`: edicao administrativa de transportadora.
- `/usuarios`: administracao de usuarios, reset de senha e status de troca obrigatoria.
- `/login`: autenticacao de usuarios internos e transportadoras.
- `/alterar-senha`: troca obrigatoria de senha temporaria.
- `/portal`: area autenticada da transportadora.
- `/portal/formulario`: formulario autenticado de envio diario.
- `/portal/sucesso`: confirmacao de envio autenticado.
- `/form/[token]`: rota legada desativada; redireciona para login.
- `/form/[token]/sucesso`: rota legada desativada; redireciona para o fluxo autenticado.
- `/reports/[transportadoraId]/[data]`: dashboard diario.
- `/reports/[transportadoraId]/[data]/export/pdf`: exportacao PDF do dashboard.
- `/historico/[transportadoraId]`: historico por transportadora.
- `/api/jobs/send-daily-reports`: job manual/dry-run para rotina das 11h.
- `/automacoes/logs`: consulta dos logs do job e futuros envios.

## Entidades

- `Transportadora`
- `AppUser`
- `AppSession`
- `DailyReportSubmission`
- `DailyPreviousDayMetrics`
- `DailyCurrentDayPreviewMetrics`
- `PreviousDayUFMetric`
- `AutomationLog`
- `SubmissionQualityLog`

## Formulas centralizadas

As regras ficam em `lib/calculations.ts`:

- SLA mensal acumulado
- Insucessos geral
- Devolucoes
- SLA semanal
- SLA diario
- SLA por UF
- Participacao por status
- SLA parcial do dia

Todas tratam denominador zero.

## Como rodar localmente

```bash
npm install
copy .env.example .env
npm run db:init
npm run prisma:seed
npm run dev
```

Depois acesse `http://localhost:3000`.

Durante a ultima sessao, o front foi reaberto em `http://localhost:3001` com:

```bash
npm run dev -- --port 3001
```

URLs uteis para retomada:

- Report demo: `http://localhost:3001/reports/cmqh6cqot0000sbiowvosu1k6/2026-06-16`
- Portal da transportadora: `http://localhost:3001/portal`
- Historico demo: `http://localhost:3001/historico/cmqh6cqot0000sbiowvosu1k6`
- Logs: `http://localhost:3001/automacoes/logs`

Se o servidor em `3001` travar ou ficar sem resposta, conferir a porta com:

```bash
netstat -ano | Select-String ':3001'
```

E reiniciar o processo da porta antes de subir o Next novamente.

## Sprint 0

- Repositorio inspecionado.
- Stack criada do zero.
- Documento inicial criado.
- Projeto preparado para rodar localmente.

## Sprint 1

- Models criadas no Prisma.
- Seed com transportadora demo e historico operacional.
- Migration SQL versionada e inicializador SQLite local criados.

Observacao: `prisma migrate dev` falhou nesta maquina com `Schema engine error` sem detalhe, mesmo com schema valido. Para manter o MVP rodando, o caminho local usa `npm run db:init`; em PostgreSQL/producao, revalidar Prisma Migrate.

## Sprint 2

- Funcoes de calculo centralizadas em `lib/calculations.ts`.
- Testes unitarios basicos em `lib/calculations.test.ts`.

## Sprint 3

- Listagem, cadastro e edicao de transportadoras.
- Ativacao/inativacao pelo formulario de edicao.
- Cadastro e edicao de transportadoras.
- Acesso de envio movido para portal autenticado.

## Sprint 4

- Formulario diario da transportadora.
- Salvar rascunho e submeter report.
- Validacao backend para numeros negativos.
- Alertas de consistencia em tempo real para UF, status, SLA e finalizados.

## Sprint 5

- Dashboard diario com cards, graficos e tabelas.
- Percentuais calculados pelas funcoes centralizadas.

## Sprint 6

- Historico por transportadora.
- Filtros por data inicial, data final e status.

## Sprint 7

- Endpoint protegido por secret para job diario.
- Modo dry-run e envio opcional por webhook.
- Registro de logs.
- Tela de consulta de logs em `/automacoes/logs`.

## Sprint 8

- Exportacao PDF usando Playwright.
- Botao `Exportar PDF` no dashboard.
- CSS de impressao para ocultar navegacao e acoes da tela.
- Log de sucesso/erro da geracao PDF em `automation_logs`.

## Sprint 9

- Rate limit simples em memoria para endpoints legados.
- Sanitizacao basica de textos recebidos por Server Actions.
- Bloqueio de edicao para reports ja `submitted`, `validated` ou `sent`.
- Validacao server-side das somas antes de submeter report.
- Bloqueio de transportadora inativa ja aplicado no portal autenticado e no submit.
- Logs de auditoria para criacao/edicao de transportadora, rascunho e submissao.

## Sprint 10

- Estados de carregamento para admin, formulario, historico e report.
- Estado global de erro e pagina 404 amigavel.
- Estados vazios reutilizaveis para admin, historico e logs.
- Tela de sucesso pos-envio com atalhos para admin, logs e formulario.
- Ajustes visuais e responsivos para botoes, acoes e dashboard.
- Fluxo demo mais apresentavel para revisao executiva.

## Impeccable - documentacao de design

- Skill `$impeccable document` executada.
- `PRODUCT.md` criado/atualizado com registro `product`, personalidade, usuarios, anti-referencias e principios.
- `DESIGN.md` criado/atualizado com north star "Torre de Controle Operacional", tokens, tipografia, componentes e regras de uso.
- Sidecar `.impeccable/design.json` criado e validado.
- Config live criada em `.impeccable/live/config.json`.

## Impeccable - critica do report

Alvo criticado:

`/reports/cmqh6cqot0000sbiowvosu1k6/2026-06-16`

Snapshots salvos:

- `.impeccable/critique/2026-06-17T13-25-37Z__app-reports-transportadoraid-data-page-tsx.md`
- `.impeccable/critique/2026-06-17T13-25-59Z__app-reports-transportadoraid-data-page-tsx.md`

Nota registrada: 25/40.

Principais achados:

- P1: KPIs nao explicavam claramente se o resultado estava bom, em atencao ou critico.
- P1: graficos de SLA tinham valor percebido baixo no desktop.
- P2: secoes do report tinham hierarquia repetitiva.
- P2: faltava navegacao entre reports/datas.
- P3: token visual solto para texto suave no header.

## Impeccable - P1 concluido

Arquivos principais:

- `app/reports/[transportadoraId]/[data]/page.tsx`
- `components/SlaCharts.tsx`
- `app/globals.css`
- `DESIGN.md`
- `.impeccable/design.json`

Alteracoes:

- KPIs receberam leitura de saude com labels `Dentro da meta`, `Atencao` e `Critico`.
- Cards principais passaram a explicar acao/limiar: meta minima de SLA, alerta de insucesso e alerta de devolucao.
- Graficos ganharam escala focada em 80-100%, linha de referencia da meta de 93%, captions e resumos.
- Recharts ficou com `isAnimationActive={false}` para reduzir risco de captura/PDF em branco.
- Token `report-muted` foi documentado e usado no header do report.

Validacoes executadas:

- `npm test`
- `npm run build`
- detector do `$impeccable` sem achados
- screenshot `.impeccable/critique/evidence/report-p1-static-charts-desktop.png`

## Impeccable - P2 concluido

Arquivos principais:

- `app/reports/[transportadoraId]/[data]/page.tsx`
- `app/globals.css`

Alteracoes:

- Toolbar do report adicionada com:
  - `Voltar ao admin`
  - `Report anterior`
  - `Proximo report`
  - `Historico`
  - `Exportar PDF`
- Queries adicionadas para encontrar report anterior e proximo por transportadora/data.
- Secoes ganharam narrativa operacional:
  - `Desempenho do dia anterior`
  - `Previa do SLA do dia atual`
- Secoes receberam resumo executivo e tags:
  - `Resultado fechado`
  - `Acompanhamento em curso`
- CSS responsivo ajustado para toolbar e headings.

Validacoes executadas:

- `npm test`
- `npm run build`
- detector do `$impeccable` sem achados
- HTTP 200 no report demo em `localhost:3001`
- screenshot confirmado em `.impeccable/critique/evidence/report-p2-desktop-confirmed.png`
- Sem overflow horizontal em desktop.

Observacao importante: uma captura anterior ficou com graficos em branco porque o servidor local em `3001` estava ouvindo, mas nao respondia corretamente. Apos reiniciar o servidor, os SVGs dos graficos foram confirmados no DOM com dimensao `548x220` e nova captura mostrou graficos renderizados.

## Estado atual para recomecar em nova janela

- O MVP esta funcional localmente.
- O dashboard cross-transportadora esta forte e cobre calendario de envio, ranking de risco, tendencia diaria, heatmap UF x transportadora, qualidade do envio e visao tabular das transportadoras.
- O fluxo publico por token foi desativado; `/form/[token]` redireciona para login.
- O envio diario agora acontece pelo portal autenticado da transportadora.
- Auth proprio esta ativo com usuarios, sessoes, senha temporaria e troca obrigatoria no primeiro acesso/reset.
- A migracao `require_password_change` foi aplicada no Supabase via MCP.
- O front estava aberto em `http://localhost:3001`.
- Proximo passo recomendado: rerodar critica visual/acessibilidade da nova `/transportadoras/[id]` e expor agregados de qualidade no dashboard cross-transportadora.

Ultima validacao tecnica executada:

```bash
npx prisma generate
npx tsc --noEmit
npm test
npm run build
```

Tambem foi executado smoke end-to-end com conta descartavel para validar login com senha temporaria, redirecionamento para `/alterar-senha`, troca de senha e limpeza da flag `passwordMustChange`.

## Pendencias

- Agendamento real externo/interno do job das 11h.
- Rate limit persistente/distribuido para login e endpoints sensiveis.
- Atualizar Recharts para v3 e revisar vulnerabilidades de dependencias.
- Rerodar critica do `$impeccable` apos P1/P2 para confirmar nova pontuacao.
- Fazer auditoria de acessibilidade/foco visivel antes de qualquer uso externo.

## Auth - senha temporaria concluido

- Coluna `passwordMustChange` adicionada em `app_users` no Prisma e no Supabase.
- Criacao e reset de usuarios agora geram senha temporaria com troca obrigatoria.
- Nova rota `/alterar-senha` bloqueia o acesso ao app ate a definicao de senha propria.
- O admin de usuarios mostra quando a conta ainda exige troca de senha.
- Smoke end-to-end validou login com senha temporaria, troca obrigatoria, limpeza da flag e remocao da conta descartavel.

## Backlog atual priorizado

### 1. Visao detalhada por transportadora - funcional

Status: `/transportadoras/[id]` implementada.

Inclui:

- Saude operacional da transportadora com score, cobertura de envio, SLA recente, insucessos, devolucoes e tendencia.
- Evolucao do SLA recente da propria transportadora.
- Historico de pendencias recentes.
- Heatmap UF proprio, separado do heatmap cross-transportadora.
- Responsaveis de envio a partir dos usuarios vinculados.
- Observacoes recentes dos reports enviados.
- Bloqueios recentes de qualidade.
- Acoes administrativas: editar transportadora, abrir historico, abrir ultimo report e gerenciar usuarios.

Proximo refinamento: filtros de periodo, grafico dedicado e comentarios internos por transportadora.

### 2. Logs de qualidade do formulario - base funcional

Status: entidade `SubmissionQualityLog` criada e tentativas bloqueadas por inconsistencias de soma sao persistidas no submit autenticado.

Ja registra:

- tentativa bloqueada;
- motivo da inconsistencia;
- transportadora;
- usuario;
- data do relatorio;
- payload resumido;
- timestamp.

Proximo refinamento: classificar tipo/severidade em campos proprios e exibir agregados no dashboard cross-transp.

### 3. Onboarding real das transportadoras - parcial

Status atual:

- Existe `/usuarios` para criar contas.
- Existe reset de senha.
- Senhas temporarias exigem troca obrigatoria no primeiro acesso ou apos reset.
- O script `scripts/provision-real-accounts.ts` gera contas e arquivo local em `.generated`.
- `/usuarios` permite copiar usuario, marcar credencial enviada e registra quem marcou/quando.

Falta:

- decidir se precisa exportar pendencias;
- melhorar runbook de entrega real de credenciais;
- adicionar auditoria detalhada para reset/inativacao.

### Itens adicionais recomendados

- Remover o campo legado `tokenPublicoFormulario` em uma migracao futura ou renomea-lo como campo interno sem semantica publica. Hoje ele permanece por compatibilidade de schema, mas nao habilita acesso publico.
- Adicionar auditoria para acoes de usuario: criacao, reset de senha, ativacao/inativacao e troca de senha.
- Criar rotina de limpeza de sessoes expiradas.
- Documentar runbook de producao: aplicar migracoes, provisionar contas reais, enviar credenciais e validar primeiro acesso.
- Reexecutar uma auditoria visual/acessibilidade depois da pagina `/transportadoras/[id]`, pois ela vira uma superficie central do produto.
