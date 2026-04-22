# CLAUDE.md — Agent Reference for bodarc

## Project Overview

Bodarc is the KC Bitcoiners community website — a statically-exported Next.js app that uses Nostr as its data layer. Content (events, education pins, gallery images, committees) is stored on Nostr relays and rendered client-side. The site deploys to three targets simultaneously on every master push.

## Tech Stack

- **Framework**: Next.js 15 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS
- **Nostr**: applesauce-core, applesauce-relay, applesauce-loaders
- **Crypto**: @noble/curves (Schnorr), @scure/base (bech32)
- **Testing**: Vitest (unit), Playwright (E2E, Chromium only)
- **Package manager**: pnpm only (do not use npm or yarn)
- **Build**: Static export (`output: "export"` in next.config.ts)

## Commands

```bash
pnpm dev          # Start dev server (turbopack) on localhost:3000
pnpm build        # Production static export to out/
pnpm start        # Serve production build (requires non-export config)
pnpm lint         # ESLint via next lint
pnpm format       # Prettier format all files
pnpm test         # Vitest unit tests (no server needed)
pnpm test:watch   # Vitest in watch mode
```

Playwright tests run via `npx playwright test` (not an npm script).

## Testing

### Unit Tests

- Runner: Vitest (`vitest.config.ts`)
- Location: `tests/**/*.test.ts`
- Run: `pnpm test`
- Currently covers calendar utilities; no server needed

### E2E Tests (Playwright)

- Config: `playwright.config.ts`
- Browser: Chromium only
- Base URL: `http://localhost:3000` (or `E2E_BASE_URL` env var)
- Auto-starts dev server: `NEXT_DIST_DIR=/tmp/bodarc-next pnpm dev`

#### Test Tags

| Tag           | Purpose                                   |
| ------------- | ----------------------------------------- |
| `@login`      | Login/auth flow                           |
| `@calendar`   | Calendar page                             |
| `@committees` | Committees page                           |
| `@education`  | Education page                            |
| `@gallery`    | Gallery page                              |
| `@whitelist`  | Requires relay CRUD with whitelisted nsec |

#### @whitelist Tests

These tests publish real events to Nostr relays. They:

- Generate a fresh keypair per run via `tests/global-setup.ts`
- Inject a NIP-07 `window.nostr` mock via `injectNostrExtension(page)`
- Store test keys in `.test-keys.json` (gitignored, cleaned up after run)
- Override the app's whitelist via `window.__TEST_WHITELIST`
- Are **excluded in CI** (`grepInvert: [/@whitelist/]`)
- Can be flaky due to relay latency — use `waitForPinToAppear()` which retries with reloads

#### CI vs Local

|            | Local    | CI (`CI=1`) |
| ---------- | -------- | ----------- |
| Retries    | 0        | 2           |
| Workers    | auto     | 1           |
| @whitelist | included | excluded    |

#### Running Specific Tests

```bash
npx playwright test                           # All tests
npx playwright test -g "add an Article"       # By name pattern
npx playwright test --grep @education         # By tag
E2E_BASE_URL=https://kcbitcoiners.com npx playwright test --grep @calendar  # Against prod
```

#### Key Test Helpers (`tests/helpers.ts`)

- `injectNostrExtension(page)` — injects NIP-07 mock with test key signing, pre-populates localStorage, sets `__TEST_WHITELIST`. Must be called before `page.goto()`.
- `getTestKeys()` — returns `{ privkeyHex, pubkeyHex, npub, nsec }` for current test run
- `loginWithTestAccount(page)` — logs in via "Use Existing Key" flow with test nsec

#### Common Test Patterns

- **Dropdown menus**: Use `locator.evaluate(el => el.click())` for off-viewport menu items (absolutely positioned dropdowns)
- **Waiting for relay propagation**: Use `waitForPinToAppear(page, title)` which reloads with retries
- **Publishing events**: Tests sign events server-side via `__nostrSign` exposed function, then publish to real relays

### Remote Testing

```bash
# Test against production
E2E_BASE_URL=https://kcbitcoiners.com npx playwright test --grep @calendar

# Test against dev
E2E_BASE_URL=https://dev.kcbitcoiners.com npx playwright test --grep @education

# Test against GitHub Pages
E2E_BASE_URL=https://kc-bitcoiners.github.io/bodarc npx playwright test --grep @login
```

Note: @whitelist tests won't work against remote (test keys aren't whitelisted there).

