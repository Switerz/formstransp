---
target: /historico/[transportadoraId]
total_score: 22
p0_count: 1
p1_count: 2
timestamp: 2026-07-24T18-48-19Z
slug: app-historico-transportadoraid-page-tsx
---
# Critique: /historico/[transportadoraId]

Target: app/historico/[transportadoraId]/page.tsx
Slug: app-historico-transportadoraid-page-tsx

Methodology note: no browser-automation tool (Playwright MCP) was exposed in this
session toolset, so browser evidence below is derived from (a) the deterministic
detector, (b) a curl-based fetch of the app unauthenticated HTML/CSS to confirm real
rendered markup and structure (the login flow uses a React Server Action form, which is
not trivially replayable with curl, so authenticated screenshots at 1440px/390px could
not be captured in this run), and (c) static analysis of app/globals.css design tokens
(contrast values, focus-ring color, breakpoints, tap-target sizing) cross-referenced
against DESIGN.md. Anything that genuinely requires a rendered screenshot (real
anti-aliased contrast, live tab-order confirmation) is flagged as needs live
re-verification rather than asserted as directly observed.

## 1. Design Health Score

| # | Heuristic | Score /4 | Notes |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Filter values persist in the form after submit (good), but there is no result count or applied filters summary near the table, and no data-freshness indicator. |
| 2 | Match between system and real world | 3 | pt-BR labels, Brazilian date formatting via Intl, business vocabulary (Rascunho/Enviado/Validado/Disparado). |
| 3 | User control and freedom | 3 | Limpar is a real link to the unfiltered URL (no JS-only reset), Voltar link present, no destructive actions on this screen. |
| 4 | Consistency and standards | 1 | Status pill is hardcoded to the ok (success/green) class for every status, while the same pill pattern is implemented correctly (conditional ok/pending) in app/portal/page.tsx and app/automacoes/logs/page.tsx. This screen is the outlier. |
| 5 | Error prevention | 1 | No guard against dataInicio greater than dataFim; no min/max wiring between the two native date inputs; invalid ranges are accepted silently. |
| 6 | Recognition rather than recall | 2 | Filter inputs retain their submitted values (good), but there is no persistent summary once scanning the table below the fold. |
| 7 | Flexibility and efficiency of use | 2 | No quick-range presets (last 7/30 days), no saved filters, no pagination/limit on the query for carriers with long history. |
| 8 | Aesthetic and minimalist design | 3 | Clean, on-brand with DESIGN.md, no decorative clutter, matches card/table spec almost exactly. |
| 9 | Help users recognize/diagnose/recover from errors | 2 | Empty state gives a generic, always-the-same message regardless of whether it is true zero history, a filter that matched nothing, or an inverted date range. |
| 10 | Help and documentation | 2 | No inline hints on filters; acceptable for an internal tool but nothing communicates expected date range behavior. |

Total: 22/40 - Needs improvement.
(Band: 34-40 Excellent | 26-33 Good | 16-25 Needs improvement | 0-15 Poor/rework)
## 2. Anti-Patterns Verdict

Clean, with one manual-review-only exception. The deterministic scanner (detect.mjs)
returned an empty finding set (exit code 0): no gradients, no glassmorphism, no emoji, no
marketing copy, no oversized border-left accent bars, nothing the regex-based detector
flags as AI-slop. The page is visually restrained and matches DESIGN.md Torre de
Controle aesthetic (Arial, navy authority color, flat cards, 8px radius, no ornament).

However, manual review found a semantic-color anti-pattern the static detector cannot
catch: className="pill ok" is applied unconditionally to every submission status
(page.tsx:110), including draft (Rascunho), which is not success/ok by any reading of
DESIGN.md own rule (verde, ambar e vermelho sao estados; se a cor nao ajuda a decidir, nao
use). This is a logic bug wearing a clean-looking wrapper, not a visual one, exactly the
kind of thing a regex scanner will miss and a human walkthrough catches.

## 3. Overall Impression

This is a quiet, unadorned screen doing one job: filter and list a carrier submission
history, with a link out to each day report, and it mostly succeeds at looking like a
tool, not a dashboard demo. There is no visual noise, the empty state is handled, mobile
breakpoints collapse the filter grid sensibly, and the labels/inputs follow accessible
basics (real label-for, native date pickers). The problem is not decoration; it is
behavior. The status column, the single most important piece of scannable information on
an audit screen like this, currently tells every viewer everything is fine regardless of
whether a day is still a draft or fully validated, which quietly undermines the exact
audit workflow this page exists for. Combine that with no validation on the date range and
a one-size-fits-all empty-state message, and the page reads as correct-looking rather
than correct.
## 4. What is Working

