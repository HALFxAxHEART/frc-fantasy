import { createFileRoute } from "@tanstack/react-router";
import { CreateLeagueWizard } from "../../features/leagues/CreateLeagueWizard";

export const Route = createFileRoute("/leagues/new")({
  component: NewLeaguePage,
});

function NewLeaguePage() {
  return (
    <div className="page page-narrow">
      <h1>Create a league</h1>
      <CreateLeagueWizard />
    </div>
  );
}
