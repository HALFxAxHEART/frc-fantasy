import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "../../../components/BackLink";
import { LeagueSettings } from "../../../features/leagues/LeagueSettings";

export const Route = createFileRoute("/leagues/$leagueId/settings")({
  component: LeagueSettingsPage,
});

function LeagueSettingsPage() {
  const { leagueId } = Route.useParams();
  return (
    <div className="page">
      <BackLink to="/leagues/$leagueId" params={{ leagueId }} label="Back to league" />
      <LeagueSettings leagueId={leagueId} />
    </div>
  );
}
