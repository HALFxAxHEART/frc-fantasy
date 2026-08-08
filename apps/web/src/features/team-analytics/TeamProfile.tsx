import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTRPC } from "../../lib/trpc";

interface TeamProfileProps {
  teamNumber: number;
}

/**
 * Standalone — takes only a team number, no route dependency — so the future draft
 * board can drop this straight into a "click a team → see profile" side panel.
 */
export function TeamProfile({ teamNumber }: TeamProfileProps) {
  const trpc = useTRPC();
  const profile = useQuery(trpc.team.getProfile.queryOptions({ teamNumber }));
  // Independent query — district points come from a separate, much cheaper local
  // read (no external API calls), so it shouldn't wait on the slower profile fetch.
  const districtPoints = useQuery(trpc.team.getDistrictPoints.queryOptions({ teamNumber }));

  if (profile.isLoading) return <p>Loading team profile…</p>;
  if (profile.isError) return <p className="form-error">{profile.error.message}</p>;
  if (!profile.data) return null;

  const { team, avatarUrl, yearStats, epaHistory, awards } = profile.data;

  const epaChartData = epaHistory.map((snapshot) => ({
    year: snapshot.year,
    epa: Number(snapshot.epaMean),
  }));

  const totalWins = yearStats.reduce((sum, y) => sum + y.wins, 0);
  const totalLosses = yearStats.reduce((sum, y) => sum + y.losses, 0);
  const totalTies = yearStats.reduce((sum, y) => sum + y.ties, 0);
  const totalPlayed = totalWins + totalLosses + totalTies;
  const winRate = totalPlayed > 0 ? ((totalWins / totalPlayed) * 100).toFixed(1) : null;

  return (
    <div className="team-profile">
      <header className="team-profile-header">
        {avatarUrl && <img src={avatarUrl} alt={`Team ${team.teamNumber} logo`} className="team-avatar" />}
        <div>
          <h1>
            #{team.teamNumber} {team.nickname}
          </h1>
          <p className="muted">{team.name}</p>
          <p className="muted">
            {[team.city, team.stateProv, team.country].filter(Boolean).join(", ")}
            {team.rookieYear && ` · Rookie year ${team.rookieYear}`}
          </p>
        </div>
      </header>

      <section className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{winRate ?? "—"}%</span>
          <span className="stat-label">Career win rate</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{totalWins}-{totalLosses}-{totalTies}</span>
          <span className="stat-label">Career record</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{awards.length}</span>
          <span className="stat-label">Awards won</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">
            {districtPoints.data?.averagePerSeason != null
              ? Math.round(districtPoints.data.averagePerSeason)
              : "—"}
          </span>
          <span className="stat-label">Avg district points / season</span>
        </div>
      </section>

      {epaChartData.length > 0 && (
        <section className="card">
          <h2>EPA trajectory</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={epaChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="epa" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {yearStats.length > 0 && (
        <section className="card">
          <h2>Year-over-year record</h2>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>W-L-T</th>
                <th>Events</th>
                <th>Avg OPR</th>
              </tr>
            </thead>
            <tbody>
              {yearStats.map((y) => (
                <tr key={y.year}>
                  <td>{y.year}</td>
                  <td>
                    {y.wins}-{y.losses}-{y.ties}
                  </td>
                  <td>{y.eventsPlayed}</td>
                  <td>{y.avgOpr ? Number(y.avgOpr).toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h2>District points by season</h2>
        {districtPoints.isLoading && <p className="muted">Loading…</p>}
        {districtPoints.data && districtPoints.data.seasons.length === 0 && (
          <p className="muted">
            No district points synced yet for this team — this fills in once one of its events has been
            scored, either by the nightly sync or by a league that rosters it.
          </p>
        )}
        {districtPoints.data && districtPoints.data.seasons.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Season</th>
                <th>District points</th>
                <th>Events scored</th>
              </tr>
            </thead>
            <tbody>
              {districtPoints.data.seasons.map((s) => (
                <tr key={s.year}>
                  <td>{s.year}</td>
                  <td>{s.totalPoints}</td>
                  <td>{s.eventCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {awards.length > 0 && (
        <section className="card">
          <h2>Awards</h2>
          <ul className="award-list">
            {awards.map((a) => (
              <li key={a.id}>
                <strong>{a.year}</strong> — {a.name}
                {a.recipientName && ` (${a.recipientName})`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
