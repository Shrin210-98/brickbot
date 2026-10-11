# Design: "Warm Boutique"

BrickBot is the portfolio site of one advisor. It should feel like a warm, personal boutique, not a property portal.

## Identity
- **Site name:** `salesman_profile.agency_name`, falling back to "BrickBot". The column doesn't exist yet: until it does, the site uses the profile `name` with the same fallback.
- **Persona:** Ravi Sharma, real-estate advisor, Bandra West, Mumbai.
- **Positioning:** mid-market family homes, first-time buyers, society resales.
- **Tone:** warm, personal, "your neighbour in Mumbai real estate". Plain words, first person where it fits, no portal jargon.

## Palette
Tokens live in `frontend/src/index.css` (`:root`) as `hsl(...)` values, and Tailwind exposes them through `@theme inline` (`bg-primary`, `text-muted-foreground`, …). **Light only:** there are no `.dark` overrides for now.

| Token | HSL | Hex | Use |
|---|---|---|---|
| `--background` | 36 33% 97% | #FAF7F2 | Page background, warm off-white |
| `--foreground` | 0 0% 10% | #1A1A1A | Body text |
| `--primary` | 14 54% 54% | #C96F4A | Terracotta: primary buttons, links, highlights |
| `--primary-foreground` | 0 0% 100% | #FFFFFF | Text on primary |
| `--secondary` | 36 30% 91% | #EFE9DF | Soft section bands, secondary buttons |
| `--muted` | 36 20% 86% | #E8E2D6 | Placeholders, skeletons, quiet fills |
| `--muted-foreground` | 0 0% 42% | #6B6B6B | Secondary text |
| `--primary-strong` | 14 50% 36% | #8B4A2F | Darker terracotta for emphasis (`text-primary-strong`, `bg-primary-strong`) |
| `--accent` | 36 30% 91% | #EFE9DF | Same as secondary: shadcn's menu/select hover and open states |
| `--sage-green` / `--sage-green-hover` | (hex) | #7D8471 / #6B7259 | The header's WhatsApp glyph (`text-sage-green`). Stored as hex to keep the exact values |
| `--border` | 36 25% 85% | #E5DDD0 | Borders, inputs, dividers |
| `--ring` | 14 54% 54% | #C96F4A | Focus ring |
| `--radius` | 0.5rem | | Base radius |

These tokens were derived to fit with the rest: `--card`/`--popover` are a near-white warm `36 40% 99%`, `--input` = `--border`, `--accent-foreground` = `--foreground`, and `--destructive` is a red `0 72% 45%`.

**Terracotta is reserved** for primary buttons, active and selected states, focus rings, links and eyebrow labels. Hovers stay neutral:
- Menu, select and dropdown items hover on `--accent`, which is set to the secondary beige.
- Ghost and outline buttons hover on `--muted`, a slightly deeper beige. The generated `button.tsx` sets this, and it stays unedited.
- Custom links hover to `text-primary`. Custom list rows hover to `bg-secondary`.

## Typography
Loaded from Google Fonts with a `<link>` in `frontend/index.html` (no npm font packages).

| Role | Family | Weights | Tailwind |
|---|---|---|---|
| Display | Fraunces | 400 / 600 / 700 | `font-display` (also `font-heading`) |
| Body | Inter | 400 / 500 / 600 | `font-body` (also `font-sans`, the default) |

Base scale, set on bare elements in `@layer base`. Utility classes override it.

| Element | Size / line height |
|---|---|
| `h1` | 3.5rem / 1.1 |
| `h2` | 2.5rem / 1.2 |
| `h3` | 1.75rem / 1.3 |
| body | 1rem / 1.6 |

`h1`–`h3` use Fraunces automatically. On small screens, step down with responsive utilities (e.g. `text-4xl md:text-[3.5rem]`).

