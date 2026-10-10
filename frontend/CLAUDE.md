# frontend/

React 19, TypeScript, Vite, Tailwind v4, shadcn/ui (Base UI default),
TanStack Query, react-router-dom v6, react-hook-form + zod, Vitest.

## shadcn
- CLI v4. Default base is Base UI (since July 2026).
- Init with `-b base` (or `-b radix` for Radix).
- Composition uses `render` prop, not `asChild`.
- Run `npx shadcn info` to see current config.

## React 19
- No `forwardRef`. `ref` is a normal prop.
- `use()` hook for context and promises.

## Layout
- `src/types/api.ts`: DTOs that mirror the backend JSON exactly (**snake_case**, never camelCase'd).
- `src/lib/api.ts`: fetch wrapper (`credentials: 'include'`, throws `ApiError{status, code, fields}`).
- `src/lib/sse.ts`: POST stream parser. `src/lib/whatsapp.ts`: wa.me link builder. `src/lib/format.ts`: price/area.
- `src/api/*`: TanStack Query hooks. **All server state goes through these. No `fetch` inside components.**
- `src/layouts/`: `PublicLayout` (contains the WhatsApp button and chat launcher) and `AdminLayout` (auth guard via `/api/auth/me`).
- `src/pages/`, `src/components/{listings,inquiry,chat,admin,whatsapp}/`, `src/components/ui/` (shadcn, generated).

## Rules
- Add shadcn components only with `make shadcn c=<name>`.
- Forms use react-hook-form + zod, with schemas mirroring the backend validator tags. Map 422 `fields` to `setError`.
- Listing filters live in URL search params.
- The SSE event contract is defined in `docs/chatbot.md`. Implement exactly that.
- Wrap every `localStorage` access in try/catch.
- Style with Tailwind only. No CSS files besides `src/index.css`.
- The Vite dev server proxies `/api` and `/media` to the api container (`API_PROXY_TARGET`).
- Never call `fetch` in a component or hook. Always use `src/api/*`.
- `src/types/api.ts` is the single source of truth for API shapes. Update it
  in the same change as backend JSON changes.
- Tailwind v4 uses `@import "tailwindcss"` in `src/index.css` + Vite plugin.
  Do NOT add `tailwind.config.ts`.
- Admin route guard lives in `AdminLayout` only (`/api/auth/me` → redirect).
  Do not duplicate the check in pages.
