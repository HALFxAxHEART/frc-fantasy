import { createFileRoute } from "@tanstack/react-router";
import { StandingsBoard } from "../../../features/scoring/StandingsBoard";

export const Route = createFileRoute("/leagues/$leagueId/standings")({
  component: StandingsPage,
});

function StandingsPage() {
  const { leagueId } = Route.useParams();
  return (
    <div className="page">
      <StandingsBoard leagueId={leagueId} />
    </div>
  );
}
