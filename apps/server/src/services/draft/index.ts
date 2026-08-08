import { db, schema } from "@frc-fantasy/db";
import { and, eq, ilike, notInArray } from "drizzle-orm";
import { ForbiddenError, ValidationError } from "../../lib/errors";
import { requireMembership } from "../league";
import { rankAvailableTeamsByEpa } from "./bot";
import { claimPick, getLeagueRow, getPickByNumber, lockDraft, pickDeadline, type Draft, type DraftPick } from "./core";
import { alreadyDraftedKeys, poolSize, resolveDraftPool, type PoolTeam } from "./pool";

export interface EnrichedPick extends DraftPick {
  teamNumber: number | null;
  teamNickname: string | null;
  memberTeamName: string;
}

async function requireCommissioner(leagueId: string, userId: string) {
  const member = await requireMembership(leagueId, userId);
  if (member.role !== "commissioner") throw new ForbiddenError("Only the league commissioner can do that.");
  return member;
}

export async function getDraftState(leagueId: string, userId: string): Promise<{ draft: Draft | null; picks: EnrichedPick[] }> {
  await requireMembership(leagueId, userId);

  const [draft] = await db.select().from(schema.drafts).where(eq(schema.drafts.leagueId, leagueId)).limit(1);
  if (!draft) return { draft: null, picks: [] };

  const rows = await db
    .select({
      pick: schema.draftPicks,
      teamNumber: schema.teams.teamNumber,
      teamNickname: schema.teams.nickname,
      memberTeamName: schema.leagueMembers.teamName,
    })
    .from(schema.draftPicks)
    .leftJoin(schema.teams, eq(schema.draftPicks.teamKey, schema.teams.key))
    .innerJoin(schema.leagueMembers, eq(schema.draftPicks.leagueMemberId, schema.leagueMembers.id))
    .where(eq(schema.draftPicks.draftId, draft.id))
    .orderBy(schema.draftPicks.pickNumber);

  return {
    draft,
    picks: rows.map((r) => ({ ...r.pick, teamNumber: r.teamNumber, teamNickname: r.teamNickname, memberTeamName: r.memberTeamName })),
  };
}

export async function getAvailablePool(
  leagueId: string,
  userId: string,
  query?: string,
): Promise<{ bounded: boolean; teams: PoolTeam[]; truncated: boolean }> {
  await requireMembership(leagueId, userId);
  const league = await getLeagueRow(db, leagueId);
  const pool = await resolveDraftPool(league);

  const [draft] = await db.select({ id: schema.drafts.id }).from(schema.drafts).where(eq(schema.drafts.leagueId, leagueId)).limit(1);
  const drafted = new Set(draft ? await alreadyDraftedKeys(db, draft.id) : []);
  const q = query?.trim().toLowerCase() || undefined;

  if (pool.bounded) {
    let teams = pool.teams.filter((t) => !drafted.has(t.key));
    if (q) teams = teams.filter((t) => String(t.teamNumber).includes(q) || t.nickname?.toLowerCase().includes(q));
    const LIMIT = 200;
    return { bounded: true, teams: teams.slice(0, LIMIT), truncated: teams.length > LIMIT };
  }

  const conditions = [];
  if (drafted.size > 0) conditions.push(notInArray(schema.teams.key, [...drafted]));
  if (q) {
    const asNumber = Number(q);
    conditions.push(
      Number.isInteger(asNumber) && asNumber > 0 ? eq(schema.teams.teamNumber, asNumber) : ilike(schema.teams.nickname, `%${q}%`),
    );
  }
  const LIMIT = 50;
  const rows = await db
    .select({ key: schema.teams.key, teamNumber: schema.teams.teamNumber, nickname: schema.teams.nickname })
    .from(schema.teams)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(schema.teams.teamNumber)
    .limit(LIMIT + 1);

  return { bounded: false, teams: rows.slice(0, LIMIT), truncated: rows.length > LIMIT };
}

/**
 * EPA-ranked "best available" list — the same ranking the practice-draft bot picks
 * from, surfaced to the human during their own turn. Only meaningful for bounded
 * pools (practice drafts are restricted to those); returns empty for an unbounded
 * global season-long pool rather than trying to rank thousands of teams.
 */
export async function getRecommendations(leagueId: string, userId: string, limit: number): Promise<PoolTeam[]> {
  await requireMembership(leagueId, userId);

  const league = await getLeagueRow(db, leagueId);
  const [draft] = await db.select({ id: schema.drafts.id }).from(schema.drafts).where(eq(schema.drafts.leagueId, leagueId)).limit(1);
  if (!draft) return [];

  const pool = await resolveDraftPool(league);
  const ranked = await rankAvailableTeamsByEpa(db, draft.id, pool);
  return ranked.slice(0, limit);
}

