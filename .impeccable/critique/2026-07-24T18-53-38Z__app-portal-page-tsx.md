---
target: /portal
total_score: 28
p0_count: 0
p1_count: 1
timestamp: 2026-07-24T18-53-38Z
slug: app-portal-page-tsx
---
# Critique: Carrier Portal Landing (/portal, app/portal/page.tsx)

## 1. Design Health Score

| # | Heuristic | Score /4 | Notes |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Today's status (Pendente/Enviado) is shown via card + pill + icon, but no submission deadline/time-window is surfaced anywhere. |
| 2 | Match between system and real world | 3 | Plain Portuguese, no jargon; the XCircle icon for "Pendente" reads as error/failure rather than neutral waiting. |
| 3 | User control and freedom | 3 | Clear nav (Início/Sair), history link present, no dead ends. |
| 4 | Consistency and standards | 2 | Two primary-styled buttons ("Enviar relatório" / "Abrir formulário") with different copy point to the identical route; icon semantics inconsistent with color semantics elsewhere in the system. |
| 5 | Error prevention | 3 | Nothing destructive on this screen; EmptyState guards the "no transportadora" / "no submissions" cases. |
| 6 | Recognition rather than recall | 4 | Status, recent count, and history table are all visible without requiring memory. |
| 7 | Flexibility and efficiency of use | 2 | Daily user (Alex) still has to disambiguate two identical-destination CTAs every single visit; no shortcut, no "resume draft" signal. |
| 8 | Aesthetic and minimalist design | 3 | Clean, on-brand, restrained palette per DESIGN.md; dinged only for the redundant CTA clutter. |
| 9 | Help recognize/diagnose/recover from errors | 3 | Mostly N/A for a landing screen; EmptyState copy is action-oriented. |
| 10 | Help and documentation | 2 | No inline help/tooltip for terms like "rascunho" vs "enviado"; no link to the operational manual added elsewhere in the repo. |

Total: 28/40 -- "Solid, needs targeted polish." The page is not broken or confusing in a gross sense, but a first-time user pays a small comprehension tax and a daily user pays a small friction tax, on a screen whose entire job is to minimize both.

## 2. Anti-Patterns Verdict

node detect.mjs --json app/portal/page.tsx returned exit code 0, findings: [] (empty array).

No AI-slop markers (gradients, glassmorphism, emoji abuse, decorative motion, generic fonts) were detected, and that matches manual inspection -- the file has no inline styles, no ad-hoc color literals, and reuses the shared card/btn/pill vocabulary from app/globals.css correctly. This is a true negative, not a blind spot exploited by bad code: the component is disciplined about using the design system's existing classes. The detector's regex/AST rules are simply not scoped to catch IA-level problems (duplicate CTAs, icon-semantic mismatches, missing deadline copy) -- those require the browser-based/persona review below, which is where this critique's real findings live.

## 3. Overall Impression

The landing screen does the core job: within about two seconds a carrier operator can see whether today's report is pending or sent, and there is always a visible path to the form. Visual language is faithful to DESIGN.md -- navy authority color, semantic top-border on cards, no side color rails, no decorative shadow, restrained typography scale. The problems are not visual polish problems; they are small IA/copy decisions that quietly add friction for exactly the persona this screen exists to serve (someone acting fast, first thing in the morning, under deadline pressure). The biggest single issue -- two visually-primary buttons with different labels going to the same place -- is the kind of thing that looks harmless in isolation but erodes trust (which one is the real button?) the first time a user notices it, and costs a beat of hesitation every time thereafter.

## 4. What's Working

