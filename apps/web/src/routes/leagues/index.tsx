import { createFileRoute, Link } from "@tanstack/react-router";
import { LeagueList } from "../../features/leagues/LeagueList";

export const Route = createFileRoute("/leagues/")({
  component: LeaguesPage,
});

function LeaguesPage() {
  return (
    <div className="page">
      <header className="page-header">
        <h1>My Leagues</h1>
        <div>
          <Link to="/leagues/join" className="button-link">
            Join with code
          </Link>
          <Link to="/leagues/new" className="button-link primary">
            Create league
          </Link>
        </div>
      </header>
      <LeagueList />
    </div>
  );
}
