import { useEffect, useState } from "react";

export interface BoardPick {
  id: string;
  pickNumber: number;
  round: number;
  leagueMemberId: string;
  teamKey: string | null;
  teamNumber: number | null;
  teamNickname: string | null;
  memberTeamName: string;
  isAutopick: boolean;
}

interface DraftBoardProps {
  currentPickNumber: number;
  currentPickDeadline: string | null;
  status: string;
  picks: BoardPick[];
  onViewTeam: (teamNumber: number) => void;
}

/** Client-side only — no per-second server traffic. Resyncs whenever `deadline` changes (a fresh getState). */
function useCountdown(deadline: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;
  return Math.max(0, Math.round((new Date(deadline).getTime() - now) / 1000));
}

export function DraftBoard({ currentPickNumber, currentPickDeadline, status, picks, onViewTeam }: DraftBoardProps) {
  const remaining = useCountdown(currentPickDeadline);

  const rounds = new Map<number, BoardPick[]>();
  for (const pick of picks) {
    const bucket = rounds.get(pick.round);
    if (bucket) bucket.push(pick);
    else rounds.set(pick.round, [pick]);
  }
  const roundNumbers = [...rounds.keys()].sort((a, b) => a - b);

  return (
    <div className="draft-board">
      {roundNumbers.map((round) => (
        <div key={round} className="draft-board-column">
          <div className="draft-board-column-header">Round {round}</div>
          {rounds
            .get(round)!
            .sort((a, b) => a.pickNumber - b.pickNumber)
            .map((pick) => {
              const isCurrent = pick.pickNumber === currentPickNumber && status === "in_progress";
              return (
                <div
                  key={pick.id}
                  className={`draft-pick-card${isCurrent ? " current" : ""}${pick.teamKey ? " filled" : ""}`}
                  onClick={() => pick.teamNumber && onViewTeam(pick.teamNumber)}
                  role={pick.teamNumber ? "button" : undefined}
                >
                  <div className="draft-pick-manager">{pick.memberTeamName}</div>
                  {pick.teamKey ? (
                    <div className="draft-pick-team">
                      #{pick.teamNumber} {pick.teamNickname}
                      {pick.isAutopick && <span className="muted"> (auto)</span>}
                    </div>
                  ) : isCurrent ? (
                    <div className="draft-pick-clock">On the clock{remaining !== null ? ` — ${remaining}s` : ""}</div>
                  ) : (
                    <div className="draft-pick-empty muted">Pick {pick.pickNumber}</div>
                  )}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}
