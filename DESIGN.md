# Design System: Risk Intelligence Platform

**Source:** current frontend codebase
**Primary files:** `assets/tokens.css`, `assets/app.css`
**Stitch reference:** `305203100423572651`

## 1. Visual Theme & Atmosphere

The interface is a dark operational workbench: calm, dense, executive-readable, and risk-focused. It uses near-black green canvases, translucent panels, thin borders, and teal signal lighting to make the product feel like a governed assessment cockpit rather than a generic SaaS dashboard.

The dominant mood is restrained and technical. Large public and wizard moments use cinematic teal glow, but daily workspace screens stay compact, card-based, and built for scanning. Accent lime is used sparingly for warnings, route principles, pilot state, and attention cues.

## 2. Color Palette & Roles

### Brand And Core Signals

| Name | Token / Value | Role |
| --- | --- | --- |
| Deep Risk Canvas | `--color-primary-900` `#061410` | Darkest green-black foundation and inverted contrast. |
| Structured Teal | `--color-primary-700` `#12352c` | Deep panel tint and secondary brand depth. |
| Live Teal | `--color-primary-500` `#03D1A8` | Primary action color, active progress, focus, chart primary. |
| Soft Teal | `--color-primary-400` `#45dfbc` | Button gradients and active highlights. |
| Evidence Teal | `--color-primary-300` `#87e9d2` | Links, labels, success-adjacent text. |
| Pilot Lime | `--color-accent-300` `#F2FB5A` | PoC state, warnings, route emphasis, chart accent. |
| Muted Gold | `--color-gold-500` `#9baa2b` | Secondary attention and subdued appetite markers. |

### Neutrals And Text

| Name | Token / Value | Role |
| --- | --- | --- |
| App Canvas | `--bg-base` / `--color-neutral-950` `#101410` | Body background and page base. |
| Neutral Panel | `--color-neutral-900` `#171d18` | Table, dropdown, and deep surface base. |
| Elevated Panel | `--color-neutral-800` `#1d241f` | Cards and elevated containers. |
| Panel Edge | `--color-neutral-700` `#212822` | Inverted text and hard panel boundaries. |
| Muted Copy | `--color-neutral-400` `#99a39a` | Secondary labels and helper text. |
| Primary Text | `--text-primary` `#F6F3F2` | Main foreground on dark surfaces. |
| Secondary Text | `--text-secondary` `#d6d2ce` | Paragraphs and supporting copy. |
| Muted Text | `--text-muted` `#95a095` | Metadata, helper copy, inactive controls. |
| Link Text | `--text-link` `#87e9d2` | Inline links. |
| Link Hover | `--text-link-hover` `#F2FB5A` | Link hover and high-attention affordance. |

### Status Colors

| Name | Token / Value | Role |
| --- | --- | --- |
| Success Green | `--color-success-500` `#5ACA91` | Passing states, completed steps, positive posture. |
| Warning Lime | `--color-warning-500` `#F2FB5A` | Review-needed state, caution banners, tolerance warnings. |
| Danger Red | `--color-danger-600` `#FE4A5E` | Critical gates, destructive actions, above-tolerance state. |
| Info Indigo | `--color-info-500` `#4D5C9C` | Informational secondary status. |

### Surfaces, Borders, And Charts

Use low-opacity light borders over dark panels:

- `--border-subtle`: `rgba(246,243,242,0.08)`
- `--border-default`: `rgba(246,243,242,0.14)`
- `--border-strong`: `rgba(246,243,242,0.24)`
- `--border-focus`: `#03D1A8`

Chart tokens mirror the semantic palette:

- Primary: `#03D1A8`
- Accent / warning: `#F2FB5A`
- Danger: `#FE4A5E`
- Success: `#5ACA91`
- Grid: `rgba(246,243,242,0.08)`

## 3. Typography Rules

| Use | Font | Rule |
| --- | --- | --- |
| Display headings | `Syne`, fallback `Georgia`, serif | Used for page titles, cards, metrics, cockpit headings. Weight is usually `600`; major hero headings use large clamp sizes. |
| Body and controls | `DM Sans`, fallback `Helvetica Neue`, sans-serif | Used for paragraphs, forms, buttons, navigation, dense dashboard copy. |
| Code and numeric technical labels | `JetBrains Mono`, fallback `Fira Code`, monospace | Used for inline code and technical snippets. |

