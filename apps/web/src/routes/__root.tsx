import { createRootRouteWithContext, Link, Outlet, useLocation } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useCurrentUser } from "../lib/auth-client";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const { user, isLoading } = useCurrentUser();
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <Link to="/" className="brand">
          🤖 FRC Fantasy
        </Link>
        <Link to="/teams">Team Analytics</Link>
        <Link to="/leagues">My Leagues</Link>
        {user?.isAdmin && <Link to="/admin">Admin</Link>}
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
        {/* Remounts on navigation so a crashed page can recover on its own without a hard refresh. */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
