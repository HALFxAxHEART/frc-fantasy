interface ComingSoonProps {
  title: string;
  description: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="card coming-soon">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <p className="muted">Coming in a follow-up session — the database schema is already in place.</p>
    </div>
  );
}
