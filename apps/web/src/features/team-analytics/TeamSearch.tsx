import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTRPC } from "../../lib/trpc";

export function TeamSearch() {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const results = useQuery({
    ...trpc.team.search.queryOptions({ query: submitted }),
    enabled: submitted.length > 0,
  });

  return (
    <div className="team-search">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by team number or name (e.g. 5090)"
        />
        <button type="submit">Search</button>
      </form>

      {results.isFetching && <p>Searching…</p>}
      {results.isError && <p className="form-error">{results.error.message}</p>}
      {results.data && results.data.length === 0 && submitted && <p>No teams found for "{submitted}".</p>}

      <ul className="team-search-results">
        {results.data?.map((team) => (
          <li key={team.key}>
            <Link to="/teams/$teamNumber" params={{ teamNumber: String(team.teamNumber) }}>
              <strong>#{team.teamNumber}</strong> {team.nickname ?? team.name}
              {team.city && <span className="muted"> — {team.city}, {team.stateProv}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
