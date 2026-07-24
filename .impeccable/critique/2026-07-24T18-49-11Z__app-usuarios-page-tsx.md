---
target: /usuarios
total_score: 21
p0_count: 1
p1_count: 2
timestamp: 2026-07-24T18-49-11Z
slug: app-usuarios-page-tsx
---
# Critique Report - /usuarios (User & Access Management)

**Scope note (methodology honesty):** This session had no live browser-automation tool available (the Playwright MCP tool referenced in the brief was not present in the executing agent toolset - only Read/Grep/Glob/Bash were available). The dev server was confirmed reachable (GET /login -> 200, GET /usuarios -> 200), but the login to create-user to temp-password-reveal to deactivate flow could not be exercised interactively, so no screenshots, focus-tab traces, or rendered-DOM measurements exist for this run. Assessment B is therefore built from: (1) the deterministic detect.mjs scan, and (2) rigorous static analysis of the actual JSX/CSS/server-action source (contrast computed mathematically from the real hex tokens in app/globals.css, focus-visible/tap-target/responsive claims verified by reading the exact selectors and markup, not assumed). Anything that would require a live render (actual computed font metrics, real screen-reader announcement behavior, actual click testing) is flagged as unverified rather than guessed.
## 1. Design Health Score

| # | Heuristic | Score /4 | Notes |
|---|---|---|---|
| 1 | Visibility of system status | 2 | role=status alerts and text+color pills give decent feedback, but no submit is ever shown as in progress (no disabled/pending button state anywhere), and nothing signals that the temporary-password reveal is transient. |
| 2 | Match between system and real world | 3 | Portuguese, operational vocabulary (Marcar enviada, Inativar, Troca obrigatoria) matches how an ops admin actually talks about this workflow. |
| 3 | User control and freedom | 2 | No confirmation or undo before Resetar senha (kills all active sessions instantly) or Inativar (also kills sessions); both fire on a single click inside a dense dropdown. |
| 4 | Consistency and standards | 3 | Follows DESIGN.md tokens (navy authority, pill vocabulary, 8px radius, Surface Low shadow) faithfully. Docked one point for an internal inconsistency (see Priority Issue P2 below): the mark credential sent action uses two different icons in two different places. |
| 5 | Error prevention | 1 | No confirm dialogs on session-killing actions, no client-side duplicate check before submit, no submit-lock (double-click risk), silent server-side truncation of nome/username/email at 180 chars with zero user-facing signal. |
| 6 | Recognition rather than recall | 2 | The one-time temporary password must be manually selected/copied by the admin - there is a Copiar usuario button for username/email but no equivalent copy button for the password itself, forcing error-prone manual selection of a generated string. |
| 7 | Flexibility and efficiency of use | 2 | Search + role/status filters exist and help power users, but there is no bulk action (bulk-create, bulk mark sent) for an admin onboarding several carriers in one sitting. |
| 8 | Aesthetic and minimalist design | 3 | Clean, restrained, on-brand; no glassmorphism, gradient text, or decorative clutter - matches the Torre de Controle Operacional brief well. |
| 9 | Help users recognize/diagnose/recover from errors | 2 | Errors render in a visible alert block (not color-only, good), but the duplicate-username/email error is generic (Verifique se usuario ou e-mail ja existem) and does not say which field collided. |
| 10 | Help and documentation | 1 | No inline guidance anywhere that the temporary password is shown exactly once, no link to a delivery-runbook, no tooltip explaining the Credencial pendente concept for a first-time admin. |
| Total | | 21/40 | Band: Below Average / Needs Improvement. Functional and visually on-brand, but heuristic failures cluster tightly around the exact area flagged as risky in the brief: the one-time-secret handoff and destructive-action safety. |
## 2. Anti-Patterns Verdict