## Architecture

### Pages (`src/pages/`)

- `index.tsx` — Home page
- `calendar.tsx` — Event calendar with Meetup integration
- `events.tsx` — Event listings
- `education.tsx` — Educational content pinboard (largest page, ~1200 lines)
- `shop.tsx` — Bitcoin vendor directory with map
- `gallery.tsx` — Photo gallery with Blossom upload
- `committees.tsx` — Committee management
- `donate.tsx` — Donation/zap goals page

### Data Layer

All user-generated content lives on Nostr relays, fetched client-side:

- **Pinboards** (kind 30067) — boards that hold pins
- **Pins** (kind 39067) — links to resources, events, articles
- **Articles** (kind 30023) — long-form markdown content (NIP-23)
- **Profiles** (kind 0) — user metadata
- **Calendar events** (kind 31923) — NIP-52 calendar events
- **Committee events** (kinds 39068-39071) — committees, members, openings
- **Gallery images** — uploaded via Blossom protocol, referenced in kind 20 events

### Key Files

- `config.json` — Single source of truth for site config (relays, whitelist, page metadata, API endpoints)
- `src/config/` — TypeScript types and helpers around config.json
- `src/lib/nostr.ts` — RelayPool setup, event store, loader initialization
- `src/contexts/NostrContext.tsx` — NIP-07 auth context (getPublicKey, signEvent)
- `src/utils/pinboardEvents.ts` — Pinboard/pin CRUD operations
- `src/utils/newsletterEvents.ts` — Article (kind 30023) building/publishing
- `src/utils/committeeEvents.ts` — Committee event operations
- `src/utils/nostrEvents.ts` — Calendar event operations
- `src/utils/bech32.ts` — npub/nsec/naddr encoding
- `src/components/EventActions.tsx` — Context menu for Nostr events (share, raw data, delete)

### Event Flow

1. User authenticates via NIP-07 browser extension (window.nostr)
2. App builds unsigned event with proper kind/tags
3. Extension signs event (or test helper in E2E)
4. Signed event published to all configured relays via pool.publish()
5. Events propagate through relay network
6. Client subscribes and renders new data

### Configuration

`config.json` contains:

- `site` — Organization name, location, coordinates, external links, images
- `nostr` — Relay URLs, whitelisted npubs/pubkeys, Blossom server
- `pages` — Per-page config (metadata, API endpoints, UI settings)
- `newsletter` — Newsletter signup form text

## Deployment

All deployments trigger on push to `master`. The site is a static export — no server-side code.

### 1. GitHub Pages (`deploy-pages.yml`)

- URL: https://kc-bitcoiners.github.io/bodarc
- Builds with `BASE_PATH=/bodarc` for subpath hosting
- Post-build: `scripts/post-build.js` creates clean URLs (page.html → page/index.html)
- Adds `.nojekyll` to prevent Jekyll processing

### 2. S3 + CloudFront (`staticS3.yml`)

- **Production**: kcbitcoiners.com
- **Development**: dev.kcbitcoiners.com
- Triggers: master/dev/deployBug pushes, scheduled (Mon/Wed/Sat), manual dispatch
- Also publishes to Nostr/Blossom CDN via nsite-action
- CloudFront invalidation after each deploy
- AWS credentials via OIDC role assumption (no long-lived keys)

### 3. Nostr/Blossom (`staticS3.yml`, nsite-action)

- Publishes static assets to decentralized CDN
- Relays: relay.nsite.lol, relay.damus.io
- CDN servers: cdn.hzrd149.com, cdn.sovbit.host, blossom.band
- Config: `.nsite/config.json`
- Uses NBUNKSEC secret for Nostr authentication

### 4. DNS (`dns.yml`)

- Terraform + Dreamhost provider
- Manages A record for relay.kcbitcoiners.com (139.144.226.121)
- Only triggers on changes to `terraform/` directory

## Client-Side Data Flow (RxJS + Nostr)

The app is deliberately **stateless outside the React UI layer**. All Nostr subscriptions, relay reads, and derived state are expressed as cold RxJS observables that React mounts and unmounts via `use$` from `applesauce-react/hooks`. Pages are independent — navigating between them never requires starting/stopping a background service or reconciling shared mutable state.

### Core Rules

