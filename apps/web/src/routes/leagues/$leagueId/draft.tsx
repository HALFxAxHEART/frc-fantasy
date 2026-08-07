import { createFileRoute } from "@tanstack/react-router";
import { DraftRoom } from "../../../features/draft/DraftRoom";

export const Route = createFileRoute("/leagues/$leagueId/draft")({
  component: DraftPage,
});

function DraftPage() {
  const { leagueId } = Route.useParams();
  return (
    <div className="page">
      <DraftRoom leagueId={leagueId} />
    </div>
  );
}
