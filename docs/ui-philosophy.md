# UI Philosophy

FieldFlow's interface should feel like an operational tool that can be trusted in low-connectivity environments. The design language is calm, legible, structured, and explicit. It should avoid decorative excess, vague AI-product gloss, and fragile layouts that only work on desktop.

The implementation anchors are [tailwind.config.ts](../tailwind.config.ts), [src/styles/globals.css](../src/styles/globals.css), [src/components/ui](../src/components/ui), and the app shell in [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx).

## Principles

- Prioritize readable work surfaces over marketing composition inside the authenticated app.
- Keep controls stable in size; clicking, loading, or switching workspaces should not cause large layout jumps.
- Use restrained color as status and structure, not decoration.
- Prefer local-first feedback: save, sync, offline, conflict, and update states must be visible.
- Every mobile page must remain operable with bottom navigation, account menu, dialogs, and soft keyboard constraints.
- Motion should explain progress or change. It should never flicker, loop aggressively, or block comprehension.

## Typography

Font families are declared in [tailwind.config.ts](../tailwind.config.ts:35) and loaded in [src/app/layout.tsx](../src/app/layout.tsx:72).

| Token | Font | Use |
| --- | --- | --- |
| `font-sans` | Public Sans, Inter, system UI | Body text, forms, buttons, operational UI. |
| `font-display` | Fraunces, Georgia | Product name, major page headings, hero statements. |
| `font-serif` | Source Serif 4, Georgia | Editorial/supporting text where a calmer reading tone helps. |
| `font-mono` | DM Mono, Consolas | Counters, versions, technical labels, sync metadata. |
| `font-receipt` | Cormorant Garamond, Georgia | Special-purpose receipt/document styling only. |

Base body text is set in [src/styles/globals.css](../src/styles/globals.css:6). The app uses `16px` by default and increases mobile root text size at narrow widths in [src/styles/globals.css](../src/styles/globals.css:14). Do not scale type with viewport width. Use responsive breakpoints and clear hierarchy instead.

## Colors

The palette is a set of named operational colors, not a one-note theme. Tokens live in [tailwind.config.ts](../tailwind.config.ts:7).

| Family | Role |
| --- | --- |
| `graph`, `grid`, `pencil`, `ink` | Core app neutrals, lines, body text, primary action. |
| `kivu`, `soil`, `lake`, `clay`, `volcanic` | Admin and product surface accents. |
| `surgical`, `scrub`, `antiseptic`, `chart`, `iodine` | Supervisor/health review and inventory accents. |
| `concrete`, `rebar`, `rust`, `starlight` | Engineering and warning-like structural accents. |
| `success`, `warning`, `danger`, `info` | Semantic status only. |
| `aid` | Humanitarian organization references, used sparingly. |

Primary action color is `ink-blue`; the root top loader uses a matching blue in [src/app/layout.tsx](../src/app/layout.tsx:86). Backgrounds should usually be `graph-paper`, `white`, `slate-50`, or `kivu-paper`. Avoid full-screen saturated color fields in product workflows.

## Cards, Borders, And Surfaces

Cards are plain operational containers: white surface, `border-graph-line`, and small radius. The base card is [src/components/ui/card.tsx](../src/components/ui/card.tsx:4).

Rules:

- Use cards for repeated items, panels, modals, and bounded tools.
- Do not nest decorative cards inside cards.
- Keep default radii around `rounded-md` / `8px`; use `rounded-xl` or `rounded-2xl` only for prompts, dialogs, or mobile sheet-like surfaces.
- Prefer borders and spacing over heavy shadows.
- Use `shadow-sm` for raised operational panels; reserve `shadow-xl` / `shadow-2xl` for modals and global prompts.

## Buttons

The canonical button primitive is [src/components/ui/button.tsx](../src/components/ui/button.tsx:6). Buttons are `inline-flex`, `w-fit`, `max-w-full`, and `shrink-0` by default to prevent full-width accidental buttons on large screens.

Variants:

- `primary`: irreversible or main forward action.
- `secondary`: alternate action with border.
- `tertiary`: low-emphasis action.
- `danger`: destructive action.
- `ghost`: utility or quiet toolbar action.

Loading buttons use a lucide `Loader2` spinner and disable themselves while the action runs in [src/components/ui/button.tsx](../src/components/ui/button.tsx:31). Any button that starts network auth, AI generation, save, publish, upload, invite, or sync should expose a loading state.

## Forms

Inputs, textareas, and selects share the same structure:

- `h-11` control height for touch comfort.
- `rounded-md`.
- `border-graph-line` default border.
- `focus-visible:ring-2 focus-visible:ring-ink-blue`.
- `danger-500` for validation errors.

See [src/components/ui/input.tsx](../src/components/ui/input.tsx:20), [src/components/ui/textarea.tsx](../src/components/ui/textarea.tsx:20), and [src/components/ui/select.tsx](../src/components/ui/select.tsx:20).

Labels should be direct, not clever. Error text must stay close to the field and use `role="alert"` as implemented in the primitives.

