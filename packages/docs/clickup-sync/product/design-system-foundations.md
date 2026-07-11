> **Source:** ClickUp — Product Documentations › Design System Foundations ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-575/2kyr7tvt-135))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

> **Source:** Design-session handoff — Fundi Design System bundle (foundations-only: tokens + core component set). No Figma file, codebase, or logo assets were attached — everything here is built from a visual-direction exploration ("Foundation") and the Product Brief, not an existing product.

# Fundi Design System

**Fundi** ("Pulse") is the AI-powered, create-and-forget platform that turns a creator's, educator's, or trainer's expertise into a structured program — delivered and driven through WhatsApp. Africa-first market. Two apps share this system: a **creator/mentor web app** (build a program, manage delivery, triage who needs attention) and a **learner PWA** (light, mostly a companion to WhatsApp).

This is a **foundations-only** design system by request: color, type, spacing, radius/shadow tokens, and a core component set (Button, Input, Card, Badge, Tag, Tabs, Modal). No product-specific UI kit screens are included yet — build those from these primitives when real screens are scoped.

## Sources

*   `Product Brief` — product scope, principles, MVP cut line.
*   `FUNDI_ADR` (this project) — technical architecture and domain model.
*   `Technical Direction` — locked technical bets.
*   `Foundation` exploration (design-session asset) — the visual-direction exploration this system is built from. Two directions (Studio, Pulse) were explored in both light and dark; **Pulse was chosen**, dark as the default surface, light available.

## Theme

Dark is the **default** product surface — set by leaving `data-theme` unset (`:root`). Light is available via `<html data-theme="light">` (or on any scoped container) and swaps the same semantic tokens; nothing in the component layer needs to change between themes.

## Content fundamentals

*   **Voice**: direct, calm, a little warm — never hypey. Product copy in the brief reads like a founder explaining a decision, not a marketing page ("Experts are great at teaching and terrible at chasing").
*   **Second person in-product**: UI copy addresses the creator directly ("Structure your craft into a program, then guide every learner through it").
*   **No emoji.** The brand leans on typographic weight and color for energy, not emoji or decoration.
*   **Numerals matter**: counts (modules, learners) are set in monospace to read as precise data, not prose.
*   **Message copy** (the WhatsApp reminder signature) is short, first-name personal, and always signed "— Fundi": _"Hi Amara — Module 2, 'Build the offer', is due tomorrow. Reply DONE when you finish. — Fundi"_

## Visual foundations

*   **Type**: Sora (display/headings/UI labels, weights 700–800, tight tracking −0.02 to −0.03em) paired with Manrope (body/UI text, 500 weight, warm and rounded) and JetBrains Mono (counts, IDs, timestamps, technical labels).
*   **Color**: one accent hue family — Pulse green (`#1FD87A` dark / `#0FBE68` light) as primary, teal as secondary accent. WhatsApp's own green (`#25D366`) appears only inside the WhatsApp-bubble motif and never shifts with theme. Neutrals are a warm-tinted near-black (dark) / near-white (light), not true gray.
*   **Radii**: generous and consistent — 10–13px on cards/inputs, full pill (999px) on buttons, tags, and status badges. No sharp corners anywhere.
*   **Borders over shadows for structure**: 1px hairline borders (`--color-border-subtle`) delineate cards and sections; shadow is reserved for true elevation (modals, popovers) via `--shadow-card` / `--shadow-popover`.
*   **Backgrounds**: flat color, occasionally a very subtle diagonal gradient wash behind a hero header (`135deg`, canvas → canvas, ~2 stops). No photography, no illustration, no textures/patterns.
*   **Signature motif**: the WhatsApp reminder bubble (chat-tail card, solid green fill, dark text) is the single most distinctive recurring element — reach for it whenever a screen needs to show the product "in motion."
*   **Hover/press**: buttons darken via a slight scale-down (0.97) on press, no color darkening; links go to the accent teal. No opacity fades — the palette is confident, not soft.
*   **Animation**: none observed/specified yet — keep transitions short and functional (120–150ms ease) rather than bouncy; nothing in the brief calls for expressive motion.
*   **Density**: comfortable, not tight — 16–20px card padding, 11–14px gaps between inline controls.
*   **Transparency**: soft accent tints (`rgba` at 14–16% opacity) are used for status-pill backgrounds only; no blur/glassmorphism anywhere.

