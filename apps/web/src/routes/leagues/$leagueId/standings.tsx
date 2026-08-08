import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "../../../components/BackLink";
import { StandingsBoard } from "../../../features/scoring/StandingsBoard";

export const Route = createFileRoute("/leagues/$leagueId/standings")({
  component: StandingsPage,
});

function StandingsPage() {
  const { leagueId } = Route.useParams();
  return (
    <div className="page">
      <BackLink to="/leagues/$leagueId" params={{ leagueId }} label="Back to league" />
      <StandingsBoard leagueId={leagueId} />
    </div>
  );
}
