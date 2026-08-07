import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="page hero">
      <h1>Draft robots, not athletes.</h1>
      <p>
        Fantasy sports for FIRST Robotics Competition. Build a league, draft FRC teams, and
        score points from their real event performance — rankings, OPR, alliance selection,
        and awards.
      </p>
      <div className="hero-actions">
        <Link to="/teams" className="button-link primary">
          Explore Team Analytics
        </Link>
        <Link to="/leagues/new" className="button-link">
          Start a League
        </Link>
      </div>
    </div>
  );
}
