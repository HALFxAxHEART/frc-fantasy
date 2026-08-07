import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "../lib/auth-client";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const { user, isLoading } = useCurrentUser();

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <Link to="/" className="brand">
          🤖 FRC Fantasy
        </Link>
        <Link to="/teams">Team Analytics</Link>
        <Link to="/leagues">My Leagues</Link>
        <div className="nav-spacer" />
        {isLoading ? null : user ? (
          <span className="nav-user">{user.displayName}</span>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup" className="button-link">
              Sign up
            </Link>
          </>
        )}
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
