import { createFileRoute } from "@tanstack/react-router";
import { JoinLeagueForm } from "../../features/leagues/JoinLeagueForm";

export const Route = createFileRoute("/leagues/join")({
  component: JoinLeaguePage,
});

function JoinLeaguePage() {
  return (
    <div className="page page-narrow">
      <h1>Join a league</h1>
      <JoinLeagueForm />
    </div>
  );
}