1. **No `.subscribe()` outside React components.** Nothing — utility modules, contexts, `lib/`, hooks, anywhere — should call `.subscribe()` directly. The only legitimate way to start a subscription is `use$` inside a component. That's what ties the subscription's lifetime to the component's mount/unmount.
2. **Build the observable where it's used.** If only one view needs a live subscription, construct it inline inside `use$` — no utility module required. Only promote an observable to a shared module (`src/utils/…`) when two or more components legitimately consume the same stream; in that case export it as a cold `Observable<T>` (conventionally `…$`-suffixed) and add `shareReplay(1)` if the upstream is expensive.
3. **No module-level state.** Don't cache fetched events, profiles, or subscription results in module-scoped variables. The event store / relay pool already holds what needs to persist — read from it via an observable.
4. **Derive, don't store.** Use RxJS operators (`map`, `filter`, `combineLatest`, `scan`, etc.) to transform upstream streams. Don't write derived values into a variable callers have to remember to refresh.
5. **Never start services.** No `initX()` / `startX()` / `stopX()` helpers. If something only makes sense while a component is mounted, express it as an observable that component subscribes to via `use$`.

### Why This Matters

Statefulness outside the UI layer introduces hidden lifecycles — observables that start at import, leak subscriptions, or retain stale data when the user navigates away. Keeping subscription lifetime bound to component mount/unmount gives us:

- A page that isn't mounted does zero work — no relay reads, no event-store queries
- No "is this service started?" question anywhere in the app
- Tests don't need to reset module state between runs
- Multiple components that happen to want the same data share it via a `shareReplay(1)` observable — no hand-rolled cache

### Canonical Pattern — Inline (default)

Construct the observable directly inside `use$`. This is the right default: no file, no indirection, and the subscription disappears the moment the component unmounts. Example from `src/pages/education.tsx`:

```tsx
const liveStreamFilters = useMemo(
  () => [
    {
      kinds: [kinds.LiveEvent],
      authors: WHITELISTED_PUBKEYS,
      since: unixNow() - ONE_DAY,
    },
    {
      kinds: [kinds.LiveEvent],
      "#p": WHITELISTED_PUBKEYS,
      since: unixNow() - ONE_DAY,
    },
  ],
  [],
);

// Open a live relay subscription and feed it into the event store
use$(
  () =>
    pool
      .subscription(nostrRelays, liveStreamFilters)
      .pipe(onlyEvents(), mapEventsToStore(eventStore)),
  [liveStreamFilters],
);

// Read a live timeline back out of the event store
const livestreams = use$(
  () =>
    eventStore
      .timeline(liveStreamFilters)
      .pipe(castTimelineStream(Stream, eventStore)),
  [liveStreamFilters],
);
```

### Canonical Pattern — Shared observable (only when reused)

Promote to a module-level cold observable only when multiple components need the same stream. Export it as `…$` and pipe through `shareReplay(1)` so the upstream relay query isn't duplicated per subscriber:

```ts
// src/utils/someFeed.ts
export const someFeed$ = pool
  .subscription(nostrRelays, filters)
  .pipe(onlyEvents(), mapEventsToStore(eventStore), shareReplay(1));
```

```tsx
// any component that needs it
const feed = use$(() => someFeed$, []);
```

Don't preemptively extract. "One day another page might want this" is not a reason — extract when the second consumer actually shows up.

### Actions (writes) are different

One-shot writes — publishing, signing, deleting — are plain async functions and don't need observables. See `src/utils/pinboardEvents.ts`, `src/utils/newsletterEvents.ts`, `src/utils/committeeEvents.ts`. The rules above apply to **reads / live subscriptions**, not to imperative user-triggered actions.

## Key Patterns

- **Nostr events are immutable**: Edits use replaceable events (kind 30000+ with d-tag)
- **Whitelist gating**: Only pubkeys in `config.json` → `nostr.whitelistedPubkeys` can publish
- **pnpm only**: Never use npm or yarn
- **Static export**: No API routes, no server-side rendering. All data fetched client-side from Nostr relays
- **`nostr-tools` not available**: pnpm doesn't hoist it; custom implementations in `src/utils/bech32.ts`
- **Turbopack dev**: Dev server uses `--turbopack` flag; some ESM modules need lazy-loading to avoid resolution issues
- **Image handling**: Gallery images uploaded to Blossom server (blossom.f7z.io), referenced by URL in events
- **Tailwind Typography**: Used for rendering markdown content (ReactMarkdown + prose classes)

## Repository

- GitHub: KC-Bitcoiners/bodarc
- Default branch: master
- PR branches: feature/XX-description pattern
