import { OpenAPIHono, createRoute, z, type RouteConfig } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { account, seasonPlayers, seasons } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getActor, requireActor, requireAdmin, type Actor } from "../access";
import * as admin from "../admin";
import { HttpError, notFound } from "../errors";
import { getCurrentSeason, getSeasons, loadSeason } from "../league";
import { clearEntry, editAccess, getMatch, saveEntry } from "../scores";
import { golferSeasonStats, leagueStats } from "../stats";
import * as S from "./schemas";

type Env = { Variables: { actor: Actor | null } };

export const api = new OpenAPIHono<Env>({
  defaultHook: (result, c) => {
    if (!result.success) {
      const msg = result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
      return c.json({ error: msg }, 400);
    }
  },
}).basePath("/api/v1");

api.use("*", async (c, next) => {
  c.set("actor", await getActor(c.req.raw.headers));
  await next();
});

api.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

// ---------- route helpers ----------

const errors = {
  400: { description: "Invalid request", content: { "application/json": { schema: S.ErrorSchema } } },
  401: { description: "Sign in required", content: { "application/json": { schema: S.ErrorSchema } } },
  403: { description: "Not allowed", content: { "application/json": { schema: S.ErrorSchema } } },
  404: { description: "Not found", content: { "application/json": { schema: S.ErrorSchema } } },
} as const;

function json<T extends z.ZodType>(schema: T, description = "OK") {
  return { 200: { description, content: { "application/json": { schema } } }, ...errors } as const;
}
function body<T extends z.ZodType>(schema: T) {
  return { body: { content: { "application/json": { schema } }, required: true } } as const;
}
function route<R extends RouteConfig>(r: R) {
  return createRoute({ security: [{ session: [] }], ...r });
}

const SeasonIdParam = z.object({ id: z.coerce.number().int().positive().openapi({ param: { name: "id", in: "path" } }) });
const SideParam = S.IdParam.extend({ side: z.enum(["A", "B"]).openapi({ param: { name: "side", in: "path" } }) });

// ---------- me ----------

async function hasPassword(userId: string) {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  return !!row;
}

api.openapi(route({ method: "get", path: "/me", tags: ["Me"], summary: "Current user", responses: json(S.Me) }), async (c) => {
  const a = requireActor(c.get("actor"));
  return c.json({ ...a, hasPassword: await hasPassword(a.userId) }, 200);
});

api.openapi(
  route({
    method: "patch",
    path: "/me",
    tags: ["Me"],
    summary: "Update my profile",
    request: body(
      z.object({
        name: z.string().min(1).optional(),
        username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/).optional(),
        phone: z.string().nullish(),
      }),
    ),
    responses: json(S.OkSchema),
  }),
  async (c) => {
    const a = requireActor(c.get("actor"));
    const input = c.req.valid("json");
    if (input.name || input.username) {
      await auth.api.updateUser({
        headers: c.req.raw.headers,
        body: { ...(input.name && { name: input.name }), ...(input.username && { username: input.username }) },
      });
    }
    if (a.golferId && (input.name || input.phone !== undefined)) {
      await admin.updateGolfer(a.golferId, { name: input.name, phone: input.phone });
    }
    return c.json({ ok: true as const }, 200);
  },
);

api.openapi(
  route({
    method: "post",
    path: "/me/password",
    tags: ["Me"],
    summary: "Set or change my password",
    request: body(z.object({ newPassword: z.string().min(8), currentPassword: z.string().optional() })),
    responses: json(S.OkSchema),
  }),
  async (c) => {
    const a = requireActor(c.get("actor"));
    const { newPassword, currentPassword } = c.req.valid("json");
    const headers = c.req.raw.headers;
    if (await hasPassword(a.userId)) {
      if (!currentPassword) throw new HttpError(400, "Current password is required");
      await auth.api.changePassword({ headers, body: { currentPassword, newPassword } });
    } else {
      await auth.api.setPassword({ headers, body: { newPassword } });
    }
    return c.json({ ok: true as const }, 200);
  },
);

// ---------- seasons ----------

api.openapi(
  route({ method: "get", path: "/seasons", tags: ["Seasons"], summary: "List seasons", responses: json(z.array(S.Season)) }),
  async (c) => {
    requireActor(c.get("actor"));
    return c.json(await getSeasons(), 200);
  },
);

api.openapi(
  route({
    method: "get",
    path: "/seasons/current",
    tags: ["Seasons"],
    summary: "The active season (or most recent)",
    responses: json(S.Season),
  }),
  async (c) => {
    requireActor(c.get("actor"));
    const s = await getCurrentSeason();
    if (!s) throw notFound("No seasons yet");
    return c.json(s, 200);
  },
);

