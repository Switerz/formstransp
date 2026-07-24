---
target: /login
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-07-24T18-52-20Z
slug: app-login-page-tsx
---
## 1. Design Health Score

| # | Heuristic | Score /4 | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | No pending/disabled state on submit; slow network or double-tap gives zero feedback, inviting repeat clicks that eat into the 8-attempt rate-limit budget (reproduced during this test). |
| 2 | Match between system and real world | 3 | Plain, calm Portuguese copy ("Usuario ou e-mail", "Senha") matches user vocabulary; no format hint/example for the combined identifier field. |
| 3 | User control and freedom | 2 | No "esqueci minha senha" / recovery path; the header's duplicate "Entrar" link is a dead end that doesn't help anyone escape or reset anything. |
| 4 | Consistency and standards | 3 | Button/input heights (38px/40px) and navy/8px-radius language match DESIGN.md well; but the word "Entrar" is reused for both a no-op nav link and the real submit action, and alert/input text renders at browser-default ~16px instead of the design system's 14px body token. |
| 5 | Error prevention | 2 | required + native validation blocks empty submits; rate limiting blocks brute force; but there's no show/hide password toggle and no inline format validation, so typos in a fairly complex password are only caught after a full round trip. |
| 6 | Recognition rather than recall | 3 | Identifier is preserved after a failed attempt (measured: value survives), reducing re-typing; password is correctly cleared. |
| 7 | Flexibility and efficiency of use | 2 | No autoFocus on the identifier field (confirmed absent in app/login/page.tsx), so every visit costs an extra click/tab before typing can start - a real cost for carriers logging in daily under time pressure. |
| 8 | Aesthetic and minimalist design | 3 | Clean two-panel navy/white card, no marketing hero, no gradients/glassmorphism - strong compliance with DESIGN.md's Don'ts. Docked slightly by the redundant mobile "Entrar" pill competing for top-of-screen attention. |
| 9 | Help users recognize, diagnose, recover from errors | 2 | Error copy is clear and doesn't leak which field was wrong (good security posture), but offers zero next step for a user who genuinely doesn't know their credentials; rate-limit message ("aguarde alguns minutos") is vague despite the code already computing an exact resetAt timestamp that is never surfaced. |
| 10 | Help and documentation | 1 | No support/help link anywhere on or reachable from the login screen; no reference to the operational manual for a locked-out or confused carrier user. |

**Total: 23/40 - Acceptable**

## 2. Anti-Patterns Verdict

**Deterministic scan:** node detect.mjs --json app/login/page.tsx -> exit code 0, findings: [] (empty array, no anti-patterns flagged).

This is a credible negative, not a miss on its own terms: app/login/page.tsx is a small, restrained file with no gradients, no marketing copy, no oversized hero, no glassmorphism, no decorative color abuse - exactly the kind of "AI slop" the detector is built to catch, and it isn't present here. However, the scanner is a static/textual pattern matcher scoped to this one file; it cannot see cross-file IA problems (the duplicate "Entrar" link lives in app/layout.tsx, not page.tsx), runtime behavior (missing loading state, focus-ring opacity as rendered), or product-context issues (vague rate-limit copy, missing recovery path). Treat the clean scan as "no surface-level AI-slop tells," not as "no UX issues" - the LLM review and browser evidence below surface real, separate problems the scan is not designed to catch.

**LLM assessment:** No AI-slop red flags found - no hero/marketing language, no unearned gradients or shadows, restrained single-font system, semantic color used correctly (amber alert border, navy authority). The page reads as a deliberately built internal tool, not a generated template. The real issues here are IA/interaction-design gaps (duplicate nav CTA, missing autofocus, weak focus contrast, vague error timing) rather than decorative excess.

## 3. Overall Impression

The login screen is visually disciplined and clearly built to spec - navy authority color, 8px radius, restrained shadow, calm Portuguese copy, and no marketing-site tells, all in line with DESIGN.md. The biggest opportunity is not visual polish but interaction design for the specific, named persona this screen exists for: a non-technical carrier operator logging in fast, every morning, before an 11am deadline. Right now the screen wastes their first two keyboard/attention stops on a self-referential "Entrar" link in the global nav (confirmed via tab-order trace and screenshot, most visually prominent on mobile), gives zero feedback while a submit is in flight, and - if something goes wrong - offers no path forward beyond "confira usuario e senha" and a vague "wait a few minutes," despite the underlying rate limiter already knowing the exact unlock time. These are small, well-scoped fixes that would meaningfully reduce friction and anxiety for the exact user this product says it's optimizing for.

