---
target: /automacoes/logs
total_score: 24
p0_count: 1
p1_count: 2
timestamp: 2026-07-24T18-52-20Z
slug: app-automacoes-logs-page-tsx
---
# Critique: /automacoes/logs (`app/automacoes/logs/page.tsx`)

## 1. Design Health Score

| # | Heuristic | Score /4 | Rationale |
|---|---|---|---|
| 1 | Visibility of system status | 1 | The only status signal is a pill, and the code (`status === "success" ? "ok" : "pending"`) collapses `error` into the exact same amber "pending" class as `skipped`/`pending`. On the one screen whose job is "show me what happened," a real failure is visually indistinguishable from routine noise. |
| 2 | Match between system and real world | 3 | Portuguese business vocabulary is correct and consistent (`Sucesso`, `Ignorado`, `Relatorio agendado`, `Webhook`, `Auditoria`). `mensagem` reads as plain operational prose, not a raw enum. |
| 3 | User control and freedom | 2 | `Limpar`/`Filtrar` work cleanly, but there is no way to see more than the newest 100 rows (hard `take: 100`, no pagination, no cursor) and no drill-in to a single record's full detail. |
| 4 | Consistency and standards | 2 | Component styling (cards, pills, table, buttons) matches the design system tokens. But `transportadora` names are plain text here, while the admin home (`app/page.tsx`) links carrier names to `/transportadoras/${id}` - an internal navigation inconsistency. The error-color omission is also an inconsistency against DESIGN.md's own semantic-color rule. |
| 5 | Error prevention | 3 | Read-only filter form, low risk surface. Minor risk: "Pendente ou ignorado" groups two different underlying ideas under one option, which can lead to mis-scoped filtering. |
| 6 | Recognition rather than recall | 2 | Column headers are self-explanatory, but `mensagem` for audit entries ("Transportadora editada.") gives no detail of what changed; the actual diff/payload exists in the DB (`AutomationLog.payload`) but is never rendered, forcing the admin to reconstruct context from memory or go around the UI entirely. |
| 7 | Flexibility and efficiency of use | 1 | Two filters only (`status`, `tipo`); no free-text search by transportadora, no date-range filter, no pagination past the fixed top-100 window, no sort control. For the stated "find one specific entry fast" use case this is a serious gap. |
| 8 | Aesthetic and minimalist design | 4 | Genuinely restrained: no gradients, no icon clutter, no decorative shadows, dense but legible table. This file is a good example of the product's "quiet control tower" mandate done right. |
| 9 | Help users recognize, diagnose, recover from errors | 1 | No distinct color for errors, no expandable detail/payload, no link from a log row into the related transportadora record to investigate further. This is the core job of an audit/incident screen and it is the weakest heuristic here. |
| 10 | Help and documentation | 3 | No inline help, but the audience is internal ops staff and the vocabulary is domain-standard, so the bar is lower here and mostly cleared. |

**Total: 24/40 - Needs Improvement.** Competent, on-brand visual execution let down by the exact diagnostic capabilities (status truth, drill-down, findability) the screen exists to provide.

## 2. Anti-Patterns Verdict

No AI-slop / generic-SaaS tells found in this file. No gradients, no glassmorphism, no decorative illustration, no marketing copy voice, no icon-soup, no oversized shadows, no `border-left` accent bars - all consistent with DESIGN.md's Do/Don't list. `detect.mjs` static scan corroborates this (see Assessment B). The real problems here are business-logic/data-modeling defects, not surface decoration.

## 3. Overall Impression

This is a plain, no-nonsense audit table that mostly honors the product's "control tower" restraint: tokens, spacing, and component shapes track the design system faithfully, filters round-trip correctly, and the empty state is handled properly instead of being an afterthought. But as the tool built for one specific persona - an admin chasing down an incident - it under-delivers at exactly the moments that matter. Error severity is visually flattened into the same amber as routine skipped/pending entries, the richer diagnostic payload the system already captures (`AutomationLog.payload`) is entirely absent from the UI, and there is no way to search or page past the newest 100 rows, or jump from a suspicious log row into the related carrier's own page. It reads as a competent log viewer that hasn't yet been pressure-tested against the question "would this actually help someone at 11pm find why a webhook failed three days ago?" Honest and uncluttered - not yet a debugging tool.

