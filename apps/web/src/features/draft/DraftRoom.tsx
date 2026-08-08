import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";
import { useCurrentUser } from "../../lib/auth-client";
import { Modal } from "../../components/Modal";
import { TeamProfile } from "../team-analytics/TeamProfile";
import { useDraftRoomSocket } from "./useDraftRoomSocket";
import { StartDraftPanel } from "./StartDraftPanel";
import { DraftControls } from "./DraftControls";
import { DraftBoard } from "./DraftBoard";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { TeamPoolPanel } from "./TeamPoolPanel";

interface DraftRoomProps {
  leagueId: string;
}

export function DraftRoom({ leagueId }: DraftRoomProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [viewingTeamNumber, setViewingTeamNumber] = useState<number | null>(null);

  const league = useQuery(trpc.league.getById.queryOptions({ leagueId }));
  const members = useQuery(trpc.league.listMembers.queryOptions({ leagueId }));
  const draftState = useQuery({
    ...trpc.draft.getState.queryOptions({ leagueId }),
    // WS-independent fallback (corporate proxy blocking WS, etc.) — cheap insurance
    // on top of the socket, only while a draft is actually live.
    refetchInterval: (query) => (query.state.data?.draft?.status === "in_progress" ? 15_000 : false),
  });

  useDraftRoomSocket(leagueId, () => {
    queryClient.invalidateQueries({ queryKey: trpc.draft.getState.queryKey({ leagueId }) });
    queryClient.invalidateQueries({ queryKey: trpc.draft.getAvailablePool.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.roster.getLeagueRosters.queryKey({ leagueId }) });
  });

  if (league.isLoading || members.isLoading || draftState.isLoading) return <p>Loading draft room…</p>;
  if (league.isError) return <p className="form-error">{league.error.message}</p>;
  if (members.isError) return <p className="form-error">{members.error.message}</p>;
  if (!league.data || !members.data) return null;

  const myMember = members.data.find((m) => m.userId === user?.id) ?? null;
  const isCommissioner = myMember?.role === "commissioner";

  if (!draftState.data?.draft) {
    return (
      <StartDraftPanel
        leagueId={leagueId}
        isCommissioner={isCommissioner}
        rosterSize={league.data.rosterSize}
        memberCount={members.data.length}
      />
    );
  }

  const { draft, picks } = draftState.data;
  const currentPick = picks.find((p) => p.pickNumber === draft.currentPickNumber);
  const isMyTurn = draft.status === "in_progress" && !!myMember && currentPick?.leagueMemberId === myMember.id;

  return (
    <div className="draft-room">
      <DraftControls leagueId={leagueId} status={draft.status} isCommissioner={isCommissioner} />
      <DraftBoard
        currentPickNumber={draft.currentPickNumber}
        currentPickDeadline={draft.currentPickDeadline}
        status={draft.status}
        picks={picks}
        onViewTeam={setViewingTeamNumber}
      />
      <RecommendationsPanel leagueId={leagueId} isMyTurn={isMyTurn} onViewTeam={setViewingTeamNumber} />
      <TeamPoolPanel
        leagueId={leagueId}
        isMyTurn={isMyTurn}
        isCommissioner={isCommissioner}
        draftInProgress={draft.status === "in_progress"}
        onViewTeam={setViewingTeamNumber}
      />
      {viewingTeamNumber !== null && (
        <Modal onClose={() => setViewingTeamNumber(null)}>
          <TeamProfile teamNumber={viewingTeamNumber} />
        </Modal>
      )}
    </div>
  );
}
