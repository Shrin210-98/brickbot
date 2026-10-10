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
| `--accent` | 14 50% 36% | #8B4A2F | Darker terracotta: hover and emphasis |
| `--border` | 36 25% 85% | #E5DDD0 | Borders, inputs, dividers |
| `--ring` | 14 54% 54% | #C96F4A | Focus ring |
| `--radius` | 0.5rem | | Base radius |

These tokens were derived to fit with the rest: `--card`/`--popover` are a near-white warm `36 40% 99%`, `--input` = `--border`, `--accent-foreground` is white, and `--destructive` is a red `0 72% 45%`.

shadcn uses `accent` as the **hover background** of ghost and outline buttons, menu items and select options. With a dark terracotta accent and white text, those hovers are strong by design.

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

## Component conventions
- Style with Tailwind and the tokens only. Never hard-code hex values in components. The one exception is WhatsApp green (`#25D366`) on WhatsApp buttons.
- Eyebrow labels above section headings: `text-sm font-medium uppercase tracking-wider text-primary`.
- Numbers that sell (years of experience, deals closed) use Fraunces at display size.
- Photos: `rounded-lg object-cover` with a fixed aspect ratio (`aspect-[4/3]` for listings, `aspect-square` for people).
- `src/components/ui/**` stays generated. Restyle through tokens or the `className` at the call site, never by editing the files.
