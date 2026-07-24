# Plano — Melhoria de UI/UX e Importação de XLSX

Atualizado em 2026-07-24.

Este documento registra a intenção antes da implementação, conforme pedido. Nada aqui foi codificado ainda — é a base para alinhar escopo, decisões em aberto e fases antes de começar.

## Status — Fase A concluída (2026-07-24)

Auditoria de UI/UX (`$impeccable critique`) rodada em todas as telas do produto. Notas e achados persistidos em `.impeccable/critique/`.

| Tela | Nota | P0 | P1 |
|---|---|---|---|
| Home/Admin (`/`) | 26/40 | — | 3 (corrigidos) |
| Formulário diário (`/portal/formulario`) | 23/40 | — | 2 (corrigidos) |
| Portal (`/portal`) | 28/40 | — | 1 (CTA duplicado, aberto) |
| Automações/Logs | 24/40 | 1 (corrigido) | 2 (1 aberto: sem busca/paginação) |
| Login | 23/40 | — | 2 (abertos: sem loading state, link "Entrar" redundante) |
| Histórico | 22/40 | 1 (corrigido) | 2 (abertos: validação de range de data, resumo de filtro) |
| Usuários | 21/40 | 1 (aberto: senha temporária sem copiar/perdida no reload) | 2 (abertos: sem confirmação em ações destrutivas, sem loading state) |
| Alterar-senha / Sucesso / Nova / Editar (lote leve, sem nota formal) | — | — | 1 (gradiente em `/portal/sucesso`, viola DESIGN.md) + 2 P2 (crash genérico em nome vazio, corrigido) |

### Bugs reais corrigidos nesta rodada (não só estética)
1. **Histórico**: pill de status sempre "ok" (verde), independente do status real. Corrigido em `app/historico/[transportadoraId]/page.tsx`.
2. **Automações/Logs**: erro renderizava com a mesma cor de "pendente" (sem variante vermelha). Corrigido em `app/automacoes/logs/page.tsx` + `app/globals.css` (`.pill.error`).
3. **Nova/Editar transportadora**: nome só de espaços disparava `throw new Error` não tratado, caindo no error boundary genérico. Corrigido em `app/actions.ts` (`redirect` + alerta inline), `app/transportadoras/nova/page.tsx`, `app/transportadoras/[id]/editar/page.tsx`.
4. **Formulário diário** (rodada anterior): dados digitados eram descartados em falha de validação, com possível contradição entre banner de erro e "consistente". Corrigido com cookie de snapshot em `app/actions.ts`.
5. **Home/Admin** (rodada anterior): painel "Fila de hoje" duplicava o painel de risco; ranking de risco empatava sem diferenciação quando não havia histórico. Corrigido em `app/page.tsx`.

Todas as correções validadas com `npx tsc --noEmit`, `npm test`, `npm run build` e teste real no navegador (Playwright, login como `admin-claude`/`demo-claude`).

### Rodada 2 concluída (2026-07-24, mesmo dia)
- **Login**: botão de submit agora mostra "Entrando..." e fica desabilitado durante o request (`components/LoginSubmitButton.tsx`, via `useFormStatus`); campo de usuário/e-mail recebe foco automático; link redundante "Entrar" removido do menu quando não autenticado (`app/layout.tsx`) — ele só existia na própria tela de login, sem função real em nenhuma outra rota.
- **Portal**: os dois CTAs que levavam ao mesmo lugar viraram um só primário ("Preencher relatório de hoje" / "Ver formulário" conforme o status), o outro virou secundário; ícone de "Pendente" trocado de `XCircle` (lê como erro) para `Clock` (neutro).
- **Portal/Sucesso**: gradiente removido, agora é um card branco com borda superior verde, igual ao resto do sistema (`app/globals.css`, `.success-panel`).
- **Usuários**: senha temporária ganhou botão "Copiar senha" e aviso explícito de que só aparece uma vez; ícone de "Credencial enviada" padronizado para `CheckCircle2` (antes usava o mesmo ícone de "Copiar usuário", causando confusão).