- Layout and tokens are faithful to DESIGN.md: navy authority color, table-header
  background, 1px line borders, 10px/8px cell padding, no shadows beyond Surface Low on
  the card, no Power-BI-generic or spreadsheet-gray drift.
- All three filter fields have proper label-htmlFor pairing (page.tsx:64-79); native
  input type=date sidesteps date-format ambiguity and gives a real OS date picker.
- Limpar (Clear) is a genuine Link to the base URL rather than a JS-only reset, works
  without JS, is keyboard-reachable, and produces a truly clean state.
- Empty state reuses the shared EmptyState component with an actionable CTA (Limpar
  filtros), matching DESIGN.md rule that empty states must orient the next action.
- Mobile breakpoint at 820px correctly collapses the 2-column form-grid to one column and
  expands .btn to width 100 percent / min-height 44px for a real tap target.
- requireTransportadoraAccess (lib/auth.ts:121) correctly scopes carrier-role users to
  their own transportadora and redirects everyone else to /portal, so the authorization
  boundary at the page level is sound.

## 5. Priority Issues

P0 - Status pill always renders as success regardless of actual status
- What: className="pill ok" (page.tsx:110) hardcodes the ok (green/success) pill class for
  every row, whether the status is draft, submitted, validated, or sent.
- Why: This is the audit screen primary scan signal. A Rascunho (draft, not yet submitted)
  showing as a green success pill directly contradicts PRODUCT.md principle 4
  (differentiate pendencia, sucesso e problema sem depender apenas de cor) and DESIGN.md
  Semantic Color Rule. It is also an internal inconsistency: the same status-to-pill logic
  is implemented correctly two other places in this same codebase
  (app/portal/page.tsx:128-129, pill class is pending when status is draft, else ok; and
  app/automacoes/logs/page.tsx:104), making this page a clear regression/outlier rather
  than an ambiguous design choice.
- Fix: Map report.status to the correct pill class (for example pending for draft, and
  decide whether submitted should also read as pending-until-validated/sent).
- Suggested command: colorize

P1 - No validation on invalid date range (start after end), and identical empty-state copy
for every zero-result cause
- What: dateFilter is built directly from filters.dataInicio/dataFim (page.tsx:27-35) with
  no check that dataInicio is before or equal to dataFim, and no max/min HTML attribute
  links the two date inputs. If a user (Riley) sets start after end, Prisma silently
  returns zero rows and the page renders the exact same EmptyState copy (Ajuste os filtros
  ou aguarde o primeiro envio da transportadora) used for a carrier with genuinely no
  history yet.
- Why: The message is misleading in the most common Riley-style mistake case: it never
  tells the user their range is inverted, and it never distinguishes zero results because
  of the filter from zero results because the carrier never submitted anything, so a user
  cannot tell which corrective action actually applies.
- Fix: Add a lightweight server-side check that swaps or rejects an inverted range with an
  explicit inline alert (per DESIGN.md Inputs/Fields rule that errors must appear in an
  alert block with explicit text), and branch the empty-state copy based on whether any
  filter is currently applied.
- Suggested command: harden

P1 - No visible summary of the filters currently applied to the list below
- What: Once the table is in view, the only evidence of what is being looked at is the
  retained values inside the visually identical, not marked as active, filter form above
  it; there is no line like Mostrando 2 relatorios, 16/06 a 19/06/2026, Status: Enviado
  near the table itself.
- Why: For Alex (a power user auditing this screen repeatedly, often across multiple
  carriers/tabs), losing track of which range/status is currently applied is an easy way
  to misread a filtered subset as the full history, or vice versa, exactly the clareza
  operacional DESIGN.md asks for.
- Fix: Add a small filter-summary/result-count strip between the form and the table.
- Suggested command: clarify

P2 - Unbounded query with no pagination or default window
- What: prisma.dailyReportSubmission.findMany (page.tsx:42-50) has no take/skip and no
  default date range is pre-applied on first load; a carrier with a year of daily
  submissions would render the full history in one unpaginated, horizontally-scrolling
  table (table-wrap greater-than table has min-width 920px, globals.css:350-352).
- Why: This is exactly the kind of complexity PRODUCT.md anti-overengineering framing asks
  to anticipate (what would break first as usage grows); today demo carrier has 2 rows,
  but this is the long-history screen by definition.
- Fix: Add pagination or default to a trailing window (for example last 30 days) with an
  explicit carregar mais / ver historico completo affordance.
