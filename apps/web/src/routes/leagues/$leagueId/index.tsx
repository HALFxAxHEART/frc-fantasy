import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "../../../components/BackLink";
import { LeagueHome } from "../../../features/leagues/LeagueHome";

export const Route = createFileRoute("/leagues/$leagueId/")({
  component: LeagueHomePage,
});

function LeagueHomePage() {
  const { leagueId } = Route.useParams();
  return (
    <div className="page">
      <BackLink to="/leagues" label="Back to my leagues" />
      <LeagueHome leagueId={leagueId} />
    </div>
  );
}
