import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTRPC } from "../../lib/trpc";

interface LeagueHomeProps {
  leagueId: string;
}

export function LeagueHome({ leagueId }: LeagueHomeProps) {
  const trpc = useTRPC();
  const league = useQuery(trpc.league.getById.queryOptions({ leagueId }));
  const members = useQuery(trpc.league.listMembers.queryOptions({ leagueId }));

  if (league.isLoading) return <p>Loading league…</p>;
  if (league.isError) return <p className="form-error">{league.error.message}</p>;
  if (!league.data) return null;

  const l = league.data;

  return (
    <div className="league-home">
      <header>
        <h1>{l.name}</h1>
        <div className="badge-row">
          {l.isPractice && <span className="badge">Practice</span>}
          <span className="badge">{l.spatialTopology === "district" ? `District: ${l.districtKey}` : "Global"}</span>
          <span className="badge">{l.temporalTopology.replace(/_/g, " ")}</span>
          <span className="badge">{l.rosterSize} roster spots</span>
          <span className="badge">Status: {l.status}</span>
        </div>
        <p className="muted">
          Invite code: <code className="invite-code">{l.inviteCode}</code>
        </p>
      </header>

      <nav className="league-subnav">
        <Link to="/leagues/$leagueId/draft" params={{ leagueId }}>
          Draft Room
        </Link>
        <Link to="/leagues/$leagueId/trades" params={{ leagueId }}>
          Trades
        </Link>
        <Link to="/leagues/$leagueId/standings" params={{ leagueId }}>
          Standings
        </Link>
        <Link to="/leagues/$leagueId/settings" params={{ leagueId }}>
          Settings
        </Link>
      </nav>

      <section className="card">
        <h2>Managers</h2>
        {members.isLoading && <p>Loading members…</p>}
        <ul className="member-list">
          {members.data?.map((m) => (
            <li key={m.id}>
              <strong>{m.teamName}</strong>{" "}
              <span className="muted">
                {m.isBot ? "(Bot)" : m.role === "commissioner" ? "(Commissioner)" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
