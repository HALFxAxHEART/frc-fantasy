import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";

interface StartDraftPanelProps {
  leagueId: string;
  isCommissioner: boolean;
  rosterSize: number;
  memberCount: number;
}

export function StartDraftPanel({ leagueId, isCommissioner, rosterSize, memberCount }: StartDraftPanelProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const start = useMutation(
    trpc.draft.create.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.draft.getState.queryKey({ leagueId }) }),
    }),
  );

  return (
    <div className="card coming-soon">
      <h2>Draft Room</h2>
      <p className="muted">
        {memberCount} manager{memberCount === 1 ? "" : "s"} · {rosterSize} picks each · {memberCount * rosterSize} total
        picks
      </p>
      {isCommissioner ? (
        <>
          <button type="button" onClick={() => start.mutate({ leagueId })} disabled={start.isPending}>
            {start.isPending ? "Starting…" : "Start Draft"}
          </button>
          {start.isError && <p className="form-error">{start.error.message}</p>}
        </>
      ) : (
        <p className="muted">Waiting for the commissioner to start the draft.</p>
      )}
    </div>
  );
}