Base document sizing:

- Root font size: `16px`
- Body line height: `1.72`
- Paragraphs: `1rem`, line height `1.78`
- Standard heading scale: `h1 2.25rem`, `h2 1.875rem`, `h3 1.5rem`, `h4 1.25rem`, `h5 1.125rem`, `h6 1rem`
- Button text: `0.875rem`, weight `600`
- Small metadata: `0.75rem` to `0.8125rem`

Tracking rules:

- Main Stitch headings use normal letter spacing.
- Brand/logo text and older display headings may use tight tracking around `-0.05em`.
- Uppercase labels use positive tracking between `0.04em` and `0.16em`.

## 4. Spacing And Geometry

### Spacing Scale

The app uses a 4px-based spacing scale:

| Token | Value |
| --- | --- |
| `--sp-1` | `0.25rem` / `4px` |
| `--sp-2` | `0.5rem` / `8px` |
| `--sp-3` | `0.75rem` / `12px` |
| `--sp-4` | `1rem` / `16px` |
| `--sp-5` | `1.25rem` / `20px` |
| `--sp-6` | `1.5rem` / `24px` |
| `--sp-8` | `2rem` / `32px` |
| `--sp-10` | `2.5rem` / `40px` |
| `--sp-12` | `3rem` / `48px` |
| `--sp-16` | `4rem` / `64px` |
| `--sp-20` | `5rem` / `80px` |
| `--sp-24` | `6rem` / `96px` |

### Radius Scale

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | `8px` | Focus outlines, compact inputs, admin links. |
| `--radius-md` | `12px` | Small buttons, chips, form groups. |
| `--radius-lg` | `18px` | Default buttons and small cards. |
| `--radius-xl` | `24px` | Standard cards and risk pick cards. |
| `--radius-2xl` | `32px` | Older large hero or wizard cards. |
| `--radius-full` | `9999px` | Pills, badges, step dots, toggles. |

The current Stitch-derived layer intentionally tightens many operational cards to `10px` or `12px` radii for a sharper enterprise workbench feel.

### Layout Widths

- Default `.container`: `1280px` max width with `24px` side padding.
- `.container--narrow`: `940px`.
- `.container--wide`: `1400px`.
- App stage content: `1720px` max width.
- Current Stitch workbench shell: `1180px` for dashboard, wizard, and results.
- Admin settings shell: `1040px`.
- App bar height: `72px`.

## 5. Component Stylings

### App Bar

The app bar is sticky, `72px` tall, and translucent: `rgba(16,20,16,0.82)` with `28px` blur and a subtle bottom border. Wizard progress is shown as a `2px` teal line along the bottom edge.

Navigation links use rounded rectangular targets, muted text by default, teal-tinted active backgrounds, and a thin active underline that blends teal into lime.

### Buttons

Default button geometry:

- Inline-flex center alignment.
- Minimum height `44px`.
- Padding `12px 20px`.
- Radius `18px`.
- Font `DM Sans`, `0.875rem`, weight `600`.

Variants:

- Primary: teal vertical gradient from `#45dfbc` to `#03D1A8`, dark inverted text, soft teal shadow.
- Secondary: transparent glass surface with subtle border, teal hover tint.
- Ghost: transparent, muted text, light teal hover wash.
- Danger: `#FE4A5E` with white text.
- Success: `#238d68` with white text.
- Large buttons: `14px 28px`, radius `24px`.
- Small buttons: `6px 14px`, radius `12px`.

Buttons are normally single-line. For constrained workflow CTAs, allow wrapping with centered text and `min-width: 0`.

### Cards And Containers

Default `.card`:

- Dark green vertical gradient.
- `1px` subtle border.
- Radius `24px`.
- Padding `32px`.
- Soft shadow plus inset top highlight.
- Glass blur at `18px`.
- Hover lifts by `1px` unless marked static.

Current Stitch operational cards:

- Radius `10px` to `12px`.
- Backgrounds use dark linear gradients with faint teal radial glow.
- Borders stay around `rgba(246,243,242,0.08-0.10)`.
- Keep `min-width: 0` on grid children to prevent overflow in dense layouts.

### Forms

Inputs, selects, and textareas:

- Use `DM Sans`, `0.875rem`.
- Dark glass gradient background.
- `1px` default border.
- Radius `18px`.
- Padding `13px 16px`.
- Focus state uses teal border, `4px` teal focus glow, and no browser outline.
- Textareas resize vertically and start at `120px` minimum height.

