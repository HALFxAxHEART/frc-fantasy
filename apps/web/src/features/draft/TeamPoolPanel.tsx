import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";

interface TeamPoolPanelProps {
  leagueId: string;
  isMyTurn: boolean;
  isCommissioner: boolean;
  draftInProgress: boolean;
  onViewTeam: (teamNumber: number) => void;
}

export function TeamPoolPanel({ leagueId, isMyTurn, isCommissioner, draftInProgress, onViewTeam }: TeamPoolPanelProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const pool = useQuery(trpc.draft.getAvailablePool.queryOptions({ leagueId, query: query || undefined }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.draft.getState.queryKey({ leagueId }) });
    queryClient.invalidateQueries({ queryKey: trpc.draft.getAvailablePool.queryKey() });
  };

  const makePick = useMutation(trpc.draft.makePick.mutationOptions({ onSuccess: invalidate }));
  const forceAssign = useMutation(trpc.draft.forceAssign.mutationOptions({ onSuccess: invalidate }));

  const error = makePick.error ?? forceAssign.error;

  return (
    <div className="card team-pool-panel">
      <h2>Available Teams</h2>
      <input placeholder="Search by number or name" value={query} onChange={(e) => setQuery(e.target.value)} />
      {error && <p className="form-error">{error.message}</p>}
      {pool.isLoading && <p className="muted">Loading pool…</p>}
      <ul className="team-pool-list">
        {pool.data?.teams.map((team) => (
          <li key={team.key} className="team-pool-row">
            <button type="button" className="team-pool-name" onClick={() => onViewTeam(team.teamNumber)}>
              #{team.teamNumber} {team.nickname}
            </button>
            {draftInProgress && isMyTurn && (
              <button type="button" onClick={() => makePick.mutate({ leagueId, teamKey: team.key })} disabled={makePick.isPending}>
                Draft
              </button>
            )}
            {draftInProgress && isCommissioner && !isMyTurn && (
              <button
                type="button"
                className="force-assign-button"
                onClick={() => forceAssign.mutate({ leagueId, teamKey: team.key })}
                disabled={forceAssign.isPending}
                title="Assign this team to whoever's currently on the clock"
              >
                Force-assign
              </button>
            )}
          </li>
        ))}
      </ul>
      {pool.data?.truncated && <p className="muted">Showing first results — refine your search for more.</p>}
    </div>
  );
}