export async function createDraft(leagueId: string, actingUserId: string): Promise<Draft> {
  await requireCommissioner(leagueId, actingUserId);

  const league = await getLeagueRow(db, leagueId);
  const members = await db.select().from(schema.leagueMembers).where(eq(schema.leagueMembers.leagueId, leagueId));
  if (members.length === 0) throw new ValidationError("A league needs at least one member before drafting.");

  const pool = await resolveDraftPool(league);
  const availableTeams = poolSize(pool);
  const totalPicksNeeded = league.rosterSize * members.length;
  if (availableTeams < totalPicksNeeded) {
    throw new ValidationError(
      `This league's draft pool only has ${availableTeams} eligible teams, but ${totalPicksNeeded} picks are needed ` +
        `(${members.length} managers × ${league.rosterSize} roster spots).`,
    );
  }

  const shuffled = [...members].sort(() => Math.random() - 0.5).map((m) => m.id);
  const secondsPerPick = 90;

  const picksToInsert: (typeof schema.draftPicks.$inferInsert)[] = [];
  let pickNumber = 1;
  for (let round = 1; round <= league.rosterSize; round++) {
    const order = round % 2 === 1 ? shuffled : [...shuffled].reverse();
    for (const leagueMemberId of order) {
      picksToInsert.push({ draftId: "", pickNumber, round, leagueMemberId });
      pickNumber++;
    }
  }

  try {
    return await db.transaction(async (tx) => {
      const [draft] = await tx
        .insert(schema.drafts)
        .values({
          leagueId,
          pickOrder: shuffled,
          status: "in_progress",
          startedAt: new Date(),
          currentPickNumber: 1,
          secondsPerPick,
          currentPickDeadline: pickDeadline(secondsPerPick),
        })
        .returning();
      if (!draft) throw new Error("failed to create draft");

      await tx.insert(schema.draftPicks).values(picksToInsert.map((p) => ({ ...p, draftId: draft.id })));
      await tx.update(schema.leagues).set({ status: "drafting" }).where(eq(schema.leagues.id, leagueId));

      return draft;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ValidationError("A draft has already been started for this league.");
    throw err;
  }
}

export async function makePick(leagueId: string, teamKey: string, actingUserId: string): Promise<DraftPick> {
  const member = await requireMembership(leagueId, actingUserId);

  return db.transaction(async (tx) => {
    const draft = await lockDraft(tx, leagueId);
    if (draft.status !== "in_progress") throw new ValidationError("The draft isn't currently in progress.");

    const league = await getLeagueRow(tx, leagueId);
    const targetPick = await getPickByNumber(tx, draft.id, draft.currentPickNumber);
    if (targetPick.leagueMemberId !== member.id) throw new ValidationError("It's not your turn to pick.");

    const pool = await resolveDraftPool(league);
    return claimPick(tx, draft, league, pool, targetPick, teamKey, false);
  });
}

export async function forceAssignPick(leagueId: string, teamKey: string, actingUserId: string): Promise<DraftPick> {
  await requireCommissioner(leagueId, actingUserId);

  return db.transaction(async (tx) => {
    const draft = await lockDraft(tx, leagueId);
    if (draft.status !== "in_progress") throw new ValidationError("The draft isn't currently in progress.");

    const league = await getLeagueRow(tx, leagueId);
    const targetPick = await getPickByNumber(tx, draft.id, draft.currentPickNumber);

    const pool = await resolveDraftPool(league);
    return claimPick(tx, draft, league, pool, targetPick, teamKey, false);
  });
}

export async function pauseDraft(leagueId: string, actingUserId: string): Promise<Draft> {
  await requireCommissioner(leagueId, actingUserId);

  return db.transaction(async (tx) => {
    const draft = await lockDraft(tx, leagueId);
    if (draft.status !== "in_progress") throw new ValidationError("The draft isn't currently in progress.");

    const [updated] = await tx
      .update(schema.drafts)
      .set({ status: "paused", currentPickDeadline: null })
      .where(eq(schema.drafts.id, draft.id))
      .returning();
    return updated!;
  });
}

export async function resumeDraft(leagueId: string, actingUserId: string): Promise<Draft> {
  await requireCommissioner(leagueId, actingUserId);

  return db.transaction(async (tx) => {
    const draft = await lockDraft(tx, leagueId);
    if (draft.status !== "paused") throw new ValidationError("The draft isn't currently paused.");

    const [updated] = await tx
      .update(schema.drafts)
      .set({ status: "in_progress", currentPickDeadline: pickDeadline(draft.secondsPerPick) })
      .where(eq(schema.drafts.id, draft.id))
      .returning();
    return updated!;
  });
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505";
}