Select controls use a small embedded chevron and right padding of `40px`.

### Badges, Pills, And Toggles

Pills are fully rounded and usually compact:

- Active experience/currency toggles use teal gradient fill and dark text.
- PoC tags use lime text on a low-opacity lime background.
- Risk/source badges use uppercase text, small type, and colored translucent fills.

### Steppers And Progress

Step dots are `40px` circles with display font numerals. Active dots use the primary teal gradient and a soft pulsing glow. Completed dots use success green tint. Connectors are `2px` lines that switch from subtle border to success or teal.

### Dashboard Surfaces

Dashboard layouts are workbench-oriented:

- Hero card uses a dark teal radial glow and compact command-summary modules.
- Sections use `10px` radius Stitch cards.
- Reassessment, register, and history surfaces use dense card stacks and data tables.
- Grids favor `repeat(auto-fit, minmax(240px, 1fr))` for compact responsive cards.

### Wizard Surfaces

Wizard screens use a single dominant task per route:

- Step 1 journey selection uses a two-column hero: cards on the left, selected-journey detail on the right.
- Step 2 intake uses a conversational workbench with a primary build action.
- Step 3 scenario refinement emphasizes the narrative textarea and status strip.
- Step 4 estimate uses grouped FAIR ranges and highlights the expected column.
- Step 5 review centers decision readiness and the run action.

Wizard headers use compact teal radial backgrounds, `10px` to `12px` radii, and `clamp()` padding from `20px` to `28px`.

### Results Surfaces

Results are editorial decision surfaces:

- Top results header is dark blue-black, compact, and action-forward.
- Executive cockpit and Decision Stack are the first management scan.
- Tabs are pill-like inside a dark glass tabbar.
- Metric cards use display typography for values and muted explanatory copy.
- Danger results use a warm red/brown gradient only on the critical cockpit, not globally.

### Admin Surfaces

Admin uses a separate shell:

- Sidebar width is `292px` on desktop and collapses to full width below `760px`.
- Active admin links use a teal translucent fill.
- Admin content uses darker blue-black surfaces than the user workspace.
- Org accordions carry subtle entity accent glows via `--org-accent`.

## 6. Layout Principles

- Use dark full-width page bands with constrained inner content.
- Keep operational screens dense but readable; avoid decorative card nesting.
- Prefer CSS grid with `minmax(0, 1fr)` for resilient content shrinkage.
- Use `auto-fit` card grids for repeatable content; common minimum card width is `240px`.
- Desktop two-column layouts usually pair `minmax(0, 1fr)` with a fixed or bounded side rail around `300px-380px`.
- Collapse major two-column surfaces to one column at `980px` or `1100px`.
- Collapse admin shell and narrow utility layouts at `760px`.
- Use `overflow-x: clip` on page shells, but fix true child overflow with wrapping or `min-width: 0`.

## 7. Depth, Motion, And Interaction

Depth is soft and layered:

- `--shadow-sm`: `0 12px 24px rgba(4,8,5,0.16)`
- `--shadow-md`: `0 22px 50px rgba(4,8,5,0.22)`
- `--shadow-lg`: `0 30px 76px rgba(4,8,5,0.28)`
- `--shadow-xl`: `0 42px 100px rgba(4,8,5,0.34)`
- `--shadow-glow`: `0 18px 44px rgba(3,209,168,0.16)`

Transitions:

- Fast: `150ms ease`
- Base: `250ms ease`
- Slow: `400ms ease`

Motion should stay functional: route transitions, progress pulses, subtle glow, and scan effects. Respect `prefers-reduced-motion: reduce`; animation-heavy surfaces already disable major pulses and shimmer in that mode.

## 8. Implementation Notes

- Start with tokens in `assets/tokens.css`; do not hard-code a new palette unless a token is missing.
- Reuse `.btn`, `.card`, form classes, dashboard cards, wizard layout classes, and results cockpit patterns before adding new component styles.
- Preserve the current pilot posture: polished, decision-ready, and honest about PoC constraints.
- Keep primary actions visible; do not hide or regroup workflow controls without product approval.
- New Stitch-aligned surfaces should use the existing `10px-12px` operational radius, dark radial teal glow, and bounded `1180px` workbench width.