## Badges And Status

Badges are compact status markers with optional dot indicators in [src/components/ui/badge.tsx](../src/components/ui/badge.tsx:5). Use status color only when it communicates state:

- green: synced, approved, healthy.
- amber: pending, retrying, attention.
- red: failed, rejected, destructive.
- blue: active, informational, currently syncing.
- gray/pencil: local, inactive, neutral.

The sync status badge maps record sync states in [src/components/sync/SyncStatusBadge.tsx](../src/components/sync/SyncStatusBadge.tsx:7).

## Loaders And Progress

FieldFlow has three loader levels:

1. **Route loading:** `NextTopLoader` in [src/app/layout.tsx](../src/app/layout.tsx:86). This is a thin top bar for page transitions.
2. **Full app loading:** [src/components/layout/AppLoader.tsx](../src/components/layout/AppLoader.tsx:1) for language/session hydration and app-level waits.
3. **Local skeletons:** [src/components/ui/skeleton.tsx](../src/components/ui/skeleton.tsx:3) and `RouteHydrationFallback` / `WorkspaceSwitchSkeleton` in [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx:51).

AI generation uses a specific progress treatment in [src/components/ai/AgentStatusBar.tsx](../src/components/ai/AgentStatusBar.tsx:139) and CSS animations in [src/styles/globals.css](../src/styles/globals.css:20).

Loader rules:

- Prefer skeletons for page content and workspace switching.
- Use inline button loaders for accepted clicks.
- Avoid blank white screens.
- Respect reduced motion; global CSS clamps animation durations for `prefers-reduced-motion` in [src/styles/globals.css](../src/styles/globals.css:15).
- Do not use multiple competing loaders for the same operation.

## Page Structure

Authenticated pages use [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx:107):

- `ConnectivityBar` at the top.
- Desktop drawer from `lg` upward.
- Mobile bottom tab bar below `lg`.
- Mobile account menu for workspace/account actions.
- Main content with `max-w-7xl`, responsive padding, and bottom padding for mobile tabs.

Desktop navigation is implemented by [src/components/layout/Drawer.tsx](../src/components/layout/Drawer.tsx:84). Mobile navigation is implemented by [src/components/layout/TabBar.tsx](../src/components/layout/TabBar.tsx:80). Admins intentionally get access to admin, supervisor, and field-worker flows in the nav; supervisors get supervisor and field-worker flows.

Page sections should be constrained and scannable:

- Header: page title, short context, primary action if needed.
- Metrics: compact cards or bordered rows.
- Lists: rows with stable height and clear status.
- Detail/edit surfaces: split panels on desktop, stacked panels on mobile.
- Dialogs: centered or bottom-sheet-like, scrollable with visible close and submit controls.

## Responsive Behavior

Breakpoints come from Tailwind plus `xs: 360px` in [tailwind.config.ts](../tailwind.config.ts:40). The core shell switches desktop navigation at `lg`.

Responsive rules:

- Every dialog must use `max-h-[calc(100dvh-...)]` or equivalent and `overflow-y-auto`.
- Fixed bottom controls must account for mobile navigation and safe areas.
- Avoid absolute-positioned inputs unless their parent has explicit bounds.
- Avoid table-only layouts on mobile; use rows/cards when scanning matters.
- Button labels must not overflow; use icons for compact repeated actions.

## Motion

Motion tokens are in [tailwind.config.ts](../tailwind.config.ts:41). Current animations include sync pulse, stamp press, skeleton shimmer, AI progress shimmer, and AI pulse ring.

Motion should be:

- subtle,
- short,
- tied to state,
- disabled or reduced when the user requests reduced motion.

Avoid flickering spinners. For long operations, prefer a stable progress card with a label, progress bar, and cancel/retry where possible.

## Landing/Public Pages

Public pages can be more expressive but should still feel operational. The landing page uses a graph-paper grid, strong display type, and precise claims in [src/app/(public)/page.tsx](<../src/app/(public)/page.tsx:46>). The public header is sticky and compact in [src/components/public/Header.tsx](../src/components/public/Header.tsx:12).

Public CTAs should reflect auth state:

- unauthenticated users see demo/sign-in/start routes,
- authenticated users should see workspace/dashboard/account actions.

## Accessibility And Internationalization

- Use semantic buttons and links.
- Keep visible focus rings.
- Use `aria-current` for active nav items, as in [src/components/layout/TabBar.tsx](../src/components/layout/TabBar.tsx:128).
- All user-facing copy should go through i18n unless it is temporary developer-only text.
- Language preference is account-level and exposed through [src/components/layout/LanguagePreferenceSelect.tsx](../src/components/layout/LanguagePreferenceSelect.tsx).

## What To Avoid

- Full-width primary buttons on wide screens unless the form or mobile layout intentionally requires it.
- Blank loading pages.
- Nested cards and decorative card stacks.
- Oversized hero typography inside dashboards or tools.
- One-color screens dominated by a single hue.
- Unbounded modals that clip submit or close buttons on small screens.
- Static French/English text inside authenticated UI components.

