import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "../../../components/ComingSoon";

export const Route = createFileRoute("/leagues/$leagueId/standings")({
  component: StandingsPage,
});

function StandingsPage() {
  return (
    <div className="page">
      <ComingSoon
        title="Standings"
        description="District-points scoring, manager totals, and tiebreakers land here."
      />
    </div>
  );
}