Largely clean of AI-slop / generic-SaaS tells. detect.mjs --json returned an empty findings array with exit code 0 on both target files - no gradient text, no emoji-as-UI, no hero/marketing copy, no unexplained decorative shadows were pattern-matched. Manual reading confirms this holds up: no border-left/border-right color bands, no glassmorphism, no oversized illustration, animations are absent (consistent with prefers-reduced-motion intent). The screen does not look like generic Power BI, a gray spreadsheet, or a SaaS coloridinho template - it matches DESIGN.md restrained navy/pill vocabulary.

The one real anti-pattern found (not caught by the regex scanner, since it is semantic, not syntactic) is icon-meaning drift: the identical action markCredentialSentAction is represented by CheckCircle2 (Marcar enviada, components/UserAdminPanel.tsx:189) in one panel and by Clipboard (Credencial enviada, components/UserAdminPanel.tsx:313) in another - Clipboard is also the exact icon used for the unrelated Copiar usuario action two lines above it (components/UserAdminPanel.tsx:306-308), so a user scanning the dropdown could easily mistake Credencial enviada for a second copy action rather than a confirmation. This reads like a copy-paste artifact rather than intentional design.

---

## 3. Overall Impression

This is a competent, on-brand internal tool that clearly followed the design system for layout, color, and typography - it does not look slapped-together, and the backend engineering underneath (unique DB constraints, CSRF same-origin check, session invalidation on reset/deactivate) is genuinely solid. The problem is not visual polish; it is that the screen single riskiest interaction - showing a one-time secret that an admin must relay to a real carrier employee - receives the least dedicated design attention on the page. There is more visual investment in the filter toolbar than in the password-reveal moment, even though BACKLOG.md explicitly flags this as a partial/active-risk area. Destructive-ish actions (reset password, deactivate) sit one click away in a compact dropdown with no confirmation, which is inconsistent with the confiavel brand personality PRODUCT.md asks for. Nothing here is unusable, but the gap between looks trustworthy and behaves with the caution its consequences deserve is the core finding of this review.

---

## 4. What Is Working

- On-brand visual system: navy authority color, pill status vocabulary, 8px radius, Surface Low shadow - all match DESIGN.md tokens exactly, verified against the real hex values in app/globals.css.
- Status never relies on color alone: every pill (Ativo/Inativo, Troca obrigatoria/Atualizada, Enviada/Pendente) pairs color with explicit text, satisfying PRODUCT.md accessibility principle.
- Contrast is genuinely good where it counts. Computed WCAG ratios from the real tokens: text-subtle on white 7.89:1, warning-text on warning-bg 6.37:1, success-text on success-bg 6.49:1, danger-text on danger-bg 6.80:1, navy on white 15.12:1 - all comfortably pass AA, several pass AAA.
- Dedicated Entrega de credenciais queue (components/UserAdminPanel.tsx:162-202) is a genuinely good IA decision: it separates accounts with an unsent temp password from the full roster, which is exactly the kind of task-oriented surface PRODUCT.md design principles ask for.
- Search + role/status filters are labeled with aria-label/sr-only correctly, and the roster count vs visible count ({visibleUsers.length} visiveis) gives useful state feedback.
- Server-side safety net is real: unique constraints on username/email at the Prisma schema level prevent a double-submit race from creating duplicate accounts, and both reset-password and deactivate correctly call prisma.appSession.deleteMany to kill live sessions - these are the right calls even if the UI does not warn the admin about them.
- Responsive collapse exists: the 820px breakpoint correctly stacks .form-grid, .user-toolbar, and page headers into a single column rather than squeezing them.

---

## 5. Priority Issues