- Status is never ambiguous about color alone. Pendente/Enviado always ships with text label + icon + border color, satisfying DESIGN.md's rule to not depend on color alone.
- Empty states guide the next action. Both the no transportadora and no submissions states use EmptyState with explicit copy and, in the submissions case, a direct CTA to the form (app/portal/page.tsx lines 105-110).
- Design system fidelity. Cards, buttons, pills, table styling all reuse existing tokens/classes with zero one-off inline styling -- exactly what DESIGN.md's Almost Flat and Navy Authority rules ask for.
- Focus is visible and keyboard order is logical. Tabbing through the page (verified live) moves nav, then primary CTA, then in-card actions, then table row actions, matching DOM/visual order, with a visible outline on every stop.
- Mobile tap targets meet 44px. The mobile stylesheet override (.btn min-height 44px under the 820px breakpoint) is correctly applied to every button, including the compact table-row Relatório links.
- Freshness is at least present. The status card explicitly states the report date, so the screen never leaves the user guessing which day's status they are looking at.

## 5. Priority Issues

P1 - Duplicate primary CTA with inconsistent copy, same destination
- What: app/portal/page.tsx lines 53-55 render a Link with class btn (Send icon) labeled Enviar relatorio in the page header, and lines 88-90 render a second Link also with class btn (ClipboardList icon) labeled Abrir formulario in the Rotina diaria card -- both navy primary-styled, both pointing at the exact same formPath (/portal/formulario).
- Why: Two identically-weighted primary buttons with different verbs (Enviar implies submitting now, Abrir implies navigating to edit) create a false choice. First-time users (Jordan) hesitate over which one is the action; daily users (Alex) re-litigate the same non-decision every single morning. It also weakens whether the CTA is visually dominant -- nothing on the page distinguishes ONE button as more important than the other navy/secondary buttons.
- Fix: Pick one destination-CTA per page and make it the only primary-styled (navy fill) button; demote the second occurrence to btn secondary or remove it, and make the copy match the actual behavior (both currently just navigate, so both should say Abrir formulario, or the header one should say Preencher relatorio de hoje to read as an invitation, not a completed action).
- Suggested command: clarify

P2 - No submission deadline/time-window shown, despite it being the stated reason this screen exists
- What: PRODUCT.md states carriers use this portal mostly at the start of the day, before the expected submission time, yet nothing in app/portal/page.tsx (the Status de hoje card, lines 59-66, or the Rotina diaria panel, lines 79-95) states what that expected time is, or how much time remains.
- Why: For the primary persona (rushed morning operator), Pendente without a deadline reference is missing the single most decision-relevant fact: whether there is time to spare or the report needs to happen right now.
- Fix: Add a short deadline line to the status card, e.g. Envie ate 09:00, or a countdown once that business rule exists in the data model, sourced from wherever the SLA/deadline is currently configured for the report job.
- Suggested command: clarify

