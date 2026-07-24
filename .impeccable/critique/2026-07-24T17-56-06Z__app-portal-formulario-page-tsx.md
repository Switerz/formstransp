---
target: /portal/formulario
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-07-24T17-56-06Z
slug: app-portal-formulario-page-tsx
---
## 1. Design Health Score

| # | Heuristic | Score /4 | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Live consistency check ("Totais consistentes ate aqui.") and the 11h deadline pill are good, but there is no draft-saved timestamp and no loading/pending state on submit buttons, so a slow submit gives no feedback. |
| 2 | Match Between System and Real World | 3 | Field labels use real logistics vocabulary (No prazo, Devolucao, Finalizado). The UF grid abbreviates to bare "D"/"F" letters (aria-label carries the full text, but sighted users must infer the meaning visually). |
| 3 | User Control and Freedom | 1 | Once a report is submitted/validated/sent for today, the form is fully locked with zero in-app edit/undo path; correction requires manually contacting the internal team out of band. |
| 4 | Consistency and Standards | 3 | Tokens from DESIGN.md are mostly honored, but compact-report-form field input (36px) and uf-compact-row input (32px) both undercut the documented input height token (40px). |
| 5 | Error Prevention | 2 | The live client-side check is a good proactive idea, but it only manifests as one text block far from the offending fields, with no per-field marker at all. |
| 6 | Recognition Rather Than Recall | 3 | Previous submission values pre-fill Dia anterior/Previa atual/UF grid and the responsible name/e-mail, a strong recall reduction. Slightly undercut because it is ambiguous whether a prefilled number is yesterday's real value or a leftover to overwrite. |
| 7 | Flexibility and Efficiency of Use | 1 | No bulk actions for the 54 UF fields (no copy previous day, no paste from clipboard/CSV, no way to collapse zero-volume UFs). |
| 8 | Aesthetic and Minimalist Design | 2 | Visual style is restrained and matches DESIGN.md, but the dialogue itself violates minimalism by surfacing 54 UF inputs when, in the observed test data, only about 5 of 27 states ever carry a non-zero value. |
| 9 | Help Recognize/Diagnose/Recover from Errors | 3 | Both the inline JS alert and the server-side redirect banner produce specific, numeric, plain-Portuguese messages. Recovery is still manual/positional. |
| 10 | Help and Documentation | 1 | No tooltip, info icon, or inline hint anywhere in the form explaining metric definitions or the reconciliation rule. |

Total: 23/40 - Acceptable

## 2. Anti-Patterns Verdict

LLM assessment (source read + live render): No AI-slop tells found. No gradient text, no glassmorphism, no decorative side-stripes/border-left accents, no generic hero-metric cards, no stock-photo/illustration filler. Card shape (8px radius), shadow depth, and color usage (navy for authority, semantic red/orange/green reserved for status) all track DESIGN.md faithfully. The form reads as a legitimate dense operational tool, consistent with the "Torre de Controle Operacional" brief.

Deterministic scan:
node detect.mjs --json app/portal/formulario/page.tsx components/DailyReportForm.tsx components/FormConsistencyAlerts.tsx
Exit code: 0
Findings: [] (0 findings across all 3 files)

No file:line hits to report, and no false positives to flag since nothing fired. That said, this is a real limitation worth naming: the detector's regex-based rules target static visual anti-patterns (gradients, glass, decorative borders) and cannot see the behavioral/runtime issues this critique's browser testing surfaced (data loss on failed validation, missing aria-live, sub-token input heights, WCAG-failing border contrast). A clean detector run here should be read as "no slop," not "no issues."

## 3. Overall Impression

This is a serious, disciplined B2B form that clearly took DESIGN.md's restraint to heart. There is no decorative padding to strip out, no gradient to remove, no glass panel to flatten. Recent commits show real effort spent on visual density control, and it shows: 81 fields fit on one screen without feeling like a spreadsheet. But the redesign optimized the container for density more than it optimized the interaction for the specific failure mode this form invites: reconciliation math done under time pressure. The single biggest opportunity is closing the loop between "the numbers do not add up" and "here is exactly which of your 81 fields to fix." Right now that loop runs through a paragraph of prose at the bottom of the page and, on a failed final submit, a full reset of everything the operator just typed.