**P0 - One-time temporary password has no copy affordance and is provably unrecoverable on refresh.**
- **What:** ActionMessage (components/UserAdminPanel.tsx:49-63) renders the generated password only as plain code>{state.temporaryPassword}</code> inside transient useActionState client state. There is a copyText() helper and a Copiar usuario button for username/email in two places (:183-185, :306-308), but no equivalent button for the password itself - the admin must manually select the text. Because the password lives only in useActionState, any page refresh, navigation, or accidental back/forward loses it permanently (confirmed by reading the state wiring - createAppUser/resetAppUserPassword never persist the plaintext password server-side, which is correct for security, but the UI gives zero warning that this is a now-or-never moment).
- **Why:** This is the exact flow flagged as an active risk area in BACKLOG.md (onboarding real das transportadoras - parcial). A lost or mistyped temp password means a full reset cycle (which itself kills sessions) just to recover from a UI omission, and it directly blocks a real carrier employee from logging in.
- **Fix:** Add a dedicated Copiar senha button next to the code block, make the code block visually distinct as click to copy, and add an explicit warning line (Esta senha so aparece uma vez, copie e envie agora.) right above the credential box.
- **Suggested command:** harden

**P1 - No confirmation before session-killing actions (reset password, deactivate).**
- **What:** ResetPasswordForm (:65-77) and the Inativar/Ativar form (:316-322) submit on a single click inside a compact details dropdown, with no confirm dialog, modal, or are-you-sure step, even though both immediately invalidate the user active sessions (app/user-actions.ts:98, :113-115).
- **Why:** Both actions are one accidental click away from locking out a real, currently-working carrier account, and the dropdown menu (row-action-panel, :305-323) places Resetar senha, Credencial enviada, and Inativar tightly stacked with identical button styling, making a fat-finger mis-click plausible, especially on mobile where the table already forces horizontal scrolling.
- **Fix:** Add a lightweight inline confirm step (toggle to a Confirmar inativacao state on first click) for both actions, at minimum for deactivate on non-self accounts.
- **Suggested command:** harden

**P1 - No pending/disabled state on any submit button (double-submit risk).**
- **What:** None of the four server-action forms (create user, reset password, mark credential sent, set status) use useFormStatus or any pending flag to disable the button or show a busy state while the action resolves - confirmed by grep, useFormStatus is not imported anywhere in the file.
- **Why:** This is exactly the Riley stress scenario (submit twice fast). For createAppUser the DB unique constraint prevents a true duplicate, but the admin still gets no feedback that the request is in flight, and for resetAppUserPassword a rapid double-submit could silently generate two different temporary passwords in succession - whichever the admin copies first is invalidated the instant the second completes.
- **Fix:** Wrap submit buttons in a status-aware component (useFormStatus) to disable and relabel (Enviando...) during submission.
- **Suggested command:** polish

**P2 - Icon-action mismatch for mark credential sent.**
- **What:** The identical markCredentialSentAction is rendered with CheckCircle2 (Marcar enviada, :189) in the pending-credentials panel, but with Clipboard (Credencial enviada, :313) in the per-row action menu - the same Clipboard icon used one button above it for the unrelated Copiar usuario copy action (:306-308).
- **Why:** Icon semantics drift within the same screen for the same action, which reads as a copy-paste bug and can make an admin think Credencial enviada copies something rather than confirms delivery.
- **Fix:** Standardize on CheckCircle2 for both instances of mark sent.
- **Suggested command:** clarify

**P2 - Missing focus-visible styling, sub-spec tap targets, and forced horizontal scroll for the roster on mobile.**
- **What:** The custom focus-ring rule in app/globals.css:1321-1329 only targets .field input/select/textarea, .btn, .nav a, .nav-button. The toolbar search input and role/status select elements (components/UserAdminPanel.tsx:219-244) are not wrapped in .field, so they fall outside this rule and get only the browser default outline. Those same controls are set to min-height: 36px (app/globals.css:1655-1663), below both the design system own 40px input spec and the roughly 44px mobile tap-target guideline. Separately, .table-wrap > table { min-width: 920px; } (app/globals.css:350-352) has no mobile override, so the 8-column roster table forces horizontal scrolling on a 390px viewport with no stacked/card fallback (unlike the credential-pending list, which already uses a card layout).
- **Why:** PRODUCT.md explicit UX priority number 4 is Garantir foco visivel, contraste e estados de erro/disabled em todos os controles - this screen does not fully meet its own stated bar, and a first-time mobile admin (Jordan) has to scroll sideways through 8 columns to reach the Acoes menu.
- **Fix:** Extend the focus-ring selector to cover .user-toolbar select and .user-search input; bump their min-height to 40-44px; add a card/stacked variant of the roster table under the existing 820px breakpoint.
- **Suggested command:** adapt

