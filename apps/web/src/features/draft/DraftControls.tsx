import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";

interface DraftControlsProps {
  leagueId: string;
  status: string;
  isCommissioner: boolean;
}

export function DraftControls({ leagueId, status, isCommissioner }: DraftControlsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.draft.getState.queryKey({ leagueId }) });

  const pause = useMutation(trpc.draft.pause.mutationOptions({ onSuccess: invalidate }));
  const resume = useMutation(trpc.draft.resume.mutationOptions({ onSuccess: invalidate }));

  const error = pause.error ?? resume.error;

  return (
    <div className="draft-controls">
      <span className="badge">{status.replace(/_/g, " ")}</span>
      {isCommissioner && (
        <>
          {status === "in_progress" && (
            <button type="button" onClick={() => pause.mutate({ leagueId })} disabled={pause.isPending}>
              Pause
            </button>
          )}
          {status === "paused" && (
            <button type="button" onClick={() => resume.mutate({ leagueId })} disabled={resume.isPending}>
              Resume
            </button>
          )}
        </>
      )}
      {error && <p className="form-error">{error.message}</p>}
    </div>
  );
}
