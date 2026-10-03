# Woodside Wednesday ⛳

Web app for the Woodside Wednesday golf league: schedules, hole-by-hole scoring, handicaps, standings and stats. Mobile-friendly so scores can be entered on the course.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, React 19) · Tailwind CSS v4 · shadcn/ui |
| API | [Hono](https://hono.dev) + Zod OpenAPI, mounted at `/api/v1` (docs at `/api/v1/docs`) |
| Database | Postgres via Drizzle ORM: **Neon** in production, embedded **PGlite** locally (no install needed) |
| Auth | [Better Auth](https://better-auth.com): email magic links + username/password |
| Email | [Resend](https://resend.com) (optional locally: links print to the console) |
| Hosting | Vercel Hobby (free) |

Expected cost: **$0/month** on the free tiers (Vercel Hobby, Neon Free, Resend Free: 3,000 emails/mo), plus a custom domain if you want one.

## League rules implemented

- 9 holes, par 36 (Woodside card is seeded automatically; edit `src/lib/scoring/woodside.ts` before first deploy if it changes).
- **Handicap** = round(90% × average of the last 5 rounds' strokes over par). Rounds from earlier seasons count, and last season can be imported.
- **New golfers and subs** with fewer than 3 prior rounds get round(80% × tonight's strokes over par). After 3 rounds, they move to the rolling 90%.
- **Match**: the higher handicap receives the difference in strokes on the hardest holes (wrapping past 9). 2 points per hole on net score (ties split 1–1) + 2 points for low net total = 20 points.
- **Sub**: points go to the regular they replaced; the round counts toward the sub's own handicap.
- **Absent, no sub (ghost)**: a random player who played that week is drawn; the opponent plays that card and handicap. The absent golfer earns 0.
- **Standings** ties are broken by a random draw fixed per season.
- **Schedule**: round robin (everyone plays everyone once), then **position night** (1v2, 3v4…) paired from standings.
- **Rainouts**: "Postpone" pushes that week and all later weeks back a week.
- **Score entry**: either golfer in a match can enter both cards until midnight (league time) at the end of the match day. After that, only the admin can enter or change scores, including makeups played later in the week. The latest save wins. The admin can always edit and override handicaps.
- All percentages and round counts are editable per season.

## Local development

```bash
npm install
cp .env.example .env.local        # set BETTER_AUTH_SECRET; ADMIN_EMAILS = your email
npm run db:migrate                # creates ./.pglite and seeds the course
npm run db:seed-demo              # optional: 12 demo golfers + half a season of scores
npm run dev
```

Open http://localhost:3000, choose **Email link**, enter your admin email, and click the link printed in the terminal.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Scoring engine unit tests + league integration tests (in-memory Postgres) |
| `npm run typecheck` / `npm run lint` | Types / ESLint |
| `npm run db:generate` | New migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (uses `DATABASE_URL`, or local PGlite) |

## Deploying (free)

1. **Vercel**: sign in at [vercel.com](https://vercel.com) with GitHub, click **Add New → Project**, and import `woodsidewednesday`. The defaults are fine; `npm run vercel-build` runs migrations and then builds.
2. **Neon**: in the Vercel project, go to **Storage → Create Database → Neon** (free plan). This sets `DATABASE_URL` for you. Alternatively, create a project at [neon.tech](https://neon.tech) and paste the pooled connection string as `DATABASE_URL`.
3. **Resend**: create an API key at [resend.com](https://resend.com). To email anyone besides yourself you must verify a sending domain; until then, use password sign-in for others or send from `onboarding@resend.dev` to your own address only.
4. **Environment variables** (Vercel → Settings → Environment Variables):
   - `BETTER_AUTH_SECRET`: output of `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: e.g. `https://woodsidewednesday.vercel.app`
   - `ADMIN_EMAILS`: `kent.yunge@gmail.com`
   - `RESEND_API_KEY`, `EMAIL_FROM`
   - `NEXT_PUBLIC_LEAGUE_TIMEZONE`: e.g. `America/Chicago`
   - `ANTHROPIC_API_KEY`: for the weekly recap email (optional)
   - `RECAP_SEND_TO`: leave unset to send recaps to admins only; set to `league` to email every regular
5. Redeploy, then sign in with your admin email.

## First season checklist

1. **Admin → Golfers**: add the 12 golfers with the emails they'll sign in with.
2. **Admin → Handicaps**: paste last season's rounds from the Google Sheet (`name, YYYY-MM-DD, gross`).
3. **Admin → Seasons → New season**: name it, set the first week, and set status to *Active*.
4. In the season's **Players** tab, tick the 12 players and save.
5. In the season's **Schedule** tab, pick the first Wednesday and click **Generate**.
6. After week 11: **Schedule → Week 12 → Pair from standings**.

**Subs:** add them under **Admin → Subs**, with any previous 9-hole scores. Three or more scores give them an established handicap before their first night; otherwise they play at 80% of that night's round until they have three. Each golfer's page shows their handicap, how it was calculated, and every round on record.

**Weekly recap:** in a season's **Schedule** tab, **Mark complete** closes a week (golfers can no longer edit its scores; the admin still can) and emails a recap written by Claude. It roasts and praises each golfer relative to their own handicap and typical score, and includes the standings table and next week's matchups. Tune the voice under **Admin → Recaps**, where every recap is kept. Recaps go to admins only until `RECAP_SEND_TO=league` is set.

A season you no longer need can be removed from its **Details** tab. Its schedule and scores are deleted, but golfers and carried-over rounds are kept.

## API

Everything the UI does goes through the versioned REST API, so other integrations can use it too:

- OpenAPI spec: `/api/v1/openapi.json`
- Swagger UI: `/api/v1/docs`
- Auth: the session cookie from `/api/auth/*`. For machine-to-machine access, add Better Auth's `apiKey` or `bearer` plugin (`src/lib/auth/index.ts`).

## Project layout

```
src/
  lib/scoring/     pure scoring engine (handicaps, strokes, match points, schedule), unit tested
  db/              Drizzle schema + client (Neon or PGlite)
  server/          domain services: league read model, stats, scores, admin, access control
  server/api/      Hono REST API + OpenAPI schemas
  app/             Next.js pages: (auth)/login, (app)/… dashboards, schedule, matches, admin
  components/      shadcn/ui components + league components (scorecard, standings, …)
drizzle/           SQL migrations
scripts/           migrate + demo seed
```
