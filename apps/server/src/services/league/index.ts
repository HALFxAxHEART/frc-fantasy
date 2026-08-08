import { db, schema } from "@frc-fantasy/db";
import { and, eq } from "drizzle-orm";
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  type CreateLeagueInput,
  type UpdateLeagueSettingsInput,
} from "@frc-fantasy/shared";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors";
import { isAdminEmail } from "../../lib/admin";

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

export async function requireCommissioner(leagueId: string, userId: string) {
  const member = await requireMembership(leagueId, userId);
  if (member.role !== "commissioner") throw new ForbiddenError("Only the league commissioner can do that.");
  return member;
}

/**
 * Every real-league operation (drafting, rostering, standings) stays strictly
 * membership-gated via requireMembership/requireCommissioner above — an admin
 * doesn't get to play in leagues they're not part of. These two variants exist
 * only for the moderation surface (viewing/editing/deleting *any* league from the
 * admin panel), where returning `null` means "acting as admin, not as a member."
 */
export async function requireMembershipOrAdmin(leagueId: string, userId: string, userEmail: string) {
  const [member] = await db
    .select()
    .from(schema.leagueMembers)
    .where(and(eq(schema.leagueMembers.leagueId, leagueId), eq(schema.leagueMembers.userId, userId)))
    .limit(1);
  if (member) return member;
  if (isAdminEmail(userEmail)) return null;
  throw new NotFoundError("League membership");
}

export async function requireCommissionerOrAdmin(leagueId: string, userId: string, userEmail: string) {
  const [member] = await db
    .select()
    .from(schema.leagueMembers)
    .where(and(eq(schema.leagueMembers.leagueId, leagueId), eq(schema.leagueMembers.userId, userId)))
    .limit(1);
  if (member) {
    if (member.role === "commissioner") return member;
    if (isAdminEmail(userEmail)) return null;
    throw new ForbiddenError("Only the league commissioner can do that.");
  }
  if (isAdminEmail(userEmail)) return null;
  throw new NotFoundError("League membership");
}

export async function getLeagueById(leagueId: string, userId: string, userEmail: string) {
  await requireMembershipOrAdmin(leagueId, userId, userEmail);
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

export async function listMembers(leagueId: string, userId: string, userEmail: string) {
  await requireMembershipOrAdmin(leagueId, userId, userEmail);
  return db.select().from(schema.leagueMembers).where(eq(schema.leagueMembers.leagueId, leagueId));
}

/** Cascades to members/rosters/roster_slots/draft/draft_picks/scoring via FK cascades. */
export async function deleteLeague(leagueId: string, userId: string, userEmail: string): Promise<void> {
  await requireCommissionerOrAdmin(leagueId, userId, userEmail);
  await db.delete(schema.leagues).where(eq(schema.leagues.id, leagueId));
}

export async function kickMember(
  leagueId: string,
  targetMemberId: string,
  actingUserId: string,
  actingUserEmail: string,
): Promise<void> {
  await requireCommissionerOrAdmin(leagueId, actingUserId, actingUserEmail);

  const [target] = await db
    .select()
    .from(schema.leagueMembers)
    .where(and(eq(schema.leagueMembers.id, targetMemberId), eq(schema.leagueMembers.leagueId, leagueId)))
    .limit(1);
  if (!target) throw new NotFoundError("League member");
  if (target.role === "commissioner") {
    throw new ValidationError("The commissioner can't be removed — delete the league instead.");
  }

  // draft_picks.league_member_id cascades on delete, which would silently remove
  // that member's picks and leave a hole in the pick-number sequence a draft in any
  // state depends on being dense. Restarting the draft first clears that dependency.
  const [draft] = await db.select({ id: schema.drafts.id }).from(schema.drafts).where(eq(schema.drafts.leagueId, leagueId)).limit(1);
  if (draft) {
    throw new ValidationError("Can't remove a member after the draft has started — restart the draft first.");
  }

  await db.delete(schema.leagueMembers).where(eq(schema.leagueMembers.id, targetMemberId));
}

export async function updateLeagueSettings(
  leagueId: string,
  userId: string,
  input: UpdateLeagueSettingsInput,
  userEmail: string,
) {
  await requireCommissionerOrAdmin(leagueId, userId, userEmail);
  const [league] = await db.select().from(schema.leagues).where(eq(schema.leagues.id, leagueId)).limit(1);
  if (!league) throw new NotFoundError("League");

  if (input.rosterSize !== undefined && input.rosterSize !== league.rosterSize && league.status !== "setup") {
    throw new ValidationError("Roster size can only be changed before the draft starts.");
  }

  const [updated] = await db
    .update(schema.leagues)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.leagues.id, leagueId))
    .returning();
  if (!updated) throw new NotFoundError("League");
  return updated;
}