api.openapi(
  route({ method: "post", path: "/seasons", tags: ["Seasons"], summary: "Create a season", request: body(S.SeasonInput), responses: json(S.Season) }),
  async (c) => {
    requireAdmin(c.get("actor"));
    return c.json(await admin.createSeason(c.req.valid("json")), 200);
  },
);

api.openapi(
  route({
    method: "patch",
    path: "/seasons/{id}",
    tags: ["Seasons"],
    summary: "Update a season",
    request: { params: SeasonIdParam, ...body(S.SeasonInput.partial()) },
    responses: json(S.Season),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    return c.json(await admin.updateSeason(c.req.valid("param").id, c.req.valid("json")), 200);
  },
);

api.openapi(
  route({
    method: "get",
    path: "/seasons/{id}",
    tags: ["Seasons"],
    summary: "Season with course, players and full schedule",
    request: { params: SeasonIdParam },
    responses: json(
      z.object({
        season: S.Season,
        holes: z.array(S.Hole),
        par: z.number(),
        players: z.array(S.GolferRef),
        weeks: z.array(S.Week),
        standings: z.array(S.StandingRow),
      }),
    ),
  }),
  async (c) => {
    requireActor(c.get("actor"));
    const d = await loadSeason(c.req.valid("param").id);
    return c.json(
      {
        season: d.season,
        holes: d.holes,
        par: d.par,
        players: d.players.map(({ id, name }) => ({ id, name })),
        weeks: d.weeks,
        standings: d.standings,
      },
      200,
    );
  },
);

api.openapi(
  route({
    method: "put",
    path: "/seasons/{id}/players",
    tags: ["Seasons"],
    summary: "Set the season's regular players",
    request: { params: SeasonIdParam, ...body(z.object({ golferIds: z.array(z.number().int()) })) },
    responses: json(z.object({ golferIds: z.array(z.number()) })),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    const golferIds = await admin.setSeasonPlayers(c.req.valid("param").id, c.req.valid("json").golferIds);
    return c.json({ golferIds }, 200);
  },
);

api.openapi(
  route({
    method: "get",
    path: "/seasons/{id}/weeks",
    tags: ["Schedule"],
    summary: "Schedule with matches and results",
    request: { params: SeasonIdParam },
    responses: json(z.array(S.Week)),
  }),
  async (c) => {
    requireActor(c.get("actor"));
    return c.json((await loadSeason(c.req.valid("param").id)).weeks, 200);
  },
);

api.openapi(
  route({
    method: "get",
    path: "/seasons/{id}/standings",
    tags: ["Stats"],
    summary: "Season standings",
    request: { params: SeasonIdParam },
    responses: json(z.array(S.StandingRow)),
  }),
  async (c) => {
    requireActor(c.get("actor"));
    return c.json((await loadSeason(c.req.valid("param").id)).standings, 200);
  },
);

api.openapi(
  route({
    method: "get",
    path: "/seasons/{id}/stats",
    tags: ["Stats"],
    summary: "League statistics",
    request: { params: SeasonIdParam },
    responses: json(S.LeagueStats),
  }),
  async (c) => {
    requireActor(c.get("actor"));
    return c.json(leagueStats(await loadSeason(c.req.valid("param").id)), 200);
  },
);

api.openapi(
  route({
    method: "get",
    path: "/seasons/{id}/golfers/{golferId}/stats",
    tags: ["Stats"],
    summary: "A golfer's statistics for a season",
    request: {
      params: SeasonIdParam.extend({
        golferId: z.coerce.number().int().positive().openapi({ param: { name: "golferId", in: "path" } }),
      }),
    },
    responses: json(S.GolferStats),
  }),
  async (c) => {
    requireActor(c.get("actor"));
    const { id, golferId } = c.req.valid("param");
    return c.json(golferSeasonStats(await loadSeason(id), golferId), 200);
  },
);

// ---------- schedule ----------

api.openapi(
  route({
    method: "post",
    path: "/seasons/{id}/schedule",
    tags: ["Schedule"],
    summary: "Generate the round-robin schedule (+ position night)",
    description: "Replaces the season's weeks. Only allowed before any scores are entered.",
    request: {
      params: SeasonIdParam,
      ...body(z.object({ startDate: S.DateStr.optional(), positionNight: z.boolean().optional() })),
    },
    responses: json(z.array(S.Week)),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    return c.json((await admin.generateSchedule(c.req.valid("param").id, c.req.valid("json"))).weeks, 200);
  },
);

api.openapi(
  route({
    method: "post",
    path: "/seasons/{id}/position-night",
    tags: ["Schedule"],
    summary: "Pair position night from current standings (1v2, 3v4, …)",
    request: { params: SeasonIdParam, ...body(z.object({ weekId: z.number().int().optional() })) },
    responses: json(
      z.object({ weekId: z.number(), pairs: z.array(z.tuple([z.number(), z.number().nullable()])), incompleteWeeks: z.array(z.number()) }),
    ),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    return c.json(await admin.generatePositionNight(c.req.valid("param").id, c.req.valid("json").weekId), 200);
  },
);

const WeekInput = z.object({
  date: S.DateStr.optional(),
  kind: z.enum(["regular", "position"]).optional(),
  notes: z.string().nullish(),
});
const WeekRow = S.Week.omit({ matches: true, lockDate: true, complete: true });

api.openapi(
  route({
    method: "post",
    path: "/seasons/{id}/weeks",
    tags: ["Schedule"],
    summary: "Add a week",
    request: { params: SeasonIdParam, ...body(WeekInput) },
    responses: json(WeekRow),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    return c.json(await admin.createWeek(c.req.valid("param").id, c.req.valid("json")), 200);
  },
);

api.openapi(
  route({
    method: "patch",
    path: "/weeks/{id}",
    tags: ["Schedule"],
    summary: "Update a week",
    request: { params: S.IdParam, ...body(WeekInput) },
    responses: json(WeekRow),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    return c.json(await admin.updateWeek(c.req.valid("param").id, c.req.valid("json")), 200);
  },
);

api.openapi(
  route({ method: "delete", path: "/weeks/{id}", tags: ["Schedule"], summary: "Delete a week", request: { params: S.IdParam }, responses: json(S.OkSchema) }),
  async (c) => {
    requireAdmin(c.get("actor"));
    await admin.deleteWeek(c.req.valid("param").id);
    return c.json({ ok: true as const }, 200);
  },
);

api.openapi(
  route({
    method: "post",
    path: "/weeks/{id}/postpone",
    tags: ["Schedule"],
    summary: "Rainout: push this week and all later weeks back",
    request: {
      params: S.IdParam,
      ...body(z.object({ reason: z.string().optional(), days: z.number().int().min(1).max(60).optional() })),
    },
    responses: json(WeekRow),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    const { reason, days } = c.req.valid("json");
    return c.json(await admin.postponeWeek(c.req.valid("param").id, reason, days), 200);
  },
);

const MatchInput = z.object({ golferAId: z.number().int(), golferBId: z.number().int().nullable() });
const MatchRow = z.object({ id: z.number(), weekId: z.number(), golferAId: z.number(), golferBId: z.number().nullable() });

api.openapi(
  route({
    method: "post",
    path: "/weeks/{id}/matches",
    tags: ["Schedule"],
    summary: "Add a match to a week",
    request: { params: S.IdParam, ...body(MatchInput) },
    responses: json(MatchRow),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    const { golferAId, golferBId } = c.req.valid("json");
    return c.json(await admin.createMatch(c.req.valid("param").id, golferAId, golferBId), 200);
  },
);

// ---------- matches & scores ----------

api.openapi(
  route({
    method: "get",
    path: "/matches/{id}",
    tags: ["Matches"],
    summary: "Scorecard: hole-by-hole strokes, net scores and points",
    request: { params: S.IdParam },
    responses: json(
      z.object({
        match: S.Match,
        holes: z.array(S.Hole),
        lockDate: z.string(),
        canEdit: z.boolean(),
        canEditReason: z.string().nullable(),
      }),
    ),
  }),
  async (c) => {
    const actor = requireActor(c.get("actor"));
    const { data, match, week } = await getMatch(c.req.valid("param").id);
    const access = editAccess(actor, match, week);
    return c.json(
      {
        match,
        holes: data.holes,
        lockDate: week.lockDate,
        canEdit: access.allowed,
        canEditReason: access.allowed ? null : access.reason,
      },
      200,
    );
  },
);

api.openapi(
  route({
    method: "patch",
    path: "/matches/{id}",
    tags: ["Matches"],
    summary: "Change a match's pairing",
    request: { params: S.IdParam, ...body(MatchInput) },
    responses: json(MatchRow),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    const { golferAId, golferBId } = c.req.valid("json");
    return c.json(await admin.updateMatch(c.req.valid("param").id, golferAId, golferBId), 200);
  },
);

api.openapi(
  route({ method: "delete", path: "/matches/{id}", tags: ["Matches"], summary: "Delete a match", request: { params: S.IdParam }, responses: json(S.OkSchema) }),
  async (c) => {
    requireAdmin(c.get("actor"));
    await admin.deleteMatch(c.req.valid("param").id);
    return c.json({ ok: true as const }, 200);
  },
);

api.openapi(
  route({
    method: "put",
    path: "/matches/{id}/entries/{side}",
    tags: ["Matches"],
    summary: "Enter or replace one side's card (latest save wins)",
    description:
      "Golfers in the match can enter either side until the next week's date. The admin can always edit and override handicaps.",
    request: { params: SideParam, ...body(S.EntryInput) },
    responses: json(S.Match),
  }),
  async (c) => {
    const { id, side } = c.req.valid("param");
    return c.json(await saveEntry(c.get("actor"), id, side, c.req.valid("json")), 200);
  },
);

api.openapi(
  route({
    method: "delete",
    path: "/matches/{id}/entries/{side}",
    tags: ["Matches"],
    summary: "Clear one side's card",
    request: { params: SideParam },
    responses: json(S.Match),
  }),
  async (c) => {
    const { id, side } = c.req.valid("param");
    return c.json(await clearEntry(c.get("actor"), id, side), 200);
  },
);

// ---------- golfers ----------

api.openapi(
  route({ method: "get", path: "/golfers", tags: ["Golfers"], summary: "All golfers (regulars and subs)", responses: json(z.array(S.Golfer)) }),
  async (c) => {
    requireActor(c.get("actor"));
    return c.json(await admin.listGolfers(), 200);
  },
);

api.openapi(
  route({ method: "post", path: "/golfers", tags: ["Golfers"], summary: "Add a golfer", request: body(S.GolferInput), responses: json(S.Golfer) }),
  async (c) => {
    requireAdmin(c.get("actor"));
    return c.json(await admin.createGolfer(c.req.valid("json")), 200);
  },
);

api.openapi(
  route({
    method: "patch",
    path: "/golfers/{id}",
    tags: ["Golfers"],
    summary: "Update a golfer",
    request: { params: S.IdParam, ...body(S.GolferInput.partial()) },
    responses: json(S.Golfer),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    return c.json(await admin.updateGolfer(c.req.valid("param").id, c.req.valid("json")), 200);
  },
);

api.openapi(
  route({
    method: "get",
    path: "/golfers/{id}/seasons",
    tags: ["Golfers"],
    summary: "Seasons a golfer was a regular in",
    request: { params: S.IdParam },
    responses: json(z.array(S.Season)),
  }),
  async (c) => {
    requireActor(c.get("actor"));
    const rows = await db
      .select({ s: seasons })
      .from(seasonPlayers)
      .innerJoin(seasons, eq(seasonPlayers.seasonId, seasons.id))
      .where(eq(seasonPlayers.golferId, c.req.valid("param").id));
    return c.json(rows.map((r) => r.s), 200);
  },
);

// ---------- historical rounds ----------

api.openapi(
  route({
    method: "get",
    path: "/historical-rounds",
    tags: ["Handicaps"],
    summary: "Rounds carried over from before the app",
    request: { query: z.object({ golferId: z.coerce.number().int().optional() }) },
    responses: json(z.array(S.HistoricalRound)),
  }),
  async (c) => {
    requireActor(c.get("actor"));
    return c.json(await admin.listHistoricalRounds(c.req.valid("query").golferId), 200);
  },
);

api.openapi(
  route({
    method: "post",
    path: "/historical-rounds",
    tags: ["Handicaps"],
    summary: "Add carried-over rounds",
    request: body(
      z.object({
        rounds: z.array(
          z.object({ golferId: z.number().int(), playedOn: S.DateStr, gross: z.number().int(), par: z.number().int().optional(), note: z.string().nullish() }),
        ),
      }),
    ),
    responses: json(z.array(S.HistoricalRound)),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    return c.json(await admin.addHistoricalRounds(c.req.valid("json").rounds), 200);
  },
);

api.openapi(
  route({
    method: "post",
    path: "/historical-rounds/import",
    tags: ["Handicaps"],
    summary: "Import CSV lines: golfer name or email, YYYY-MM-DD, gross",
    request: body(z.object({ csv: z.string() })),
    responses: json(z.object({ imported: z.number(), errors: z.array(z.string()) })),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    return c.json(await admin.importHistoricalCsv(c.req.valid("json").csv), 200);
  },
);

api.openapi(
  route({
    method: "delete",
    path: "/historical-rounds/{id}",
    tags: ["Handicaps"],
    summary: "Delete a carried-over round",
    request: { params: S.IdParam },
    responses: json(S.OkSchema),
  }),
  async (c) => {
    requireAdmin(c.get("actor"));
    await admin.deleteHistoricalRound(c.req.valid("param").id);
    return c.json({ ok: true as const }, 200);
  },
);

// ---------- docs ----------

api.openAPIRegistry.registerComponent("securitySchemes", "session", {
  type: "apiKey",
  in: "cookie",
  name: "better-auth.session_token",
});

api.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Woodside Wednesday API",
    version: "1.0.0",
    description: "Golf league API: seasons, schedule, scores, standings and stats.",
  },
});
api.get("/docs", swaggerUI({ url: "/api/v1/openapi.json" }));
