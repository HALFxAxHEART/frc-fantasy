import { createFileRoute } from "@tanstack/react-router";
import { LeagueSettings } from "../../../features/leagues/LeagueSettings";

export const Route = createFileRoute("/leagues/$leagueId/settings")({
  component: LeagueSettingsPage,
});

function LeagueSettingsPage() {
  const { leagueId } = Route.useParams();
  return (
    <div className="page">
      <LeagueSettings leagueId={leagueId} />
    </div>
  );
}
