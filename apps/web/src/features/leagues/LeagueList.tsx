import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTRPC } from "../../lib/trpc";

const TOPOLOGY_LABEL: Record<string, string> = {
  season_long: "Season-long",
  single_event: "Single event",
  weekly_event_draft: "Weekly event draft",
};

export function LeagueList() {
  const trpc = useTRPC();
  const leagues = useQuery(trpc.league.listMine.queryOptions());

  if (leagues.isLoading) return <p>Loading your leagues…</p>;
  if (leagues.isError) return <p className="form-error">{leagues.error.message}</p>;
  if (!leagues.data || leagues.data.length === 0) {
    return <p className="muted">You're not in any leagues yet — create one or join with an invite code.</p>;
  }

  return (
    <ul className="league-list">
      {leagues.data.map(({ league, member }) => (
        <li key={league.id}>
          <Link to="/leagues/$leagueId" params={{ leagueId: league.id }} className="league-list-item">
            <strong>{league.name}</strong>
            <span className="muted">
              {TOPOLOGY_LABEL[league.temporalTopology] ?? league.temporalTopology} ·{" "}
              {member.role === "commissioner" ? "Commissioner" : "Manager"} · {member.teamName}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