Todas validadas com `tsc`/`test`/`build` e teste real no navegador (incluindo criação e desativação de um usuário descartável para confirmar o botão de copiar senha).

### Rodada 3 concluída (2026-07-24, mesmo dia)
- **Usuários**: resetar senha e inativar agora exigem confirmação em dois cliques (`components/ConfirmSubmitButton.tsx`) — primeiro clique só troca o texto/cor do botão para um estado de aviso, segundo clique de fato submete. "Ativar" (não destrutivo) continua em um clique só.
- **Automações/Logs**: filtro por transportadora adicionado; paginação via "Carregar mais" (100 em 100, até 1000) com nota "Mostrando N registros".
- **Histórico**: intervalo de data invertido agora mostra alerta explícito em vez de silenciosamente não retornar nada; estado vazio diferencia "sem histórico" de "sem resultado para este filtro".
- **Contraste**: `--input-line` (borda dos inputs) e `--focus-ring` (anel de foco) escurecidos para passar do mínimo WCAG 1.4.11 (3:1) — medido e confirmado no navegador.

Validado com `tsc`/`test`/`build` e teste real no navegador (dois cliques no botão de confirmação, filtro de transportadora nos logs, range de data invertido no histórico, contraste medido via `getComputedStyle`).

### Pendente
- Automações/Logs: payload capturado (`AutomationLog.payload`) ainda não é exibido na UI, só usado internamente.

## Contexto

O preenchimento diário hoje é 100% manual em `/portal/formulario` (`components/DailyReportForm.tsx`): identificação (3 datas + responsável), 8 campos numéricos do dia anterior, 9 campos numéricos da prévia do dia atual, e 27 UFs × 2 campos (dentro/fora do prazo) = 54 inputs. No total, mais de 70 campos numéricos por envio. Esse volume de digitação manual é o motivador direto do pedido de importação por XLSX.

Em paralelo, o produto já tem um design system documentado (`DESIGN.md`, `PRODUCT.md`) e uma trilha de revisão visual registrada (`BACKLOG.md`, seção "Revisão visual de 2026-06-18"), então a frente de UI/UX deve reforçar esse sistema existente, não recomeçar do zero.

## Frente 1 — UI/UX geral

### O que já existe (não recomeçar)
- Design system com paleta, tipografia, componentes e regras de uso em `DESIGN.md`.
- Dashboard cross-transportadora e report diário já passaram por críticas do `$impeccable` (P1/P2 concluídos, nota subiu de 25/40).
- Página `/transportadoras/[id]` já revisada visualmente (desktop/mobile sem overflow, alvos de toque, legendas).

### Pendências já conhecidas (de `BACKLOG.md` e `PROJECT_REPORT_TRANSPORTADOR.md`) que esta frente deve endereçar
- Auditoria de acessibilidade/foco visível antes de qualquer uso externo (nunca feita formalmente).
- Foco visível, contraste e estados de erro/disabled consistentes em todos os controles.
- Filtro de período e gráfico dedicado em `/transportadoras/[id]`.
- Agregados de `SubmissionQualityLog` expostos no dashboard cross-transportadora.

### Pontos adicionais identificados nesta sessão (candidatos, a validar com você antes de priorizar)
- `DailyReportForm` é uma parede de 70+ inputs sem agrupamento visual forte nem preenchimento assistido — é o maior ponto de atrito de UX do produto hoje, e a razão de ser da Frente 2.
- A grade de UF (`uf-compact-grid`, 27 linhas × 2 campos) não tem atalho de "preencher todos com 0" nem validação incremental (só valida no submit).
- Sem tela intermediária de revisão pré-envio: o usuário só descobre inconsistência (soma errada) depois de tentar enviar.

### Metodologia proposta
1. Rodar auditoria com a skill/processo `impeccable` já usado no projeto, cobrindo todas as telas (não só report e `/transportadoras/[id]`).
2. Priorizar achados em P1/P2/P3, do mesmo jeito que já foi feito para o report.
3. Aplicar correções em lotes pequenos e revalidar (`npm test`, `npm run build`, captura de tela) a cada lote — igual ao histórico de sprints já registrado.
4. Tratar a tela nova de upload de XLSX (Frente 2) como parte desta auditoria desde o início, não como um apêndice visual depois.