## 4. What's Working

- **Color contrast is genuinely solid.** Measured (WCAG relative-luminance calculation from computed styles): gray label/muted text on white ~4.76:1 (passes AA), auth-copy paragraph (#dbeafe on navy) ~12.4:1, alert text on amber-soft background ~15.7:1. No contrast failures found anywhere tested.
- **Failed-login behavior is well-considered.** Identifier is preserved after a failed attempt (admin-claude survives the redirect) while password is correctly cleared - good balance of reducing re-entry friction without leaving a masked-but-wrong credential sitting in the field. The error message also avoids revealing whether the username or password was wrong (anti-enumeration, and calmly worded per brand voice).
- **Component sizing matches the design system.** Button height (38px) and input height (40px) were measured directly in the browser and match DESIGN.md's button-primary/input tokens exactly; mobile submit button measured at 44px tall, meeting comfortable tap-target size.

## 5. Priority Issues

**P1 - No pending/loading state on submit, enabling accidental double-submits**
- What: The submit button gives no visual feedback while the server action runs (no disabled state, no spinner/label change). Confirmed while testing: a slow or ambiguous first attempt invites a second tap, and since the rate limiter counts every submit (including ones typed correctly), repeated taps burn through the 8-attempt/5-minute budget faster than a real single login attempt would.
- Why it matters: This is the exact scenario the product is built around - a carrier on a rushed morning, possibly on a weak connection - and it can turn "the page felt slow" into "I'm locked out for 5 minutes right before my deadline."
- Fix: Wrap the form in a small client component using useFormStatus (or equivalent) to disable the button and show "Entrando..." while pending.
- Suggested command: harden

**P1 - Redundant "Entrar" link in the global nav wastes the first two tab stops and the most prominent tap target on mobile**
- What: app/layout.tsx renders a nav "Entrar" link/button pointing to /login even when the user is already on /login. Confirmed via tab-order trace (brand-lockup -> nav "Entrar" -> identifier field, i.e. 2 stops before the real form on every load) and via mobile screenshot, where this pill is the largest, topmost, most button-like element on the screen - more prominent than the actual submit button below the fold.
- Why it matters: For keyboard users it's friction on every single visit; for a rushed, non-technical mobile user (the carrier persona) it's a plausible mis-tap - a big navy pill that does nothing when tapped, right before they've even seen the real form.
- Fix: Suppress the nav "Entrar" link when pathname === "/login" (or hide the whole session-nav slot on the auth route), and add autoFocus to the identifier input so keyboard entry can start immediately.
- Suggested command: distill

**P2 - Focus-visible ring on inputs is far below usable contrast**
- What: --focus-ring: rgba(37, 99, 235, 0.28) rendered over the white input background computes to roughly 1.5:1 contrast against the card surface (calculated from computed styles), well under WCAG 1.4.11's 3:1 minimum for UI/focus indicators. Visually confirmed in a focused-state screenshot: the ring is present but faint.
- Why it matters: PRODUCT.md's own accessibility priority #4 explicitly calls for "foco visivel, contraste e estados de erro/disabled em todos os controles." A low-vision user, or anyone on a glare-lit warehouse screen, could genuinely lose track of focus while tabbing.
- Fix: Raise the alpha (e.g., to ~0.6-0.8) or switch to a solid 2px outline color instead of a translucent one; re-check contrast against both the white form card and the navy copy panel.
- Suggested command: colorize

**P2 - Rate-limit / lockout messaging is vague despite the backend already knowing the exact unlock time**
- What: checkRateLimit() in lib/rate-limit.ts returns a precise resetAt timestamp, but auth-actions.ts discards it - the login page only ever shows "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente," with no countdown or concrete duration.
- Why it matters: This is the single highest-anxiety moment for the stated persona (carrier racing an 11am deadline). "A few minutes" with no visible countdown is worse than a precise number, and the data to show one is already computed and thrown away.
- Fix: Pass resetAt through the redirect params and render "Tente novamente as HH:MM" or a live countdown.
- Suggested command: clarify

**P3 - No error-recovery or help path for a genuinely confused/locked-out user**
- What: There is no "esqueci minha senha," no support contact, and no link to the recently-added operational manual anywhere on or reachable from /login. The only guidance after any failure is "confira usuario e senha e tente novamente."
- Why it matters: Given credentials are admin-issued and reset (per PRODUCT.md's user-audit roadmap item), a first-time or forgetful carrier operator has no self-serve or even pointed-elsewhere option - just "try again," which under repeated failure risks the same rate-limit wall with no offramp.
- Fix: Add a small, low-emphasis line ("Esqueceu sua senha ou usuario? Fale com o time de operacoes.") with a contact channel or link.
- Suggested command: onboard

## 6. Persona Red Flags

**Jordan (confused first-timer, non-technical carrier operator, rushing before 11am)**
- On mobile, the first big navy pill he sees at the very top of the screen is the header's "Entrar" button - pointing to the page he's already on. He may tap it, get nothing, and start doubting the page is working, before ever reaching the real form beneath the fold.
- No autofocus means one more required tap before he can start typing - trivial in isolation, but one more "where do I start" moment under time pressure.
- If he genuinely doesn't remember his password, "confira usuario e senha e tente novamente" is the entire safety net. No contact info, no reset link - repeated guessing is the only path he's shown, and that path leads straight to the rate limiter.

**Sam (accessibility / keyboard)**
- Tab order on every visit: brand-lockup link -> duplicate "Entrar" nav link -> identifier field -> password -> submit. Two unnecessary, self-referential stops before the actual task, every single time.
- Measured focus-ring contrast (~1.5:1) is below the 3:1 WCAG 1.4.11 threshold for non-text UI indicators - a keyboard user with low vision could lose track of which field currently has focus, directly contradicting PRODUCT.md's explicit "foco visivel" accessibility priority.

**Riley (stress tester: wrong password, rate-limit edge, back button after login)**
- Wrong password correctly clears the password field and preserves the identifier (good), but with no in-flight "submitting..." feedback, a slow response looks identical to a non-response - inviting a second/third tap that silently consumes rate-limit budget. This is not hypothetical: it happened during this test's own scripted runs, which is why later scenarios in this session showed error=rate_limited sooner than the raw attempt count would predict.
- Once rate-limited, the message gives no concrete wait time, which is maximally stressful for a user who knows they have a hard deadline.
- Back-button behavior after a successful login was inconsistent across repeated runs in this session - most attempts correctly redirected away from a prior error state, but one run briefly surfaced a stale /login?error=invalid... URL in the address bar after pressing back post-login. This is not conclusively reproduced and needs a manual re-check rather than being logged as a confirmed defect.

## 7. Minor Observations

- Alert box and form inputs render text at the browser's default ~16px rather than DESIGN.md's 14px body token, since .alert and .field input don't explicitly set font-size - a small, systemic gap between the token file and the CSS rather than something specific to this page.
- Empty-submit validation relies entirely on native browser required tooltips (locale- and browser-dependent styling/wording), which is a reasonable low-cost choice but is visually and linguistically inconsistent with the app's own .alert error styling used for server-side errors.
- The in-memory rate limiter (lib/rate-limit.ts, a Map on globalThis) resets on server restart and won't share state across multiple instances in production - already flagged as a known gap in PRODUCT.md's own roadmap ("rate limit persistente"), so this is a confirmation, not a new finding.
- Deterministic scan scope: detect.mjs only inspected app/login/page.tsx in isolation; the most nav/IA-related finding here (duplicate "Entrar" link) lives in app/layout.tsx and would not be caught by a single-file scan.

## 8. Questions to Consider

1. Is the header/nav intentionally always rendered on /login, or was suppressing it on the auth route simply never considered? If there's a reason (e.g., consistent chrome across all routes), that would change the fix for the duplicate "Entrar" link.
2. Given carriers get credentials from internal admins rather than self-service, is a "contact operations" link on the login screen already planned as part of the "Completar auditoria de usuarios" roadmap item in PRODUCT.md, or does that item only cover the admin-side tooling?
3. Is there a reason the rate limiter's resetAt is computed but never passed to the client (e.g., deliberately hiding exact timing to reduce brute-force timing precision)? Worth confirming before exposing a countdown.
