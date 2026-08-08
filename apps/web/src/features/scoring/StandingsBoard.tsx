import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { useTRPC } from "../../lib/trpc";

interface StandingsBoardProps {
  leagueId: string;
}

const TIEBREAKER_LABELS: Record<string, string> = {
  avg_raw_alliance_score: "Avg Alliance Score",
  opr: "Avg OPR",
};

function formatPoints(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatTiebreaker(n: number | null): string {
  return n === null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function StandingsBoard({ leagueId }: StandingsBoardProps) {
  const trpc = useTRPC();
  const standings = useQuery(trpc.scoring.getLeagueStandings.queryOptions({ leagueId }));
  const [expanded, setExpanded] = useState<string | null>(null);

  if (standings.isLoading) return <p>Loading standings…</p>;
  if (standings.isError) return <p className="form-error">{standings.error.message}</p>;
  if (!standings.data) return null;

  const { standings: rows, tiebreaker1, tiebreaker2 } = standings.data;
  const latestComputedAt = rows.reduce<Date | null>((latest, r) => {
    const computedAt = new Date(r.computedAt);
    return !latest || computedAt > latest ? computedAt : latest;
  }, null);
  const hasAnyPoints = rows.some((r) => r.totalPoints > 0);

  return (
    <div className="standings-board">
      {latestComputedAt && (
        <p className="muted standings-freshness">As of {latestComputedAt.toLocaleString()}</p>
      )}

      {!hasAnyPoints && (
        <p className="muted">
          No events scored yet — check back once your rostered teams start competing.
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Manager</th>
            <th>Total</th>
            <th>Rookie Bonus</th>
            <th>{TIEBREAKER_LABELS[tiebreaker1] ?? tiebreaker1}</th>
            <th>{TIEBREAKER_LABELS[tiebreaker2] ?? tiebreaker2}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Fragment key={row.leagueMemberId}>
              <tr
                className="standings-row"
                onClick={() => setExpanded(expanded === row.leagueMemberId ? null : row.leagueMemberId)}
              >
                <td>{i + 1}</td>
                <td>{row.teamName}</td>
                <td>{formatPoints(row.totalPoints)}</td>
                <td>{row.rookieBonusPoints > 0 ? formatPoints(row.rookieBonusPoints) : "—"}</td>
                <td>{formatTiebreaker(row.tiebreaker1)}</td>
                <td>{formatTiebreaker(row.tiebreaker2)}</td>
              </tr>
              {expanded === row.leagueMemberId && (
                <tr className="standings-detail-row">
                  <td colSpan={6}>
                    {row.events.length === 0 ? (
                      <p className="muted">No scored events yet for this roster.</p>
                    ) : (
                      <table className="standings-detail-table">
                        <thead>
                          <tr>
                            <th>Event</th>
                            <th>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.events.map((e) => (
                            <tr key={e.eventKey}>
                              <td>{e.eventKey}</td>
                              <td>{formatPoints(e.totalPoints)}</td>
                            </tr>
                          ))}
                          <tr>
                            <td className="muted">Rookie bonus (season)</td>
                            <td>{row.rookieBonusPoints > 0 ? formatPoints(row.rookieBonusPoints) : "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