## Layout

Mobile-first. Design the learner portal (and any shared view) for a small screen first, then adapt up — the architecture explicitly favors a thin, low-end-Android-friendly learner bundle. The creator/mentor app is the one surface expected to stretch into a genuine desktop workspace (multi-column builder, side-by-side panels).

*   **3-tier breakpoints**: Mobile `0–767px` → Tablet `768–1199px` → Desktop `1200px+`. Custom properties in `tokens/layout.css` document the numbers (CSS variables aren't valid inside `@media` conditions — hardcode these values into your media queries, referencing the token file as the source of truth).
*   **Container**: full-width on mobile (16px outer margin), 720px on tablet (32px margin), 1200px on desktop (48px margin).
*   **Grid**: 12 columns, fluid gutter (`clamp(12px, 1.6vw, 24px)`). On mobile, most layouts collapse to 1 column (4/4/4/12 or full-bleed rows); tablet typically runs 2-up; desktop runs 3–4-up for card grids, or a fixed sidebar + fluid content split for the builder/dashboard.
*   **Adapt, don't just shrink**: dense desktop tables/rows (e.g. the curriculum builder's module list) become stacked cards on mobile rather than horizontally-scrolling tables.

## Iconography

No icon set was supplied. **Phosphor Icons** (regular weight, CDN via `unpkg.com/@phosphor-icons/web`) is substituted as the closest match — its rounded terminals pair naturally with Manrope's warm letterforms, better suited to a creator-facing brand than a more clinical/technical set. Use the `ph` class prefix (`<i class="ph ph-users">`), 20–24px. Flagged here: swap this substitution if the team standardizes on a different icon library.

## Logo

No logo file was supplied. Do not draw or approximate one. The wordmark is set in Sora 800 ("Fundi"); where a mark is needed, a solid-green rounded-square tile with a single "F" glyph stands in as a functional placeholder. Replace as soon as a real mark exists.

## What's in the handoff bundle

*   `styles.css` — root stylesheet, import list only.
*   `tokens/` — `colors.css` (dark default + `[data-theme="light"]` override), `typography.css`, `spacing.css`, `radius.css`, `shadow.css`, `layout.css` (breakpoints/grid), `base.css` (link defaults), `fonts.css`.
*   `guidelines/` — foundation specimen cards: colors (accent/surface/status, dark+light), type (display/body/mono), spacing, radius & shadow, layout/grid, brand wordmark, WhatsApp signature motif, iconography.
*   `components/` — core set, one directory each: `Button/` (incl. icon-only), `Input/` (incl. icon slots + circular action button), `Card/` (incl. media slot), `Badge/`, `Tag/` (curated colors), `Tabs/` (pill/underline/boxed variants), `Modal/`. Each has the `.jsx`, a `.d.ts` props contract, a `.prompt.md` usage note, and a demo `.card.html`.
*   `Design System Overview.dc.html` — single-page live review of every token and component with a dark/light toggle (interactive HTML, not reproduced as a text doc here — see the original asset).
*   `SKILL.md` — portable skill file for Claude Code / other agent contexts, for generating on-brand Fundi interfaces.

## Caveats & next steps

*   **Foundations only, by request** — no product UI kit (dashboard, curriculum builder, "Needs you" queue, learner portal) yet. These are the natural next step once screens are scoped.
*   **No icon set was supplied**, so Phosphor Icons (regular weight, CDN) stands in — swap out if the team picks a different set.
*   Components are authored as plain-script React (no ES `import`/`export` keywords) to match the original project's runtime loader.