## Spacing and shape
- Content width: `max-w-6xl mx-auto px-4`.
- Section rhythm: `py-20 md:py-28` for full-width sections. Alternate `bg-background` and `bg-secondary` bands to separate them.
- Cards: `rounded-lg border`, no resting shadow, `hover:shadow-md` with `transition-shadow`.
- Buttons: `rounded-md` with generous padding (`h-11 px-6` for primary calls to action). Use primary (terracotta) for the one main action in a section and outline or ghost for the rest.

## Layout
- `components/layout/Header.tsx`: a sticky header, transparent at the top of Home and solid (`bg-background/95 border-b`) after 16px of scroll and on every other route. A Sheet holds the menu below `md`.
- `components/layout/Footer.tsx`: three columns (brand, nav, contact) on `md+`, with a bottom bar `© year agency · RERA no`.
- `components/layout/nav.ts`: the links both of them use. Section links are `/#anchor`, and HomePage scrolls to the hash on every navigation. `html` has `scroll-smooth scroll-pt-16`, so anchors clear the header.
- Home sections in order: `#hero`, `#about`, `#listings`, `#testimonials`, `#contact`. Only Home is full-bleed. Other public pages sit in the `max-w-6xl` column from `PublicLayout`.

## Component conventions
- Style with Tailwind and the tokens only. Never hard-code hex values in components. The one exception is WhatsApp green (`#25D366`) on WhatsApp buttons.
- Eyebrow labels above section headings: `text-sm font-medium uppercase tracking-wider text-primary`.
- Numbers that sell (years of experience, deals closed) use Fraunces at display size.
- Photos: `rounded-lg object-cover` with a fixed aspect ratio (`aspect-[4/3]` for listings, `aspect-square` for people).
- `src/components/ui/**` stays generated. Restyle through tokens or the `className` at the call site, never by editing the files.

## Mobile & PWA
BrickBot installs as a standalone web app (no native wrapper). Setup, cache rules and testing are in `docs/pwa.md`.

- **Manifest** (`frontend/public/manifest.webmanifest`): name "BrickBot Realty", short name "BrickBot", `start_url`/`scope` `/`, `display: standalone`, portrait, `theme_color` #C96F4A (primary), `background_color` #FAF7F2 (background). Icons are 192, 512 and a 512 maskable, plus a 180 `apple-touch-icon`, all rendered from `favicon.svg`.
- **Cache strategy**: the app shell is precached. Profile and list endpoints are stale-while-revalidate (1h and 5m), listing details are network-first with a 24h fallback, and images are cache-first for 7d. Chat, admin, auth, inquiries and every non-GET request are never cached. When an uncached page is opened offline, it shows `OfflineNotice` (the `/offline` page).
- **Install UX**: an "Install app" text button at the bottom of the mobile Sheet menu only (desktop browsers offer install from the address bar). On Chrome/Android it uses the captured `beforeinstallprompt`. On iOS Safari, the control shows "Add to Home Screen: tap Share, then 'Add to Home Screen'" instead. The control is hidden when the app is installed (`display-mode: standalone`), and for 30 days after the visitor declines the prompt, taps "Not now" or taps "Got it". Nothing opens on its own.
- **Floating buttons (strategy b)**: the chat launcher is the only floating button. WhatsApp is in the header, the hero, the chat panel header and, on listing pages, the bottom bar. Below `lg`, the listing detail page pins a WhatsApp + Call bar (`data-bottom-bar`) to the bottom; the launcher moves up above it, and the layout pads itself so the bar doesn't cover the footer.
- **Phones**: tap targets are at least 44px below `md` (the `h-11 md:h-8` pattern at call sites; `components/ui` stays unedited). Text fields use 16px text so iOS doesn't zoom on focus. The viewport is `viewport-fit=cover`, and the fixed bottom bar, the chat launcher, the chat input and the filter sheet footer add `env(safe-area-inset-*)`. Listing filters open in a bottom Sheet below `md`.