P2 - Pendente status uses an XCircle (X-in-circle) icon, which reads as error/failure rather than neutral waiting
- What: app/portal/page.tsx line 62 renders an XCircle icon (size 28) for the not-yet-submitted state, paired with the orange metric-card border.
- Why: X-in-a-circle is a near-universal wrong/cancelled/failed glyph. Pairing it with orange (DESIGN.md's atencao, not erro) sends two different semantic signals at once -- a first-timer glancing at the card can read it as something went wrong instead of you have not submitted yet, act soon.
- Fix: Swap to a neutral waiting icon (clock/hourglass, e.g. Clock from lucide-react) for the pending state, reserving X/failure icons for actual error or rejected-report states elsewhere in the app.
- Suggested command: bolder (icon/semantic clarity is part of visual hierarchy work), alternatively clarify if scoped narrowly to copy/iconography.

P3 - Muted subtitle text is under the 4.5:1 AA contrast minimum when placed directly on the page background
- What: app/portal/page.tsx line 51 (the muted paragraph showing the transportadora name) sits directly on .shell's var(--bg) (#f4f7fb), not inside a .card. Measured in-browser: rgb(100,116,139) on rgb(244,247,251) equals 4.43:1 (fails the 4.5:1 AA threshold for 16px/400-weight text by a small margin). The same .muted class measured on white card surfaces elsewhere on the page comes in at 4.76:1 (passes).
- Why: DESIGN.md explicitly lists WCAG AA contrast as a baseline and visible focus plus contrast on all controls as a current UX priority; this is a small, real, borderline miss on exactly that commitment.
- Fix: Darken --gray slightly (e.g., toward #5b6b80) or restrict .muted usage directly on --bg to bold/larger text, so the ratio clears 4.5:1 in both contexts.
- Suggested command: polish

P3 - History table has no scroll affordance on mobile
- What: .table-wrap (app/globals.css lines 342-352) sets overflow-x auto with a 920px min-width on the inner table, so on the 390px mobile viewport the Total de pedidos, Enviado em, and Acoes columns are off-screen with no visual hint (shadow/fade/scroll indicator) that horizontal scrolling is available.
- Why: Casey (distracted, on a phone) may not realize there is more to see and could miss whether a report actually went through, or dismiss the row info as unavailable.
- Fix: Add a subtle edge-fade or a short drag to see more caption under the table on small viewports, consistent with how the design system already documents captions for charts.
- Suggested command: polish

## 6. Persona Red Flags

- Jordan (confused first-timer): Sees an orange card with an X-icon reading Pendente -- a plausible split-second read as something is wrong, not you have not sent today's report yet. Then faces two navy buttons (Enviar relatorio top-right, Abrir formulario mid-page) with no obvious reason to prefer one, and no explanation of what Rascunho vs Enviado means anywhere on the page or via tooltip/help link.
- Casey (distracted, on mobile, rushing out the door): Has to scroll past a fairly tall stacked topbar (brand block, Portal/Inicio pill row, Demo Claude Teste/Sair row) and page title before reaching the CTA; on a real phone with browser chrome eating vertical space, the primary action may sit right at or below the fold on first paint. The history table silently truncates with no scroll cue.
- Sam (accessibility): Status is communicated redundantly via text plus color plus icon (good). Keyboard focus order matches visual/DOM order and every interactive element shows a visible outline (verified live via Tab-walk). Two soft spots: the muted subtitle's borderline text contrast (4.43:1, see P3 above), and the focus ring's use of a low-opacity blue (rgba(37,99,235,0.28)) which is visually present but worth an explicit contrast-tool check against WCAG 1.4.11's 3:1 non-text minimum -- it looked thin/pale in the on-screen captures.
- Alex (daily power user, wants zero friction): Pays the which-button tax from the P1 issue every single day, the highest-frequency user of exactly the flaw that matters least to a first-timer and most to a returning user. No shortcut, no you-have-a-saved-draft state distinct from start fresh, no glanceable historical pattern (e.g., you usually submit by 8:10am).

## 7. Minor Observations

- formatBrazilianDate (lib/dates.ts lines 14-16) renders date-only, no time -- acceptable for a once-daily grain, but means Enviado em in the history table cannot help a user distinguish an early vs late submission on the same day.
- The Ultimos relatorios metric card correctly hedges its count as recent records available for consultation rather than implying a lifetime total, even though the underlying query caps at take: 8 (app/portal/page.tsx line 24) -- good, non-misleading copy, no action needed.
- Status de hoje (metric card) and the Aguardando envio pill in Rotina diaria repeat the same fact in two places on the same screen; mildly redundant but low-risk since it reinforces rather than contradicts.
- No console errors were observed on page load at either desktop or mobile viewport during this session.

## 8. Questions to Consider

- Is there a real, product-configured deadline time per transportadora (e.g., stored alongside SLA config) that could be surfaced on this screen, or does the expected submission time only exist informally today?
- If a draft submission already exists for today, should the CTA copy/behavior differ from the nothing-submitted-yet case (e.g., Continuar rascunho vs Preencher relatorio)? The current component does not appear to distinguish these two states in its call-to-action language.
- Is the duplicated CTA (header + card) intentional redundancy for scannability, or accidental drift from two people adding an obvious button to the form in two different PRs?
- Would a link to the newly-added operational HTML manual (per recent git history) belong on this screen for first-time users, given there is currently no in-app help affordance here?