## 4. What's Working

- Faithful adherence to design tokens: card/table/pill/button styling matches DESIGN.md's flat, restrained aesthetic; zero AI-slop anti-patterns.
- Filters correctly persist selected values after submit; `Limpar` correctly resets to the unfiltered view.
- Empty state is implemented properly - title, explanation, and a working recovery action (`Limpar filtros`), not a bare "no data" message.
- `mensagem` column text wraps normally; nothing is truncated or hidden behind an ellipsis.
- Focus-visible outlines are consistently applied across nav links, buttons, and form controls (verified live via keyboard tab-through: visible outline on every interactive element reached).
- Mobile tap targets for the filter controls all comfortably clear ~40-44px (measured: selects 324x40, `Filtrar`/`Limpar` 324x44).
- Status/Tipo vocabulary matches domain language used elsewhere in the product.

## 5. Priority Issues

**P0 - Error logs are visually identical to routine pending/skipped logs.**
- What: `page.tsx:104` renders the pill as `success ? "ok" : "pending"`. Any status other than `success` - including `error` - gets the `.pill.pending` class. `globals.css` defines only `.pill.ok` (green) and `.pill.pending` (amber); there is no `.pill.error`/`.pill.danger` class at all.
- Why: DESIGN.md's Named Rule is explicit - red ("Vermelho Incidencia") is reserved for real errors, distinct from amber "atencao," and must not be decorative. This screen's entire purpose is surfacing incidents, and it currently cannot show one in red. On the day an error occurs, it will sit in the table with the same color as every routine "Ignorado"/"Pendente" row around it, defeating fast visual triage for exactly the person who needs it (Alex).
- Fix: add a third pill variant (`.pill.error`, red background/text) and map `status === "error"` to it explicitly, independent of the `pending`/`skipped` bucket.
- Suggested command: `colorize`

**P1 - Diagnostic payload is captured but never shown.**
- What: `AutomationLog.payload` (webhook body sent, audit diffs like codigoSlug/ativo, submission dataReport/status) is written by `app/actions.ts` and `app/api/jobs/send-daily-reports/route.ts` on every log entry, but `page.tsx` only renders `log.mensagem` - a static, generic sentence ("Transportadora editada.", "Relatorio enviado pela transportadora."). There is no detail view, no expandable row, no `/automacoes/logs/[id]` page.
- Why: for the audit/debugging use case, the generic message answers "what kind of thing happened" but not "what exactly changed / what was sent / what failed." The one piece of data that could actually resolve an incident is invisible in the UI even though it already exists in the database.
- Fix: add an expandable row (or lightweight detail panel) that renders the parsed `payload` as labeled key/value pairs, not a raw JSON string dump.
- Suggested command: `clarify`

**P1 - No search, date range, or pagination beyond the newest 100 rows.**
- What: the query is `take: 100` with no `skip`/cursor, and the only filters are `status` and `tipo`. There is no free-text search by transportadora name and no date-range control, and nothing on screen indicates the list is truncated.
- Why: the brief for this screen is explicitly "a power admin debugging an incident, needs to find one specific entry fast." If the relevant entry is older than the newest 100 rows across all carriers (plausible on a normal day with the daily job running for many transportadoras), there is currently no way to reach it at all - not even the current filters help, since neither filters on transportadora.
- Fix: add a transportadora search/select and a date-range filter, plus pagination or "carregar mais" past the initial 100.
- Suggested command: `optimize`

**P2 - Transportadora name isn't a link, breaking the app's own navigation pattern.**
- What: the transportadora cell renders plain text. Elsewhere in the codebase (`app/page.tsx`), transportadora names in operational tables link to `/transportadoras/${id}`.
- Why: this is the natural next click for Alex after spotting a suspicious row - "let me check that carrier's current state" - and it's one click away everywhere else in the product except here.
- Fix: wrap the transportadora cell in the same `/transportadoras/[id]` link used on the admin home page, when `transportadoraId` is present.
- Suggested command: `adapt`