---

## 6. Persona Red Flags

**Alex (power admin, does this daily):** The credential-delivery queue is a genuine efficiency win, but there is no bulk action - creating 5 carrier accounts in one sitting means repeating the full create-copy-relay-mark-enviada cycle five times with no shortcut, and each temp password must be hand-copied since there is no copy button for it (P0). Over many repetitions, the missing pending/disabled state (P1) also means Alex has no positive signal that a fast double-click did not do something unexpected.

**Jordan (first-time internal admin):** Nothing on screen tells Jordan the password is one-time-only or that it disappears on refresh - this is discoverable only by losing it once (P0). The generic duplicate-username/email error message does not say which field collided, so Jordan cannot self-correct without guessing. The dropdown-menu affordance for destructive actions (no confirm, P1) is exactly the kind of thing a first-timer clicks without understanding the blast radius (killing a real carrier active session).

**Sam (accessibility):** Structurally sound - labeled inputs, sr-only search label, aria-label on filters, native details/summary for the row menu (keyboard-operable by default), status alerts use role=status. The gap is the toolbar search/filter controls falling outside the app custom focus-ring rule (P2) and running below the design system own tap-target sizing - a real but narrower gap than the P0/P1 items above.

**Riley (stress test - duplicate ids, long names, double submit):** Duplicate username/email is caught server-side by the DB unique constraint and surfaces a (generic) error - no crash, no duplicate row. Very long nome/username/email values are silently truncated at 180 characters server-side (app/user-actions.ts:19-21) with no client-side maxLength and no user-facing truncation notice - data loss with zero feedback. Rapid double-submit is not blocked at the UI layer (P1); for createAppUser the DB constraint is the only safety net, and for resetAppUserPassword a fast double-click can generate two competing temp passwords with no lock to prevent it.

---

## 7. Minor Observations

- Generated temporary passwords use randomBytes(9).toString(base64url) (app/user-actions.ts:23-25), which can include visually ambiguous characters (l/1/I, 0/O) - a real concern given the password is meant to be manually read/typed/relayed to a non-technical carrier employee, not just pasted.
- .btn.disabled text-on-background contrast computes to roughly 3.24:1 (#7b8da4 on #f8fafc) - below AA 4.5:1, though WCAG does not strictly require disabled-control contrast; still worth a look given the product stated AA target.
- Multiple per-row details action menus can be open simultaneously (no auto-close of siblings), which could get visually noisy in a longer roster.
- The Copiar usuario button appears identically in two different contexts (pending-credentials panel and row menu) - good repetition, not a problem, just noted for contrast against the icon-drift issue above.
- The current-admin own row correctly hides all destructive actions behind a plain Conta atual pill - a good, quiet safety default.

---

## 8. Questions to Consider

- Should the temporary-password reveal be treated as its own focused step (e.g., a modal/panel that must be explicitly dismissed with a copiei-e-enviei acknowledgment) rather than an inline alert that can be scrolled past or lost on refresh?
- Given this flow hands real credentials to real carrier staff, should password generation avoid visually ambiguous characters, since the delivery channel (phone/email/WhatsApp) is often manual, not copy-paste?
- Should Resetar senha and Inativar require a typed or two-step confirmation, given both immediately terminate a live session for a real user?
- Is there a need for a lightweight audit trail beyond credentialSentAt/credentialSentBy - e.g., who generated/reset which password and when - given this is flagged as an active operational-risk area?
- Would bulk operations (create several carrier accounts, mark several credentials sent) meaningfully reduce Alex repetitive load during onboarding batches?
