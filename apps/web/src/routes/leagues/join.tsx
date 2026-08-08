import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "../../components/BackLink";
import { JoinLeagueForm } from "../../features/leagues/JoinLeagueForm";

export const Route = createFileRoute("/leagues/join")({
  component: JoinLeaguePage,
});

function JoinLeaguePage() {
  return (
    <div className="page page-narrow">
      <BackLink to="/leagues" label="Back to my leagues" />
      <h1>Join a league</h1>
      <JoinLeagueForm />
    </div>
  );
}
