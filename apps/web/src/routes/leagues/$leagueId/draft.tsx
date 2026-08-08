import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "../../../components/BackLink";
import { DraftRoom } from "../../../features/draft/DraftRoom";

export const Route = createFileRoute("/leagues/$leagueId/draft")({
  component: DraftPage,
});

function DraftPage() {
  const { leagueId } = Route.useParams();
  return (
    <div className="page">
      <BackLink to="/leagues/$leagueId" params={{ leagueId }} label="Back to league" />
      <DraftRoom leagueId={leagueId} />
    </div>
  );
}
