import { Link } from "@tanstack/react-router";

interface BackLinkProps {
  to: string;
  params?: Record<string, string>;
  label?: string;
}

export function BackLink({ to, params, label = "Back" }: BackLinkProps) {
  return (
    <Link to={to} params={params} className="back-link">
      ← {label}
    </Link>
  );
}
