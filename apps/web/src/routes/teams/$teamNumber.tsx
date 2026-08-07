import { createFileRoute } from "@tanstack/react-router";
import { TeamProfile } from "../../features/team-analytics/TeamProfile";

export const Route = createFileRoute("/teams/$teamNumber")({
  component: TeamProfilePage,
});

function TeamProfilePage() {
  const { teamNumber } = Route.useParams();
  return (
    <div className="page">
      <TeamProfile teamNumber={Number(teamNumber)} />
    </div>
  );
}
