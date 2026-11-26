# DayDayOn

A daily habit check-in app with friends: fitness, diet, sleep, study, and custom personal goals.

Works across mobile and desktop, installable as a PWA. Take photos or upload screenshots, and AI helps parse and organize them into records; user images are never stored on disk or server.

> Status: Active development (`v0.1.15` deployed; ongoing improvements on `dev`).

## Core Features

- **Five Check-in Modules**: Exercise (MET & calorie estimation, multi-item workout logging), Diet (3-meal daily settlement, photo/text AI recognition, calorie & nutrition referee), Sleep (cross-midnight time picker, bedtime & duration rules), Study (fragmented session accumulation & overwrite), Custom Goals (schema-driven dynamic forms & custom referee rules), plus 1-day makeup & overwrite flow
- **Evaluation Metrics & Trends**: Daily body weight and overall mood ratings with 1-year calendar-proportional trend charts, plus daily step tracking (Android hardware pedometer bridge or manual entry)
- **To-Do v2**: Custom groups, 4-quadrant priority matrix, tags, deadlines, 2000-char notes, timeline & 30-day lazy archive, with full Agent CRUD draft support
- **Dashboard & Social**: Today summary ring, curated healing daily quotes, active-module week heatmap, per-module insights, friends pairing & transparent dashboard visiting, private chat, and leaderboards
- **Agent Companion**: Floating pet & fullscreen `/agent` chat with 32-step tool loop, web search/fetch, inline image analysis (zero disk storage), and confirmation-first draft cards

## Tech Stack

- Frontend: Next.js 16.4 · React 19.3 · TypeScript 6.0 · Tailwind CSS 4 · Base UI 1.9 · TanStack Query 5 · zod 4 · custom SVG + `d3-shape` charts
- Server: PostgreSQL 18 · Drizzle ORM 0.45 · Better Auth 1.7 · Hono 4 (`/api/v1`, OpenAPI) · Nodemailer (Alibaba Cloud DirectMail)
- AI: Vercel AI SDK 7 + DeepSeek (strictly `deepseek-flash`)
- Android Hybrid Shell: Kotlin `WebView` + native camera, streaming photo album, pedometer, local reminders, image sharing, and in-app APK updater
- Deployment: Alibaba Cloud ECS + PM2 + Nginx, GitHub Actions artifact builds

For library selection rationales and usage guidelines, see [docs/libraries.md](./docs/libraries.md) and [docs/conventions/](./docs/conventions/README.md). All M1–M3 core dependencies are installed and locked in `package.json`; see [Roadmap](./docs/plans/roadmap.md) for milestone status.

## Local Development

Requires Node 24 and pnpm 11 (`corepack enable` will automatically use the correct version specified in `packageManager`).

```powershell
pnpm install
pnpm dev
```

Pre-commit hooks will automatically run ESLint, Prettier, and secret detection. Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/en/).

## Documentation

- [AGENTS.md](./AGENTS.md) — Development conventions index (shared by AI coding agents and human developers)
- [docs/](./docs/) — Conventions, architectural decision records (ADRs), and ops guides
