import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTRPC } from "../../lib/trpc";

export function JoinLeagueForm() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState("");
  const [teamName, setTeamName] = useState("");

  const join = useMutation(
    trpc.league.joinByInviteCode.mutationOptions({
      onSuccess: async (league) => {
        await navigate({ to: "/leagues/$leagueId", params: { leagueId: league.id } });
      },
    }),
  );

  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        join.mutate({ inviteCode, teamName });
      }}
    >
      <label>
        Invite code
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="e.g. 7K4M9QXP"
          required
        />
      </label>
      <label>
        Your fantasy team name
        <input value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
      </label>
      {join.isError && <p className="form-error">{join.error.message}</p>}
      <button type="submit" disabled={join.isPending}>
        {join.isPending ? "Joining…" : "Join league"}
      </button>
    </form>
  );
}