## Frente 2 — Importação de XLSX

### Objetivo
Permitir que a transportadora baixe um modelo `.xlsx` pré-preenchido, complete offline (Excel/Sheets) e envie o arquivo de volta, como alternativa ao preenchimento manual no portal. O upload deve alimentar exatamente as mesmas tabelas que o formulário já preenche hoje: `DailyReportSubmission`, `DailyPreviousDayMetrics`, `DailyCurrentDayPreviewMetrics`, `PreviousDayUFMetric`.

### Princípio central: reaproveitar a regra de negócio existente
`app/actions.ts` já centraliza toda a lógica de upsert e validação de consistência (`upsertDailySubmissionForTransportadora` + `validateSubmissionConsistency`). A importação por XLSX **não deve reimplementar essas regras** — deve montar um `FormData` equivalente a partir das células lidas e chamar a mesma função. Isso garante que formulário manual e importação por planilha nunca divirjam nas regras de soma:
- soma por UF == total de pedidos do dia anterior;
- soma dos status do dia anterior == total de pedidos do dia anterior;
- no prazo + fora do prazo == total de pedidos do dia anterior;
- soma dos status do dia atual == total de pedidos do dia atual;
- finalizados no prazo + fora do prazo ≤ total finalizado.

### Modelo de dados do template (proposta)
Uma planilha com abas espelhando os grupos que já existem no formulário:

| Aba | Colunas | Origem |
|---|---|---|
| Identificação | Data do relatório, Data resultado dia anterior, Data prévia dia atual, Responsável (nome/e-mail), Observações | campos de identidade do form |
| Dia anterior | Total de pedidos, No prazo, Fora do prazo, Entregue, Em aberto, Tentativa sem sucesso, Devolução, Cancelado | `previousFields` |
| Prévia atual | Total de pedidos, Finalizado, Em aberto, Entregue, Tentativa sem sucesso, Devolução, Cancelado, Finalizados no prazo, Finalizados fora do prazo | `currentFields` |
| UF — dia anterior | 27 linhas (uma por UF de `lib/ufs.ts`), colunas Dentro do prazo / Fora do prazo | `BRAZILIAN_UFS` |

O modelo deve sair **pré-preenchido** com nome da transportadora, datas sugeridas (hoje/ontem) e os valores do último envio como referência — mesma lógica de `defaultValue` que o formulário já usa hoje a partir de `last`.

### Fluxo técnico proposto
1. **Download do modelo**: botão no portal (`/portal/formulario` ou tela nova) que gera o `.xlsx` sob demanda (rota/Server Action), já com os defaults acima.
2. **Upload**: tela para o usuário enviar o arquivo preenchido.
3. **Parser**: lê o arquivo no servidor, valida estrutura (abas esperadas presentes, cabeçalhos batem com a versão do template), extrai os valores.
4. **Reuso da validação**: monta `FormData` e chama `upsertAuthenticatedDailySubmission`/`upsertDailySubmissionForTransportadora` como já existe — sem duplicar regra de soma.
5. **Erros**: se a estrutura estiver quebrada (aba faltando, célula não numérica, UF duplicada/desconhecida) ou a consistência falhar, devolver mensagem específica por célula/UF — reaproveitando os textos já usados em `FormConsistencyAlerts`.
6. **Auditoria**: tentativas de importação bloqueadas devem gravar em `SubmissionQualityLog` como hoje acontece para o formulário manual (mesmo grão de auditoria, sem tabela nova).

### Decisões confirmadas (2026-07-24)
1. **Biblioteca**: `exceljs` — geração com estilo + leitura na mesma lib.
2. **Convivência**: os dois convivem. Portal mostra as duas opções (preencher no site ou enviar planilha).
3. **Reenvio/edição**: mesma trava do formulário — bloqueado se status já é `submitted`/`validated`/`sent`.
4. **Escopo do arquivo**: 1 dia por arquivo, equivalente 1:1 ao formulário atual.

