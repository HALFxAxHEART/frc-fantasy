import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";

interface LeagueSettingsProps {
  leagueId: string;
}

export function LeagueSettings({ leagueId }: LeagueSettingsProps) {
  const trpc = useTRPC();
  const league = useQuery(trpc.league.getById.queryOptions({ leagueId }));

  if (league.isLoading) return <p>Loading settings…</p>;
  if (league.isError) return <p className="form-error">{league.error.message}</p>;
  if (!league.data) return null;

  const l = league.data;

  return (
    <div className="card">
      <h2>League settings</h2>
      <dl className="settings-list">
        <dt>Name</dt>
        <dd>{l.name}</dd>
        <dt>Spatial topology</dt>
        <dd>{l.spatialTopology === "district" ? `District (${l.districtKey})` : "Global"}</dd>
        <dt>Temporal topology</dt>
        <dd>{l.temporalTopology.replace(/_/g, " ")}</dd>
        {l.tbaEventKey && (
          <>
            <dt>Event</dt>
            <dd>{l.tbaEventKey}</dd>
          </>
        )}
        <dt>Roster size</dt>
        <dd>{l.rosterSize} picks per manager</dd>
        <dt>Trade window</dt>
        <dd>
          Opens day {l.tradeWindowOpenDay} at {l.tradeWindowOpenTime}, closes day{" "}
          {l.tradeWindowCloseDay} at {l.tradeWindowCloseTime} ({l.tradeWindowTimezone})
        </dd>
        <dt>Invite code</dt>
        <dd>
          <code className="invite-code">{l.inviteCode}</code>
        </dd>
      </dl>
      <p className="muted">Editing league settings after creation ships in a follow-up session.</p>
    </div>
  );
}
