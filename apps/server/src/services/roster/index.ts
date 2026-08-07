import { db, schema } from "@frc-fantasy/db";
import { and, eq, isNull } from "drizzle-orm";
import { NotFoundError } from "../../lib/errors";
import { requireMembership } from "../league";

export async function getMyRoster(leagueId: string, userId: string) {
  const member = await requireMembership(leagueId, userId);

  const [roster] = await db
    .select()
    .from(schema.rosters)
    .where(eq(schema.rosters.leagueMemberId, member.id))
    .limit(1);
  if (!roster) throw new NotFoundError("Roster");

  const slots = await db
    .select()
    .from(schema.rosterSlots)
    .where(and(eq(schema.rosterSlots.rosterId, roster.id), isNull(schema.rosterSlots.droppedAt)));

  return { roster, slots };
}

export async function getLeagueRosters(leagueId: string, userId: string) {
  await requireMembership(leagueId, userId);

  const members = await db
    .select()
    .from(schema.leagueMembers)
    .where(eq(schema.leagueMembers.leagueId, leagueId));

  const results = [];
  for (const member of members) {
    const [roster] = await db
      .select()
      .from(schema.rosters)
      .where(eq(schema.rosters.leagueMemberId, member.id))
      .limit(1);
    if (!roster) continue;
    const slots = await db
      .select()
      .from(schema.rosterSlots)
      .where(and(eq(schema.rosterSlots.rosterId, roster.id), isNull(schema.rosterSlots.droppedAt)));
    results.push({ member, roster, slots });
  }
  return results;
}
