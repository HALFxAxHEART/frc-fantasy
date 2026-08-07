import { createFileRoute } from "@tanstack/react-router";
import { TeamSearch } from "../../features/team-analytics/TeamSearch";

export const Route = createFileRoute("/teams/")({
  component: TeamsPage,
});

function TeamsPage() {
  return (
    <div className="page">
      <h1>Team Analytics</h1>
      <p className="muted">Search any FRC team to see its full performance profile.</p>
      <TeamSearch />
    </div>
  );
}
