import { db, schema } from "@frc-fantasy/db";
import { and, eq } from "drizzle-orm";
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH, type CreateLeagueInput } from "@frc-fantasy/shared";
import { NotFoundError, ValidationError } from "../../lib/errors";

function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

async function uniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    const [existing] = await db
      .select({ id: schema.leagues.id })
      .from(schema.leagues)
      .where(eq(schema.leagues.inviteCode, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("failed to generate a unique invite code after 10 attempts");
}

export async function createLeague(input: CreateLeagueInput, commissionerId: string, commissionerTeamName: string) {
  const inviteCode = await uniqueInviteCode();

  return db.transaction(async (tx) => {
    const [league] = await tx
      .insert(schema.leagues)
      .values({
        name: input.name,
        inviteCode,
        commissionerId,
        spatialTopology: input.spatialTopology,
        districtKey: input.districtKey ?? null,
        temporalTopology: input.temporalTopology,
        tbaEventKey: input.tbaEventKey ?? null,
        seasonYear: input.seasonYear,
        rosterSize: input.rosterSize,
      })
      .returning();
    if (!league) throw new Error("failed to create league");

    const [member] = await tx
      .insert(schema.leagueMembers)
      .values({
        leagueId: league.id,
        userId: commissionerId,
        role: "commissioner",
        teamName: commissionerTeamName,
      })
      .returning();
    if (!member) throw new Error("failed to create commissioner membership");

    await tx.insert(schema.rosters).values({ leagueMemberId: member.id });
    await tx.insert(schema.scoringRulesets).values({ leagueId: league.id });

    return league;
  });
}

export async function joinLeagueByInviteCode(inviteCode: string, userId: string, teamName: string) {
  const [league] = await db
    .select()
    .from(schema.leagues)
    .where(eq(schema.leagues.inviteCode, inviteCode))
    .limit(1);
  if (!league) throw new NotFoundError("League with that invite code");

  const [existingMembership] = await db
    .select({ id: schema.leagueMembers.id })
    .from(schema.leagueMembers)
    .where(and(eq(schema.leagueMembers.leagueId, league.id), eq(schema.leagueMembers.userId, userId)))
    .limit(1);
  if (existingMembership) throw new ValidationError("You're already a member of this league.");

  return db.transaction(async (tx) => {
    const [member] = await tx
      .insert(schema.leagueMembers)
      .values({ leagueId: league.id, userId, role: "manager", teamName })
      .returning();
    if (!member) throw new Error("failed to create membership");

    await tx.insert(schema.rosters).values({ leagueMemberId: member.id });
    return league;
  });
}

export async function requireMembership(leagueId: string, userId: string) {
  const [member] = await db
    .select()
    .from(schema.leagueMembers)
    .where(and(eq(schema.leagueMembers.leagueId, leagueId), eq(schema.leagueMembers.userId, userId)))
    .limit(1);
  if (!member) throw new NotFoundError("League membership");
  return member;
}

export async function getLeagueById(leagueId: string, userId: string) {
  await requireMembership(leagueId, userId);
  const [league] = await db.select().from(schema.leagues).where(eq(schema.leagues.id, leagueId)).limit(1);
  if (!league) throw new NotFoundError("League");
  return league;
}

export async function listMyLeagues(userId: string) {
  return db
    .select({ league: schema.leagues, member: schema.leagueMembers })
    .from(schema.leagueMembers)
    .innerJoin(schema.leagues, eq(schema.leagueMembers.leagueId, schema.leagues.id))
    .where(eq(schema.leagueMembers.userId, userId));
}

export async function listMembers(leagueId: string, userId: string) {
  await requireMembership(leagueId, userId);
  return db.select().from(schema.leagueMembers).where(eq(schema.leagueMembers.leagueId, leagueId));
}
