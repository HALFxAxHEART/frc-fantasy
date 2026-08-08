import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "../../components/BackLink";
import { TeamProfile } from "../../features/team-analytics/TeamProfile";

export const Route = createFileRoute("/teams/$teamNumber")({
  component: TeamProfilePage,
});

function TeamProfilePage() {
  const { teamNumber } = Route.useParams();
  return (
    <div className="page">
      <BackLink to="/teams" label="Back to team search" />
      <TeamProfile teamNumber={Number(teamNumber)} />
    </div>
  );
}