- Suggested command: optimize

P3 - Minor copy/data-mapping nits
- What: (a) Table header Acoes (plural) labels a single action link per row; (b) the
  Total de pedidos column reads from report.previousDayMetrics?.totalPedidos
  (page.tsx:111), worth confirming this relation genuinely represents that day total and
  not the prior day, since a mislabeled number on an audit table is a trust issue per
  PRODUCT.md (transmitir controle e confianca nos numeros).
- Fix: Rename header to singular, or add a second action; confirm/rename the metrics
  relation or column label.
- Suggested command: audit
## 6. Persona Red Flags

Alex (power user auditing carrier history regularly)
- Every status now reads as a green success pill; Alex can no longer visually triage which
  days are still drafts versus fully validated/sent at a glance, which is the entire point
  of an audit table like this (P0 above).
- No quick-range presets or saved filters; Alex must retype the same date range every
  session, and once scrolled into the table there is no persistent reminder of what is
  currently filtered (P1s above).

Sam (accessibility)
- All three filter fields have correct label-htmlFor pairing, a good baseline.
- The focus style for text/date/select fields is .field input:focus with outline 3px solid
  var(--focus-ring), where --focus-ring is rgba(37, 99, 235, 0.28) (globals.css:18,1327), a
  translucent blue at low opacity over a white surface that blends to a very light tint;
  this likely falls short of WCAG 1.4.11 3:1 non-text contrast requirement. This is a
  code-level observation and needs live re-verification in a rendered browser to confirm
  the actual on-screen contrast ratio.
- The table has a proper thead/th structure but no caption and no scope=col on header
  cells; a screen reader user landing inside the table gets column labels but no
  table-level summary of what it represents.
- Every row action link renders identical visible text, Abrir relatorio (page.tsx:115),
  with no per-row differentiator in the accessible name (for example the date). A
  screen-reader user tabbing through a list of same-named links loses track of which
  row/day each link opens, a real WCAG 2.4.4/2.4.9 Link Purpose concern for a table where
  every row shares the same CTA text.

Riley (stress test: invalid range, no results, very old dates)
- Start date after end date: accepted silently, returns the same generic no reports empty
  state as true zero-history; never surfaces that the range itself is invalid (P1 above).
- A valid but non-matching filter (for example a status filter that matches nothing while
  other statuses do exist): same static copy, Ajuste os filtros ou aguarde o primeiro
  envio da transportadora, which reads as nonsensical when the carrier clearly already
  has history, just not matching this filter; the message assumes no submissions ever
  rather than no submissions matching this filter.
- Very old / out-of-range dates: no min/max bound on the date inputs, so nothing stops an
  implausible year from being typed; the query degrades gracefully to zero rows rather
  than erroring, so there is no crash risk, but again with the same undiagnostic copy.

## 7. Minor Observations

- .field input:focus (not :focus-visible) means date/status inputs show their outline
  ring on mouse click too, not just keyboard focus; harmless, but inconsistent with the
  :focus-visible-gated buttons/links elsewhere in the same file (globals.css:1321-1329).
- No default date range is pre-applied on first visit; a long-lived carrier first render
  of this page is its entire unfiltered history.
- Table forces min-width 920px (globals.css:351), so on a roughly 390px mobile viewport
  the table will horizontal-scroll; this matches DESIGN.md tabela densa stance but means
  the Abrir relatorio action sits off-screen until the user scrolls right, worth a live
  mobile check to confirm how discoverable that is in practice.
- statusLabels fallback (double-question-mark report.status) would print a raw enum value
  if a new status is ever added without updating this map; low risk, but worth a
  lint/type-level guard.

## 8. Questions to Consider

- Should the empty state distinguish zero history ever from zero matches for the current
  filter, and if so, what is the right copy for each case?
- Should an inverted date range (start after end) be auto-corrected, blocked with an
  inline alert, or is silent empty-result acceptable for an internal tool used by a small,
  trusted ops team?
- Is there an expected upper bound on submissions-per-carrier that should drive adding
  pagination or a default trailing window now, rather than after someone hits a 300-row
  table?
- Should the four statuses (Rascunho/Enviado/Validado/Disparado) collapse to the existing
  2-color pill vocabulary (ok/pending), as app/portal/page.tsx does, or does this specific
  audit view warrant a 3rd/4th state to distinguish submitted-but-not-yet-validated from
  validated from sent?
- Is previousDayMetrics.totalPedidos the intended source for the Total de pedidos column,
  and if so, should the column be renamed to avoid implying same-day totals?
