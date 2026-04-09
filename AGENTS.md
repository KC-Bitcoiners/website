# AGENTS.md — KC Bitcoiners Website

## Agent Behavior

### Communication
- Be concise; sacrifice grammar for brevity unless asked otherwise.
- Push back when something seems incorrect — mutual correction produces better outcomes.

### Context Management: RAM vs Disk

> Context Window = RAM (volatile, limited) | Filesystem = Disk (persistent, unlimited)  
> → Anything important gets written to disk.

For every **complex task** (3+ steps, research, multi-file changes), create `.tasks/<task-name>/` containing:

| File | Purpose | When to Update |
|------|---------|----------------|
| `task_plan.md` | Phases, progress, decisions | After each phase |
| `findings.md` | Research, discoveries | After ANY discovery |
| `progress.md` | Session log, test results | Throughout session |

**Skip** these files for simple questions, single-file edits, or quick lookups.

#### Critical Rules

1. **Plan first.** Never start a complex task without `task_plan.md`. Ask clarifying questions during planning if needed.
2. **2-Action Rule.** After every 2 view/search/browser operations, immediately save key findings to files — multimodal/visual content is lost if not persisted.
3. **Read before deciding.** Re-read the plan file before major decisions to keep goals in context window.
4. **Update after acting.** Mark phases `in_progress` → `complete`, log errors encountered, note files created/modified.
5. **Log ALL errors** in the plan file with attempt number and resolution.
6. **Never repeat failures.** Track what failed; mutate the approach each attempt.

#### 3-Strike Error Protocol

```
Attempt 1 → Read error carefully, identify root cause, apply targeted fix
Attempt 2 → Try a different method, tool, or library — NEVER repeat the exact same failing action
Attempt 3 → Question assumptions, broader rethink, search for solutions, consider updating the plan
After 3 failures → Escalate: explain what was tried, share the specific error, ask for guidance
```

#### Read vs Write Decision Matrix

| Situation | Action |
|-----------|--------|
| Just wrote a file | DON'T re-read — content still in context |
| Viewed image / PDF / screenshot | Write findings NOW before context shifts |
| Browser returned data | Write to file — screenshots don't persist across context |
| Starting new phase | Read `task_plan.md` + `findings.md` to re-orient |
| Error occurred | Read relevant file for current state before retrying |
| Resuming after a gap | Read ALL three planning files first |

### Code Guidelines
- Add brief docstrings and inline comments in plain, straightforward language to aid understanding.
- Balance performance, security, scalability, and simplicity; prefer idiomatic Next.js/TypeScript patterns.
- **Do not push branches, create pull requests, or apply database migrations without explicit user consent.**

---

## Architecture Overview

Next.js **Pages Router** static export (`output: "export"` in `next.config.ts`). No runtime server — every page is pre-rendered HTML. Client-side data fetching handles all live content after page load.

**Data sources:**
- **Nostr relays** — primary store for user-created content (calendar events, vendor listings). Uses the `applesauce-*` library suite (`applesauce-relay`, `applesauce-core`, `applesauce-loaders`).
- **Meetup.com GraphQL** (`https://api.meetup.com/gql-ext`) — fetched at build time via `getStaticProps` in `src/pages/calendar.tsx`.
- **BTCMap / OpenStreetMap Overpass API** — client-side fetch for Bitcoin-accepting vendor geo data in `src/utils/btcmap.ts`.

## Configuration

All site-level configuration lives in **`config.json`** (project root). Import from `src/config/index.ts`, never from `config.json` directly:

```ts
import { config, nostrRelays, getWhitelistFilter, WHITELISTED_PUBKEYS } from "@/config";
```

Key exports: `siteConfig`, `nostrConfig`, `nostrRelays`, `WHITELISTED_PUBKEYS`, `getWhitelistFilter()`, `isWhitelisted()`.

To add a new trusted author, add their `npub` to `config.json → nostr.whitelistedNpubs`.

## Nostr Integration

**Singleton pool & event store** are initialized in `src/lib/nostr.ts`. Import `pool` from there for relay I/O:

```ts
import { pool } from "@/lib/nostr";
pool.request(relays, filter).subscribe({ next, error, complete });
pool.publish(relays, signedEvent);
```

**Event kinds in use:**
| Kind | Purpose |
|------|---------|
| 31922 | All-day calendar event |
| 31923 | Timed calendar event |
| 30333 | Bitcoin vendor directory entry |
| 30023 | Vendor attestation (long-form + `#t vendor` tag) |
| 9041 | Zap goal (NIP-75) |
| 5 | Deletion |
| 0 | User metadata |

Replaceable events are deduplicated by **naddr** (`kind:pubkey:d-tag` coordinate) — see `utils/nostrEvents.ts` and `utils/nostr.ts`.

**Auth** is managed by `NostrContext` (`src/contexts/NostrContext.tsx`). Access it via `useNostr()`. Two login paths: NIP-07 browser extension (`window.nostr`) or raw nsec/hex key. Whitelist is enforced at login time; only whitelisted pubkeys may create events or vendors.

## SSR Constraints

Because `output: "export"` is set, there is **no runtime server**. Consequences:
- Leaflet and `react-leaflet` must always be dynamically imported with `{ ssr: false }` (see `src/pages/shop.tsx`).
- `window.nostrdb.js` (local event cache) is guarded by `typeof window !== "undefined"` checks in `src/lib/nostr.ts`.
- The Meetup GraphQL fetch is the only `getStaticProps` call; all other external data is client-side.

## Styling Conventions

- **Tailwind CSS v4** (imported via `@import "tailwindcss"` in `globals.css`).
- Custom Bitcoin orange: CSS var `--bitcoin-orange: rgb(214, 117, 47)` → utility classes `bitcoin-orange`, `bg-bitcoin-orange`, `bg-bitcoin-orange-hover`.
- Headings use `font-archivo-black` class; body uses Source Sans 3. Both are Next.js Google Font variables set in `_app.tsx`.
- Dark mode is intentionally disabled (see commented block in `globals.css`).

## Developer Workflows

```bash
pnpm dev        # Turbopack dev server at localhost:3000
pnpm build      # Static export → out/
pnpm lint       # ESLint (next lint)
pnpm format     # Prettier
```

After `pnpm build`, `scripts/post-build.js` runs automatically. Infrastructure is managed via Terraform in `terraform/`.

## Key Files

| Path | Role |
|------|------|
| `config.json` | Single source of truth for all site & API config |
| `src/config/index.ts` | Typed config exports + whitelist helpers |
| `src/lib/nostr.ts` | Singleton `pool` + `eventStore` |
| `src/contexts/NostrContext.tsx` | Auth state, `useNostr()` hook |
| `src/utils/nostrEvents.ts` | Calendar event fetch/publish/convert |
| `src/utils/btcmap.ts` | BTCMap Overpass fetch |
| `src/lib/meetup.ts` | Meetup.com GraphQL client |
| `src/pages/calendar.tsx` | Calendar page (getStaticProps + Nostr client-side) |
| `src/pages/shop.tsx` | Vendor directory (Nostr kind 30333 + BTCMap) |