### Fora de escopo nesta primeira fase
- Suporte a `.csv` ou outros formatos.
- Múltiplos dias/lote num único arquivo.
- Leitura de fórmulas/macros do Excel (só valores literais).
- Integração direta via API com sistemas internos da transportadora (fica para depois, se fizer sentido).

## Fases sugeridas

1. **Fase A — Auditoria UI/UX** ✅ concluída em 2026-07-24 (todas as telas auditadas, bugs reais corrigidos em duas rodadas).
2. **Fase B — Modelo XLSX** ✅ concluída em 2026-07-24. `lib/xlsx-template.ts` gera o `.xlsx` com `exceljs` (4 abas visíveis + 1 aba oculta `_meta` com `template_version`/`transportadora_id` para validação futura no parser). Rota `GET /portal/formulario/modelo` faz o download, pré-preenchido com o último envio. Botão "Baixar modelo (.xlsx)" adicionado em `components/DailyReportForm.tsx`. Validado com `tsc`/`test`/`build` e download real no navegador — conferi célula a célula contra os dados reais do banco (somas batendo, 27 UFs corretas).
3. **Fase C — Upload + parser** ✅ concluída em 2026-07-24. `lib/xlsx-parse.ts` valida estrutura (versão do modelo, transportadora, abas, cabeçalhos, tipo de cada célula) e devolve os mesmos nomes de campo que o formulário manual usa. `uploadAuthenticatedDailyReportXlsx` em `app/actions.ts` monta um `FormData` a partir do parser e chama `upsertDailySubmissionForTransportadora` — zero duplicação da regra de consistência. Falha estrutural grava em `SubmissionQualityLog` (mesmo padrão do formulário manual) e mostra erro inline. Upload convive com o formulário manual em `/portal/formulario`, escondido junto quando o dia já está bloqueado (mesma trava). 4 testes automatizados em `lib/xlsx-parse.test.ts` (ida e volta, transportadora errada, aba faltando, valor não numérico) + validação real no navegador: baixei o modelo, subi como rascunho (criou registro real no banco), subi de novo como envio final (virou `submitted`), e confirmei que o formulário de upload some quando o dia já está travado.
4. **Fase D — Auditoria e log**: coberta pelo reaproveitamento do `SubmissionQualityLog` na Fase C (tentativas de upload bloqueadas). Falta apenas expor esses logs agregados no dashboard cross-transportadora (já era um item aberto antes desta iniciativa).
5. **Fase E — Polimento UI/UX aplicado**: aplicar os achados da Fase A, com foco na nova tela de upload e nos pontos de atrito já conhecidos do formulário manual.
6. **Fase F — Testes**: testes unitários do parser (arquivo válido, aba faltando, célula inválida, soma inconsistente) e teste de ponta a ponta do upload real via Playwright (o mesmo método usado nesta sessão para validar login).

## Riscos e pontos de atenção

- **Arquivo malicioso/corrompido**: limitar tamanho de upload, validar mimetype/extensão, timeout no parse.
- **Datas do Excel**: Excel guarda datas como número serial; o parser precisa converter corretamente para o fuso `America/Sao_Paulo` já usado em `lib/dates.ts`, para não introduzir divergência de 1 dia.
- **Versionamento do modelo**: se o template mudar no futuro (novo campo, nova UF), precisa haver uma forma de rejeitar planilhas antigas com mensagem clara, em vez de importar dado errado silenciosamente.
- **Duplicar regra de negócio**: o maior risco de qualidade aqui é reimplementar a validação de consistência dentro do parser em vez de reaproveitar `upsertDailySubmissionForTransportadora`. Isso deve ser tratado como requisito não-negociável do design técnico.

## Próximo passo

Aguardando sua validação das decisões em aberto (biblioteca, convivência com o formulário, regra de bloqueio, escopo 1 dia por arquivo) antes de iniciar a Fase B. A Fase A (auditoria UI/UX) pode começar em paralelo, já que não depende dessas decisões.
