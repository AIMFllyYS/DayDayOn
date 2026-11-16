<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — DayDayOn

> A healing, multi-user habit check-in app to use with friends (PWA, mobile and desktop).
> This document is the **operational index** for AI coding agents, containing only high-frequency commands and non-negotiable hard rules.
> Check detailed rules on demand: see "Trigger Condition → Required Document" in the [Documentation Index](#documentation-index) at the end.
> This project does not rely on any Agent / IDE built-in memory; the repository is the memory. When an agent's private memory conflicts with documentation in this repo, the repository documentation takes precedence.

## Tech Stack

- **Framework**: Next.js 16.4 (App Router only; `cacheComponents`, `partialPrefetching`, and `reactCompiler` enabled; `output: 'standalone'`)
- **React** 19.3 · **TypeScript** 6.0.3 (locked: typescript-eslint does not support 7 yet) · **pnpm** 11.7 · **Node** 24
- **UI**: Tailwind CSS 4 + `globals.css` tokens; in-house atomic components and icons; interaction primitive Base UI 1.9; data fetching TanStack Query 5; validation zod 4
- **Server**: PostgreSQL 18 (Docker) + Drizzle 0.45 · Better Auth 1.7 · Hono 4 + zod-openapi (`/api/v1`) · Nodemailer · Vitest. Core stack across M1–M3 is fully installed and locked (see `package.json`); check [docs/libraries.md](docs/libraries.md) before considering any new dependency
- **AI**: AI SDK 7 + `@ai-sdk/deepseek`, **only use `deepseek-flash`**
- **Deploy**: Alibaba Cloud ECS (Wuhan). GitHub Actions build artifacts → SSH deployment gate → PM2. **Do not use any Tencent Cloud services**

## Key Commands

- Install: `pnpm install` | Dev: `pnpm dev` (http://localhost:23329) | Build: `pnpm build` | Start: `pnpm start`
- Ports: App **23329**, Database **23432**, consistent between local and server. Do not switch to 3000 / 5432 (see [ports.md](docs/conventions/ports.md))
- Lint: `pnpm lint` | Typecheck: `pnpm typecheck` | Format: `pnpm format` | Check all three: `pnpm check` | Test: `pnpm test` (`vitest run`)
- Local Database: `pnpm db:up` / `pnpm db:down` | Migration: `pnpm db:generate` → `pnpm db:migrate` | Seed: `pnpm db:seed` (**no `db:push`**)
- Contract: `pnpm openapi:export` (re-export OpenAPI spec after modifying `/api/v1` routes or schemas)

## Shell Environment (Local machine is Windows + PowerShell, not bash/zsh)

- Do not chain commands with `&&`; use `;` as a delimiter, or `cmd1; if ($?) { cmd2 }`
- Do not use bash heredoc for multi-line commit messages; use `git commit -F <temp-file>`
- When running pnpm in agent environments, set `$env:CI = "true"` first, otherwise pnpm 11 interactive prompts will hang
- Paths containing spaces must be enclosed in double quotes

## Definition of Done

1. `pnpm check` exits with 0 (lint, typecheck, format:check)
2. `pnpm test` exits with 0
3. `pnpm build` exits with 0
4. For UI changes, test thoroughly with ego-browser on both mobile and desktop viewports. **HTTP 200 does not equal acceptance**
5. Commit messages must follow Conventional Commits (enforced by commitlint)

## When Blocked

- `pnpm build` fails 3 times consecutively → Stop, report full error output
- Missing dependency → Check `package.json` first, then ask
- Merge conflicts → Stop, list conflicting files
- **Never**: Delete lock file, force push, skip hooks (`--no-verify`), bypass lint

## Dependency Discipline

- **AI has no authority to add or remove dependencies independently.** Present candidates first, explain why the existing stack is insufficient, provide bundle size and license, and wait for owner confirmation
- **Verify the package exists on the npm registry before installing** (prevent hallucinated packages). Never state a library's API, version, or maintenance status from memory
- **Each concern has only one owner**: check [docs/libraries.md](docs/libraries.md); similar libraries not listed are forbidden
- **`package.json` diffs are reviewed under the highest risk tier**
- Third-party libraries must be called through wrapper layers (entry points registered in libraries.md); business code is forbidden from importing library package names directly

## Project Structure

```
src/app/         Routing layer: routes only ((app), (auth), (marketing), admin, api, dev, download, icons)
src/components/  ui/ atomic components (no business logic) · layout/ application shell · mascot/ · charts/ · markdown/
src/features/    Domain modules (admin, agent, app-update, auth, chat, checkin, dashboard, diet, friend, goal, insights, me, metric, notification, onboarding, quota, rank, referee, shared, todo, welcome)
src/server/      server-only: api (Hono), services (business logic), db, auth, ai, quota, mail, moderation, crypto, env, idempotency, rate-limit, settings
src/lib/         General utilities and hooks: api, image, time, app-version, auth-client, cn, entry-redirect, fonts, native, semver, splash, theme · src/assets/ fonts
src/proxy.ts     Next.js 16 proxy (entry redirect) · src/instrumentation.ts (startup migrations) · src/test/ (Vitest stubs)
android/         Kotlin hybrid shell & offline APK build (build-apk.ps1) · download/ release manifest, changelog & APK output
docs/            Conventions, ADRs, lessons, component library and skills registry · scripts/ setup / build / deploy / dev
public/          Static assets (planned M5 for sw.js; artifacts are transferred to Wuhan server, keep small footprint)
```

## Critical Rules (Omitting these leads to errors)

**Next.js 16** (see [nextjs-16-patterns.md](docs/conventions/nextjs-16-patterns.md))
- `proxy.ts`, not `middleware.ts`; `params` / `searchParams` / `cookies()` / `headers()` must be `await`ed
- `cacheComponents` enabled: components reading cookies / session must be wrapped in `<Suspense>`, do not `await` session at layout root
- Default to Server Component; `'use client'` only on leaf components

**Architecture** (see [api-conventions.md](docs/conventions/api-conventions.md), [database.md](docs/conventions/database.md))
- **Business write operations only go through `/api/v1`** (Hono, mounted on Route Handler); do not use Server Actions for business writes (APK shell and future Kotlin client will reuse the same API)
- Business logic belongs in `src/server/services/`, never import `next/*`
- Error response body unified as `{ "code": "...", "detail": "..." }`, frontend only checks `code`
- Store time as `timestamptz` (UTC); store "check-in day" separately as user's local date; timezone calculations only go through `src/lib/time/`, do not rely on system timezone
- TypeScript strict, forbid `any`, use `unknown` + type narrowing; zod must always be `import * as z from 'zod'`
- Run `pnpm openapi:export` whenever `/api/v1` routes or schemas change to keep `docs/specs/api/openapi.json` synchronized

**UI** (see [ui-design-system.md](docs/conventions/ui-design-system.md), [routing.md](docs/conventions/routing.md))
- **Playbook First**: New tokens / atomic components / interaction patterns must be demonstrated and finalized in `/dev/playbook` before being used in pages; pages do not reinvent buttons, cards, or progress bars
- Only use `globals.css` tokens and semantic font sizes (`text-body`, `text-caption`…); do not hardcode colors, do not use `text-sm`; apply tones via `tone.ts`
- Debug route is `src/app/dev/` (URL `/dev`), **not `_dev`**: folders starting with underscore do not generate routes
- AI results are presented as drafts, persisted only after user confirmation; single response displayed using `<AgentTurn>`, thinking and tool calls collapsed into a single-line activity bar
- All icons are custom-drawn in `src/components/ui/icon.tsx`, do not introduce generic icon libraries like lucide

**Data and AI** (see [ADR-0002](docs/adr/0002-account-quota-risk.md), [ai-and-quota.md](docs/conventions/ai-and-quota.md))
- **User images never touch disk**: compressed in memory only and sent to DeepSeek; only store parsed text. Do not write to disk, database, or logs; do not use DeepSeek Files API
- **Only use `deepseek-flash`**, called via provider instance in `src/server/ai/model.ts` (string model ID will route to Vercel AI Gateway)
- Each AI call **pre-allocates** quota based on upper limit, **settles** after completion according to actual tokens, and releases on failure; use idempotency keys to prevent duplicate deductions
- Secrets belong strictly in `.env*`, never in Git, logs, or chat

## Self-Evolution Mechanism (Permanent Rules)

- **Pitfall logging is mandatory**: Whenever "AI erred due to incorrect understanding of a library or platform and was corrected", after correction it must request appending an entry to `docs/lessons/<library-or-platform>.md` (format in [docs/lessons/README.md](docs/lessons/README.md))
- **Batch settlement**: Changes to lessons, conventions, ADRs, and libraries.md must first remain as uncommitted diffs, reported together at session wrap-up; **must not commit without owner confirmation**
- Write ADRs when **architectural or technical decisions** are made (`docs/adr/`, append-only, mark Superseded when overturned)

## Git Workflow

- `main` production branch (merge triggers deploy); `dev` integration branch; feature branches branched from `dev`: `feat/<issue#>-<short-desc>`, `fix/…`, `refactor/…`, `docs/…`, `chore/…`, `ci/…`
- Feature branch → `dev` uses squash; `dev` → `main` uses merge commit. **AI agent must obtain owner approval for every push, PR creation, or PR merge**
- Commit: `type(scope): description` (scope whitelist in `commitlint.config.mjs`)
- Before creating issues, breaking down issues, or opening PRs, **must check [docs/skills-registry.md](docs/skills-registry.md) and call corresponding skill**; state referenced skills in issue/PR body; PR target branch is `dev`

## Boundaries

### ✅ Allowed without asking
- Read files, list directories; run `pnpm check`, `pnpm build`
- Modify business code and UI components under `src/`; create debug pages under `src/app/dev/`, add demos in Playbook

### ⚠️ Ask first
- Install or remove dependencies
- Modify `next.config.ts`, `tsconfig.json`, ESLint, CI workflow, `lefthook.yml`
- Modify database schema (add or alter migrations)
- push, open PR, merge
- Write to `docs/lessons/`, `docs/adr/`, `docs/libraries.md`, or convention documents (batch settlement)
- **Any server operation** (`ssh MainECS`)

### 🚫 Never
- Commit `.env*` or any secret
- Force push to `main` / `dev`
- Alter other project files, processes, Nginx sites, or databases on the server
- Write user-uploaded images to disk, database, or logs
- Use Tencent Cloud services (EdgeOne, COS, etc.)
- Use `middleware.ts` or Pages Router; reference `src/app/dev/` in production code

## Documentation Index

> When the trigger condition is met, **must read** the corresponding document before acting; do not read if not met (progressive disclosure).

| Trigger Condition | Required Document |
|---|---|
| Before introducing or changing any dependency | [docs/libraries.md](docs/libraries.md) |
| Before writing code or running commands for a specific library or platform | `docs/lessons/<library-or-platform>.md` (read if exists; local commands read windows-powershell.md) |
| Before creating issues, breaking down issues, or opening PRs | [docs/skills-registry.md](docs/skills-registry.md), [git-workflow.md](docs/conventions/git-workflow.md) |
| When deciding whether to implement a feature, wondering "why this choice was made", or overturning a decision | [ADR-0003 Project Scope](docs/adr/0003-project-scope.md), [docs/adr/](docs/adr/README.md) corresponding number |
| When creating new files, deciding where files belong, or when files grow too long | [project-structure.md](docs/conventions/project-structure.md), [code-size-and-organization.md](docs/conventions/code-size-and-organization.md) |
| Before writing routes, `page.tsx`, `layout.tsx`, Route Handlers, or `next.config.ts` | [nextjs-16-patterns.md](docs/conventions/nextjs-16-patterns.md), [routing.md](docs/conventions/routing.md) |
| Before writing `/api/v1` endpoints, services, database schemas, or migrations | [api-conventions.md](docs/conventions/api-conventions.md), [database.md](docs/conventions/database.md) |
| Before writing or modifying check-in pages, module forms, referee rules, scores, goal settings, or module onboarding configs | [checkin-modules.md](docs/conventions/checkin-modules.md), [ADR-0027](docs/adr/0027-agent-referee.md) |
| Before writing or modifying any UI, component, token, animation, or Playbook | [ui-design-system.md](docs/conventions/ui-design-system.md), [ui-primitives.md](docs/conventions/ui-primitives.md) |
| Before fetching data on the frontend, writing forms, or creating zod schemas | [client-data-and-forms.md](docs/conventions/client-data-and-forms.md) |
| When handling dates, times, timezones, or recurrence cycles | [time-and-dates.md](docs/conventions/time-and-dates.md) |
| Before writing tests or pure functions that require tests | [testing.md](docs/conventions/testing.md) |
| When unsure of style conventions, performing code review, or self-checking before coding | [code-style.md](docs/conventions/code-style.md), [code-review.md](docs/conventions/code-review.md) |
| When modifying ports, `.env`, or network addresses | [ports.md](docs/conventions/ports.md) |
| When dealing with auth, quota, redemption codes, risk control, admin, AI calls, or image processing | [ADR-0002](docs/adr/0002-account-quota-risk.md), [auth.md](docs/conventions/auth.md), [ai-and-quota.md](docs/conventions/ai-and-quota.md) |
| Before modifying manifest, Service Worker, or offline page | [pwa.md](docs/conventions/pwa.md) |
| When local environment encounters issues | [local-setup.md](docs/ops/local-setup.md) |
| Before deployment, server, Nginx, or database container operations | [deploy-aliyun-ecs.md](docs/ops/deploy-aliyun-ecs.md), [lessons/aliyun-ecs.md](docs/lessons/aliyun-ecs.md) |
| Before modifying or adding convention documents | [docs/conventions/README.md](docs/conventions/README.md) (wording meta-conventions, three-tier constraints) |
| When planning, deciding what to do next, or checking initialization progress | [roadmap.md](docs/plans/roadmap.md), [plan-demo-init-alignment.md](docs/plans/plan-demo-init-alignment.md), [architecture-baseline.md](docs/designs/architecture-baseline.md) (v0.1 snapshot, no longer updated) |