## 4. What's Working

- Pre-fill from the last submission (previous day metrics, current day preview metrics, UF metrics all default from the last record) removes most of the recall burden for a form this size, a genuinely strong pattern for a daily repeat-entry task.
- The live consistency checker's copy is concrete and numeric ("Pedidos por UF somam 33, mas o total do dia anterior e 999") rather than a generic "invalid form," exactly the kind of actionable-indicator language PRODUCT.md asks for.
- UF inputs carry real aria-labels (for example "AC dentro do prazo") even though the visible label is just "D"/"F," a small but correct accessibility decision that is easy to skip and was not skipped here.

## 5. Priority Issues

P1 - Failed final submit silently discards everything the operator just typed, and can show a contradictory success/error state.
- What: Clicking "Enviar relatorio" with mismatched totals redirects to /portal/formulario?error=... . The redirect carries only the error message in the URL, none of the submitted form data, so the re-rendered form falls back to the last saved snapshot, not what the user just typed. Verified live: typed prev_totalPedidos=55555, submitted, and the field reverted to its old saved value 33. Because the reverted values are themselves internally consistent, the page then shows both the red "Nao foi possivel salvar" banner and the green "Totais consistentes ate aqui" success line at the same time (screenshot: final-after-submit-longwait.png).
- Why it matters: for an 81-field form filled under an 11am deadline, this means every reconciliation mistake costs the operator the entire re-entry of whatever they changed, with a UI that briefly looks self-contradictory. This is the highest-probability support-ticket generator in the whole flow.
- Fix: on validation failure, re-render the form with the submitted values still populated instead of only the last saved snapshot, and suppress or replace the live "consistente" success state whenever a server error is present so the two banners can never coexist.
- Suggested command: harden

