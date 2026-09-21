# FiscAI — CA Tax OS

Layer 1 of an AI execution layer for Indian CA firms: authentication, Chartered Accountant and
firm verification, platform review, firm roles, and tenant isolation.

A Chartered Accountant remains responsible for validation, approval, authentication, and filing.
Nothing in this layer files anything with a statutory portal.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL 16 via Prisma 6 |
| Passwords | Argon2id (`@node-rs/argon2`) |
| Validation | Zod |
| Tests | Vitest (node environment) |

## Getting started

Requires Node.js 22+, npm, and Docker (for the local database).

```bash
npm install
cp .env.example .env
docker compose up -d          # PostgreSQL on localhost:5433
npm run db:migrate            # creates the initial migration and applies it
npm run db:seed               # bootstrap platform admin + reviewer
npm run dev                   # http://localhost:3000
```

No migrations are committed yet, so the first `db:migrate` generates the initial migration from
`prisma/schema.prisma`.

`db:seed` creates a `PLATFORM_ADMIN` from `BOOTSTRAP_PLATFORM_ADMIN_EMAIL` /
`BOOTSTRAP_PLATFORM_ADMIN_PASSWORD` and a `VERIFICATION_REVIEWER` at `reviewer.<that email>`. It
refuses to run when `NODE_ENV=production`.

## Environment

See `.env.example` for the full list. `src/lib/env.ts` validates every variable at startup and
throws on an invalid configuration. Variables worth knowing:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection string; port 5433 in the bundled compose file |
| `APP_URL` | Must be `https://` when `NODE_ENV=production` |
| `SESSION_ABSOLUTE_TTL_HOURS`, `SESSION_IDLE_TIMEOUT_MINUTES` | Session lifetime (12h / 60m by default) |
| `ALLOWED_ORIGINS`, `ALLOWED_HOSTS`, `TRUST_PROXY` | Origin and Host checks applied to every API request |
| `EMAIL_PROVIDER` | `console`, `filesystem` (writes to `EMAIL_OUTBOX_DIR`, default `.mail`), or `smtp` |
| `CA_VERIFICATION_PROVIDER` | `mock` or `manual`. There is no live ICAI integration |
| `EXPOSE_DEV_TOKENS` | Returns verification and reset tokens in API responses. Startup fails if enabled in production |

## Scripts

```bash
npm run dev          # Next.js dev server
npm run build        # production build
npm run lint         # ESLint  (lint:fix to autofix)
npm run typecheck    # tsc --noEmit
npm run test         # Vitest  (test:watch for watch mode)
npm run db:migrate   # prisma migrate dev
npm run db:deploy    # prisma migrate deploy
npm run db:reset     # drop and recreate the local database
npm run db:seed      # bootstrap accounts
npm run audit:deps   # npm audit on production dependencies
```

Run `npm run lint`, `npm run typecheck`, and `npm run test` before opening a pull request.

## Architecture

```
src/
  app/
    api/            route handlers (auth, onboarding, firms, platform review)
    onboarding/     onboarding wizard pages
    (auth pages)    register, login, verify-email, forgot/reset-password, dashboard
  components/       shared form and progress components
  lib/
    auth/           sessions, guards, role -> permission mapping
    http/           route wrapper, typed errors, JSON responses
    onboarding/     server-side state machine
    providers/      email, OTP, and CA verification adapters
    security/       CSRF, origin/host checks, rate limiting
    services/       auth, onboarding, firm, and review business logic
    validation/     Zod schemas
    audit.ts        immutable audit-log writes
prisma/             schema and seed
tests/              Vitest setup and HTTP helpers
```

Every API route is wrapped by `route()` in `src/lib/http/handler.ts`, which validates the Host
header and Origin, enforces CSRF on state-changing requests, and converts thrown typed errors into
JSON responses. Fetch a token from `GET /api/auth/csrf` and send it with mutating requests; routes
that cannot rely on an established cookie opt out with `{ csrf: false }`.

### Access model

Two independent role axes, defined in `src/lib/auth/permissions.ts`:

- **Platform roles** — `PLATFORM_ADMIN`, `VERIFICATION_REVIEWER`. Review, approve, and reject
  onboarding applications.
- **Firm roles** — `FIRM_ADMIN`, `PARTNER_CA`, `STAFF`, `CLIENT`. Scoped to a single firm through
  `FirmMembership`; firm-scoped routes resolve the caller's membership before authorising.

### Onboarding state machine

`src/lib/onboarding/state-machine.ts` holds the only permitted transitions, each restricted to a
`USER`, `PLATFORM`, or `SYSTEM` actor. Only a `PLATFORM` actor can reach `APPROVED` or `REJECTED`,
so a user can never self-approve. Applications carry a `version` column for optimistic concurrency.

```
NOT_STARTED -> ACCOUNT_CREATED -> EMAIL_VERIFIED -> ACCOUNT_TYPE_SELECTED
  -> CA_DETAILS_PENDING / FIRM_DETAILS_PENDING -> SUBMITTED
  -> UNDER_REVIEW -> APPROVED | REJECTED -> COMPLETED
```

### API surface

| Area | Routes |
| --- | --- |
| Auth | `register`, `login`, `logout`, `logout-all`, `me`, `csrf`, `verify-email`, `resend-verification`, `forgot-password`, `reset-password`, `change-password`, `sessions`, `sessions/[id]` |
| Onboarding | `onboarding`, `account-type`, `ca-details`, `firm-details`, `submit`, `request-changes` |
| Firms | `firms/[id]`, `members`, `members/[memberId]`, `members/[memberId]/role`, `invitations`, `invitations/[invitationId]`, `invitations/[token]/accept`, `audit-logs` |
| Platform review | `platform/review/applications`, `applications/[id]`, `claim`, `approve`, `reject`, `request-information` |

All under `/api`.

## Security

- Argon2id password hashing; failed-attempt counting with account lockout.
- Session tokens stored as hashes with absolute and idle expiry; sessions are listable and
  individually revocable.
- Double-submit CSRF tokens, plus Host and Origin allow-lists on every request.
- Database-backed rate limiting (`RateLimitCounter`) and idempotency keys (`IdempotencyKey`).
- Strict security headers and a CSP set in `next.config.ts`; HSTS is added in production.
- `AuditLog` records the actor, action, resource, firm, IP, and user agent for every significant
  operation.

Report a suspected vulnerability privately to the maintainers rather than opening an issue.

## Not built yet

- The `/platform/review` queue UI. The reviewer API exists; the page does not.
- Client workspaces, document ingestion, and any agentic preparation.
- Filing integrations with the GST or income-tax portals.
- Live ICAI membership verification — the provider is a mock or manual approval.
- `tests/` currently holds only setup and HTTP helpers, so `npm run test` runs no assertions.