**P3 - Mobile view hides Status and Mensagem (the two most diagnostic columns) off-screen by default.**
- What: `.table-wrap > table { min-width: 920px; }` forces horizontal scroll at 390px viewport width; only Criado em, Transportadora, and Data do relatorio are visible without scrolling (confirmed live: table-wrap scrollWidth 920 vs clientWidth 324).
- Why: this is a low-traffic internal tool primarily used at a desk, so this is lower priority than P0/P1 - but PRODUCT.md's accessibility section doesn't scope mobile out, and the columns cut off are exactly the ones needed to triage.
- Fix: at narrow widths, either add a persistent visible-scroll affordance (shadow/gradient hint) or restructure rows into a compact stacked card layout showing status + message up front.
- Suggested command: `layout`

## 6. Persona Red Flags

**Alex (power admin debugging an incident, needs to find one specific entry fast)**
- Filters to Status=Erro expecting a visually obvious red flag - but even once found, the row is the same amber as every neighboring "Ignorado"/"Pendente" row; only reading the text distinguishes it.
- Once the row is found, `mensagem` is a short static sentence with no detail - Alex cannot see the webhook payload/response or what field an audit edit actually changed without going around the UI to the database.
- If the incident is more than ~100 log rows old (plausible across many carriers on a busy day), there is no filter, search, or pagination path to reach it - the incident is effectively invisible from this screen, full stop.
- No one-click path from a flagged row to the affected carrier's own page to cross-check current state.

**Sam (accessibility)**
- Focus-visible: pass. Verified live - every interactive element (nav links, `Filtrar`, `Limpar`, `Sair`, both selects) gets a clear 3px outline on keyboard focus, matching PRODUCT.md's stated priority.
- Labels: pass. Status/Tipo selects use proper `<label htmlFor>` associations.
- Color dependency: text labels do accompany every pill, so no outright "color alone" violation - but the intended redundant visual cue is undermined: a user scanning quickly by pill color/shape (a common, low-effort scanning strategy, not just for colorblind users) will not catch an `error` entry, since it doesn't carry the visually distinct red the design system reserves for it.
- Mobile: table requires horizontal scroll with no visible scroll affordance/indicator, which is a discoverability problem for low-vision or motor-impaired users who may not realize Status/Mensagem exist off-screen at all.
- Tap targets: pass. Filter selects/buttons measured 40-44px tall on a 390px viewport.

## 7. Minor Observations

- The status filter's "Pendente ou ignorado" option maps to value="skipped" only (`page.tsx:56`), but a distinct `pending` status genuinely exists in the data (confirmed live: rows labeled "Pendente" render with mensagem "Seed: relatorio ainda pendente..."). There is no dropdown option that isolates `pending` alone from `skipped` alone, despite the label implying both are covered together as one filterable group.
- No "showing X of Y" / truncation indicator: with a silent take:100 cap, an admin has no way to tell whether the table shows everything or just the most recent slice.
- No skip-to-content link app-wide: a keyboard user must tab through 5 global nav items before reaching this page's own filter controls. Not specific to this file, but affects the "find fast" persona goal on every visit.
- `detect.mjs` returned zero findings (see Assessment B) - expected, since the real issues here (status/color-mapping logic, missing payload rendering, missing pagination) are business-logic level and outside a static-pattern scanner's detection surface, not evidence the file is issue-free.
- The `.muted` subtitle text measures roughly 4.43:1 contrast at 16px against the page background - marginally under the WCAG AA 4.5:1 threshold for normal-size text. Likely shared across the app rather than unique to this screen; worth a token-level check separately.

## 8. Questions to Consider

1. Should `error` status get a genuine red pill matching DESIGN.md's "Vermelho Incidencia" rule, and should the same fix be checked against any other screen using this success/pending binary pill pattern?
2. Should the raw `payload` be exposed in this admin-only tool (e.g., a collapsible "ver detalhes" row), or was hiding it a deliberate security/PII decision worth documenting?
3. What log volume is expected in production? If daily volume across all transportadoras can regularly exceed 100 rows, is the fixed take:100 with no pagination an accepted short-term limitation, or does it need to be closed before the "production hardening" priority in PRODUCT.md is considered done?
4. Should the transportadora name in this table link through to `/transportadoras/[id]`, matching the pattern already established on the admin home page?
5. Given this screen's stated job is "find one specific entry fast," is a transportadora search and/or date-range filter already planned, or does the current status/tipo-only filter set reflect an intentional scope cut for now?