P1 - Consistency errors are never attached to the fields they describe.
- What: Both FormConsistencyAlerts (client) and validateSubmissionConsistency (server, app/actions.ts around lines 50-76) produce a flat list of sentences shown in one box, the client one at the very bottom of the page, the server one in a banner at the top after a full-page redirect. Neither highlights a UF row, a status field, or a prazo field.
- Why it matters: the whole point of the client-side checker is to catch mistakes before submit, but a user has to manually map a sentence like "Pedidos por UF somam 33" back to which of 27 UF rows is wrong. With no field-level cue that is mental subtraction across up to 54 inputs, exactly the error-prone task the checker exists to prevent.
- Fix: when a mismatch is detected, mark the contributing section (background tint or icon rather than a decorative border-left, per DESIGN.md's own rule) on the Dia anterior card, the UF card, etc., and/or anchor-link from each alert sentence to the relevant section.
- Suggested command: clarify

P2 - Input borders fail WCAG non-text contrast, and the UF grid's inputs are below comfortable tap-target size.
- What: Measured contrast of the design token input-line (#cbd5e1) against white surface equals 1.48:1 (WCAG 1.4.11 requires 3:1 or higher for UI component boundaries). Measured UF input boxes at both viewports: desktop 88 by 32px, mobile 34 by 32px, both under the 44 by 44 comfortable-tap-target guideline (though both still clear WCAG 2.2 AA's 24 by 24 minimum).
- Why it matters: PRODUCT.md explicitly commits to visible focus, contrast, and error/disabled states on every control as a current UX priority. This measurement is a direct, provable gap against that commitment, and it affects all 81 inputs on the page, not just the UF grid.
- Fix: darken input-line (toward something like #94a3b8, re-check ratio >= 3:1) and bump the UF and compact field input min-heights back toward the 40px input token, at least on the 54 UF fields where mis-taps are costliest.
- Suggested command: polish

P2 - 54 UF fields are shown flat and undifferentiated regardless of whether a carrier ever uses that state.
- What: The UF grid renders all 27 states by 2 fields with no grouping by "has volume" versus "always zero." In the live test data only 5 of 27 states carried non-zero values.
- Why it matters: this is the largest concentration of fields in the form, and per the cognitive-load checklist, chunking to 4 or fewer items per group and progressive disclosure are both violated here. Every operator scans or tabs past roughly 44 zero-value fields to reach the roughly 10 that matter, every single day.
- Fix: default-collapse UFs with zero volume in recent submissions into a compact summary row with an "adicionar UF" affordance, or add a lightweight client-side filter/search above the grid.
- Suggested command: distill

P3 - No inline help for metric definitions or the reconciliation rule itself.
- What: Nothing in the form explains what distinguishes Finalizado from Entregue, why No prazo plus Fora do prazo must equal Total de pedidos, or what to do if the operator does not know a breakdown.
- Why it matters: for a first-time operator, the reconciliation rule is discovered only by failing it. There is no way to learn it up front.
- Fix: a single small "Como preencher" disclosure or tooltip near Identificacao or Dia anterior explaining the reconciliation rule in one sentence, linking to the operational manual already present in the repo.
- Suggested command: onboard

## 6. Persona Red Flags

Jordan (confused first-timer): Nothing on the page explains why the numbers must reconcile before Jordan hits it for the first time; the rule is only revealed by failing it (ties to P3). When Jordan does fail it, the page briefly renders both "Nao foi possivel salvar" and "Totais consistentes ate aqui" at once (P1), which for a first-timer reads as the site being broken rather than as "your last attempt did not save." The three native date inputs each consume 3 or more Tab presses to move through month/day/year segments; a first-timer tabbing through will feel like the form is stuck on the date fields before reaching the 70-plus number inputs.

Sam (keyboard/screen-reader dependent): FormConsistencyAlerts's live region has no aria-live or role="status"/"alert" attribute anywhere in the component; a screen reader user typing corrections gets zero announcement when the alert text changes or clears, and must manually re-navigate to that div after every edit to check whether they are done. The UF aria-labels are a genuine win for Sam. The repeated date-segment Tab stops (confirmed via keyboard trace: activeElement stayed on the same date input across 3-4 consecutive Tab presses) add real friction before Sam even reaches the main data-entry area.

Riley (deliberate stress-tester): Typing prev_totalPedidos = 77777 and hitting "Enviar relatorio" confirmed the entire typed session, including the Observacoes text, is discarded on validation failure and replaced with the last saved snapshot. Riley will find this in seconds and correctly clock it as a data-loss bug, not just an annoyance (P1, verified with screenshots). No max attribute exists on any number input, so Riley can type arbitrarily large integers; intFrom in app/actions.ts only checks Number.isFinite and >= 0, truncating but not capping, worth a follow-up check against the Postgres column type for overflow behavior. No disabled/pending state exists on either submit button, so Riley double-clicking "Enviar relatorio" gets no feedback that a request is in flight (mitigated server-side by the upsert being idempotent on transportadoraId plus dataReport, but the UI gives no indication of that safety net).

## 7. Minor Observations

- The mobile topbar (Portal / Inicio / user name / Sair) stacks to roughly 230px of the 390x844 viewport before any form content appears, pushing "Formulario diario" and the 11h deadline pill below the fold on first paint.
- The UF and compact-field inputs diverge from the DESIGN.md input component spec (40px height) at 32px and 36px respectively; likely intentional for density, but worth codifying as an explicit "compact input" variant in DESIGN.md rather than an undocumented override.
- The setInterval(validate, 500) polling in FormConsistencyAlerts runs continuously alongside an input event listener that already re-validates on every keystroke; the interval appears redundant and recomputes a dozen-plus arithmetic passes over 81 fields every 500ms for the lifetime of the page.
- "D"/"F" column headers in the UF grid rely on the reader already knowing D = dentro do prazo, F = fora do prazo; a one-time legend near the section title would remove the guesswork the aria-labels already quietly resolve for screen readers but not for sighted users.

## 8. Questions to Consider

- Given that most carriers apparently report volume in only a handful of the 27 UFs, is a flat 54-field grid still the right default, or should the product test a "your usual states" shortlist with an escape hatch for the rest?
- Is the current behavior, full data loss and full lock-after-submit with no self-service edit, a deliberate audit-trail decision, or an accidental byproduct of building submit-then-validate instead of validate-then-submit? If deliberate, does the UI need to say so explicitly before the operator loses 15 minutes of typing?
- Since the client-side checker already knows the exact numeric mismatch, would it be simpler to disable "Enviar relatorio" until the live checker is green, rather than letting the user reach the server-side rejection at all?
