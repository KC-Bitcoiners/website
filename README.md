# KC Bitcoiners — bodarc

The community website for [KC Bitcoiners](https://kcbitcoiners.com), a Bitcoin-only meetup group in Kansas City. Built with Next.js as a fully static site that uses the Nostr protocol as its data layer for events, educational content, galleries, and committee management.

## Tech Stack

- **[Next.js 15](https://nextjs.org)** — React framework with static export
- **[React 19](https://react.dev)** — UI library
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first styling
- **[Nostr](https://nostr.com)** — Decentralized data layer via [applesauce](https://github.com/hzrd149/applesauce) libraries
- **[Playwright](https://playwright.dev)** — End-to-end testing
- **[Vitest](https://vitest.dev)** — Unit testing

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`corepack enable` or `npm install -g pnpm`)

### Install & Run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
pnpm build
```

Static files are output to `out/`. A post-build script (`scripts/post-build.js`) creates clean URL structures for static hosting.

## Project Structure

```
bodarc/
├── config.json            # Site configuration (relays, whitelist, page metadata)
├── next.config.ts         # Next.js config (static export, basePath support)
├── src/
│   ├── pages/             # Page components (Next.js Pages Router)
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React contexts (NostrContext for auth)
│   ├── utils/             # Event builders, crypto helpers, API clients
│   ├── lib/               # Nostr pool/event store setup
│   └── styles/            # Global styles
├── tests/                 # Playwright E2E + Vitest unit tests
├── scripts/               # Build scripts (post-build clean URLs)
├── terraform/             # DNS management (Dreamhost)
├── .github/workflows/     # CI/CD pipelines
└── .nsite/                # Nostr site deployment config
```

## Testing

### Unit Tests

```bash
pnpm test              # Run once
pnpm test:watch        # Watch mode
```

No dev server required. Tests live in `tests/**/*.test.ts`.

### E2E Tests (Playwright)

```bash
npx playwright test                        # All tests
npx playwright test --grep @education      # Education tests only
npx playwright test -g "add a Link"        # By test name
```

Playwright auto-starts the dev server on port 3000. Tests run in Chromium.

#### Test Tags

Tests are organized by page and capability using tags:

- `@login` — Authentication flow
- `@calendar` — Calendar page
- `@committees` — Committees CRUD
- `@education` — Education resource browsing
- `@gallery` — Photo gallery
- `@whitelist` — Tests that publish to live Nostr relays (require whitelisted keys)

#### @whitelist Tests

Tests tagged `@whitelist` publish real events to Nostr relays. They generate a fresh keypair each run and inject a mock NIP-07 browser extension. These tests are excluded in CI environments since they depend on relay availability and the test keys aren't whitelisted in production config.

#### Testing Against Live Sites

```bash
E2E_BASE_URL=https://kcbitcoiners.com npx playwright test --grep @calendar
E2E_BASE_URL=https://dev.kcbitcoiners.com npx playwright test --grep @education
```

Note: @whitelist tests cannot run against remote sites (test keys aren't whitelisted).

## Configuration

`config.json` is the single source of truth for the site:

- **`site`** — Organization name, location, external links, image paths
- **`nostr`** — Relay URLs, whitelisted pubkeys, Blossom server URL
- **`pages`** — Per-page settings (metadata, API endpoints, UI configuration)
- **`newsletter`** — Newsletter signup form text

No environment files are needed for local development.

## Deployment

The site is a static export — no server-side code. Every push to `master` triggers three simultaneous deployments:

### Production — kcbitcoiners.com

S3 + CloudFront via GitHub Actions (`staticS3.yml`):
- Static files synced to S3 bucket
- CloudFront cache invalidation
- Also publishes to Nostr/Blossom decentralized CDN

### Development — dev.kcbitcoiners.com

Same pipeline, different S3 bucket. Triggered by pushes to `dev` branch or manual dispatch.

### GitHub Pages — kc-bitcoiners.github.io/bodarc

Built with `BASE_PATH=/bodarc` for subpath hosting (`deploy-pages.yml`). Post-build script creates clean URL structure.

### DNS Management

Terraform + Dreamhost provider (`dns.yml`) manages the `relay.kcbitcoiners.com` A record. Only triggers on changes to the `terraform/` directory.

## How Nostr Data Works

The app uses Nostr relays as its database. All user-generated content (events, resources, gallery photos, committee data) is stored as Nostr events:

| Kind | Purpose | NIP |
|------|---------|-----|
| 0 | User profiles | NIP-01 |
| 30023 | Long-form articles | NIP-23 |
| 30067 | Pinboards (resource collections) | Community |
| 39067 | Pins (resource links) | Community |
| 31923 | Calendar events | NIP-52 |
| 39068-39071 | Committee structures | Community |

Users authenticate via a NIP-07 compatible browser extension (e.g., [nos2x](https://github.com/fiatjaf/nos2x), [Alby](https://getalby.com)). Publishing is restricted to whitelisted pubkeys defined in `config.json`.

## Contributing

1. Create a feature branch from `master`: `git checkout -b feature/XX-description`
2. Make changes and test locally
3. Run `pnpm lint` and `pnpm test` before pushing
4. Open a PR against `master`
5. Squash merge preferred for clean history

## License

All rights reserved. KC Bitcoiners community project.
