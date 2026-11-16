# DayDayOn

A daily habit check-in app with friends: fitness, diet, sleep, study, and custom personal goals.

Works across mobile and desktop, installable as a PWA. Take photos or upload screenshots, and AI helps parse and organize them into records; user images are never stored on disk or server.

> Status: Initialization phase (v0.1.0), features not yet live.

## Planned Features

- **Five Check-in Modules**: Fitness (AI estimated caloric burn, support for workout app screenshots), Diet (photo recognition, calorie deficit), Sleep (manual input or screenshot parsing), Study Planning (itemized logging), Custom Goals (custom forms or custom AI parsing)
- **Evaluation Metrics**: Daily satisfaction scores per module, plus precise metrics like body weight
- **To-Do**: To-do lists and deadlines, toggleable into a time log view
- **Dashboard**: Aggregates all key metrics with customizable layouts
- **Leaderboard**: Global rankings for all users, with options to keep data private or public

## Tech Stack

- Frontend: Next.js 16 · React 19 · TypeScript 6 · Tailwind CSS 4 · Base UI · TanStack Query · zod
- Server: PostgreSQL 18 · Drizzle ORM · Better Auth · Hono (`/api/v1`, OpenAPI) · Nodemailer (Alibaba Cloud DirectMail)
- AI: Vercel AI SDK 7 + DeepSeek (strictly `deepseek-flash`)
- Deployment: Alibaba Cloud ECS + PM2 + Nginx, GitHub Actions artifact builds

For library selection rationales and usage guidelines, see [docs/libraries.md](./docs/libraries.md) and [docs/conventions/](./docs/conventions/README.md). Except for Next.js, React, and Tailwind, remaining libraries will be installed across subsequent milestones per the [Roadmap](./docs/plans/roadmap.md).

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
