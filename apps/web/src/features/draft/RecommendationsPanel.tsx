import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";

interface RecommendationsPanelProps {
  leagueId: string;
  isMyTurn: boolean;
  onViewTeam: (teamNumber: number) => void;
}

/** EPA-ranked "best available" list — the same ranking the practice-draft bot picks from. */
export function RecommendationsPanel({ leagueId, isMyTurn, onViewTeam }: RecommendationsPanelProps) {
  const trpc = useTRPC();
  const recommendations = useQuery({
    ...trpc.draft.getRecommendations.queryOptions({ leagueId, limit: 5 }),
    enabled: isMyTurn,
  });

  if (!isMyTurn) return null;
  if (recommendations.isLoading) return null;
  if (!recommendations.data || recommendations.data.length === 0) return null;

  return (
    <div className="card recommendations-panel">
      <h2>Recommended for you</h2>
      <p className="muted">Ranked by Statbotics EPA — highest-performing available teams first.</p>
      <ol className="recommendations-list">
        {recommendations.data.map((team) => (
          <li key={team.key}>
            <button type="button" className="team-pool-name" onClick={() => onViewTeam(team.teamNumber)}>
              #{team.teamNumber} {team.nickname}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
