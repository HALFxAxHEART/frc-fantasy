import { createFileRoute } from "@tanstack/react-router";
import { LeagueHome } from "../../../features/leagues/LeagueHome";

export const Route = createFileRoute("/leagues/$leagueId/")({
  component: LeagueHomePage,
});

function LeagueHomePage() {
  const { leagueId } = Route.useParams();
  return (
    <div className="page">
      <LeagueHome leagueId={leagueId} />
    </div>
  );
}
