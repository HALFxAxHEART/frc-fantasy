import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "../../components/BackLink";
import { CreateLeagueWizard } from "../../features/leagues/CreateLeagueWizard";

export const Route = createFileRoute("/leagues/new")({
  component: NewLeaguePage,
});

function NewLeaguePage() {
  return (
    <div className="page page-narrow">
      <BackLink to="/leagues" label="Back to my leagues" />
      <h1>Create a league</h1>
      <CreateLeagueWizard />
    </div>
  );
}
