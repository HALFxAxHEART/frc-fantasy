import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTRPC } from "../../lib/trpc";
import { useCurrentUser } from "../../lib/auth-client";
import { ConfirmDialog } from "../../components/ConfirmDialog";

interface LeagueSettingsProps {
  leagueId: string;
}

const DAY_LABELS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type PendingConfirm =
  | { type: "kick"; memberId: string; teamName: string }
  | { type: "restart" }
  | { type: "delete" };

export function LeagueSettings({ leagueId }: LeagueSettingsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const league = useQuery(trpc.league.getById.queryOptions({ leagueId }));
  const members = useQuery(trpc.league.listMembers.queryOptions({ leagueId }));

  const [name, setName] = useState<string | null>(null);
  const [rosterSize, setRosterSize] = useState<number | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [openTime, setOpenTime] = useState<string | null>(null);
  const [closeDay, setCloseDay] = useState<number | null>(null);
  const [closeTime, setCloseTime] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const invalidateLeague = () => queryClient.invalidateQueries({ queryKey: trpc.league.getById.queryKey({ leagueId }) });
  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: trpc.league.listMembers.queryKey({ leagueId }) });

  const updateSettings = useMutation(trpc.league.updateSettings.mutationOptions({ onSuccess: invalidateLeague }));
  const kickMember = useMutation(
    trpc.league.kickMember.mutationOptions({
      onSuccess: () => {
        invalidateMembers();
        setPendingConfirm(null);
      },
    }),
  );
  const deleteLeague = useMutation(
    trpc.league.delete.mutationOptions({ onSuccess: () => navigate({ to: "/leagues" }) }),
  );
  const restartDraft = useMutation(
    trpc.draft.restart.mutationOptions({
      onSuccess: () => {
        invalidateLeague();
        queryClient.invalidateQueries({ queryKey: trpc.draft.getState.queryKey({ leagueId }) });
        setPendingConfirm(null);
      },
    }),
  );

  if (league.isLoading || members.isLoading) return <p>Loading settings…</p>;
  if (league.isError) return <p className="form-error">{league.error.message}</p>;
  if (!league.data || !members.data) return null;

  const l = league.data;
  const myMember = members.data.find((m) => m.userId === user?.id) ?? null;
  const isCommissioner = myMember?.role === "commissioner";
  const canManage = isCommissioner || !!user?.isAdmin;
  const draftStarted = l.status !== "setup";

  return (
    <div className="settings-page">
      <div className="card">
        <h2>League settings</h2>
        <dl className="settings-list">
          <dt>Spatial topology</dt>
          <dd>{l.spatialTopology === "district" ? `District (${l.districtKey})` : "Global"}</dd>
          <dt>Temporal topology</dt>
          <dd>{l.temporalTopology.replace(/_/g, " ")}</dd>
          {l.tbaEventKey && (
            <>
              <dt>Event</dt>
              <dd>{l.tbaEventKey}</dd>
            </>
          )}
          <dt>Invite code</dt>
          <dd>
            <code className="invite-code">{l.inviteCode}</code>
          </dd>
        </dl>

        <form
          className="league-wizard"
          onSubmit={(e) => {
            e.preventDefault();
            updateSettings.mutate({
              leagueId,
              settings: {
                name: name ?? undefined,
                rosterSize: rosterSize ?? undefined,
                tradeWindowOpenDay: openDay ?? undefined,
                tradeWindowOpenTime: openTime ?? undefined,
                tradeWindowCloseDay: closeDay ?? undefined,
                tradeWindowCloseTime: closeTime ?? undefined,
                tradeWindowTimezone: timezone ?? undefined,
              },
            });
          }}
        >
          <label>
            League name
            <input value={name ?? l.name} onChange={(e) => setName(e.target.value)} disabled={!canManage} required />
          </label>
          <label>
            Roster size
            <input
              type="number"
              min={1}
              max={30}
              value={rosterSize ?? l.rosterSize}
              onChange={(e) => setRosterSize(Number(e.target.value))}
              disabled={!canManage || draftStarted}
              required
            />
          </label>
          {draftStarted && <p className="muted">Roster size can't change after the draft has started.</p>}

          <h3>Trade window</h3>
          <label>
            Opens
            <select value={openDay ?? l.tradeWindowOpenDay} onChange={(e) => setOpenDay(Number(e.target.value))} disabled={!canManage}>
              {DAY_LABELS.slice(1).map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={openTime ?? l.tradeWindowOpenTime.slice(0, 5)}
              onChange={(e) => setOpenTime(e.target.value)}
              disabled={!canManage}
            />
          </label>
          <label>
            Closes
            <select value={closeDay ?? l.tradeWindowCloseDay} onChange={(e) => setCloseDay(Number(e.target.value))} disabled={!canManage}>
              {DAY_LABELS.slice(1).map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={closeTime ?? l.tradeWindowCloseTime.slice(0, 5)}
              onChange={(e) => setCloseTime(e.target.value)}
              disabled={!canManage}
            />
          </label>
          <label>
            Timezone
            <input value={timezone ?? l.tradeWindowTimezone} onChange={(e) => setTimezone(e.target.value)} disabled={!canManage} />
          </label>

          {canManage && (
            <>
              {updateSettings.isError && <p className="form-error">{updateSettings.error.message}</p>}
              <button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? "Saving…" : "Save settings"}
              </button>
            </>
          )}
        </form>
      </div>

      <div className="card">
        <h2>Managers</h2>
        <ul className="member-list">
          {members.data.map((m) => (
            <li key={m.id} className="member-list-row">
              <span>
                <strong>{m.teamName}</strong>{" "}
                <span className="muted">{m.isBot ? "(Bot)" : m.role === "commissioner" ? "(Commissioner)" : ""}</span>
              </span>
              {canManage && m.role !== "commissioner" && (
                <button
                  type="button"
                  className="force-assign-button"
                  disabled={kickMember.isPending || draftStarted}
                  title={draftStarted ? "Restart the draft before removing members" : undefined}
                  onClick={() => setPendingConfirm({ type: "kick", memberId: m.id, teamName: m.teamName })}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {kickMember.isError && <p className="form-error">{kickMember.error.message}</p>}
      </div>

      {canManage && (
        <div className="card danger-zone">
          <h2>Danger zone</h2>
          {draftStarted && (
            <div className="danger-zone-row">
              <div>
                <strong>Restart the draft</strong>
                <p className="muted">Deletes the current draft and every draft-made pick. Rosters reset completely.</p>
              </div>
              <button
                type="button"
                className="danger-button"
                disabled={restartDraft.isPending}
                onClick={() => setPendingConfirm({ type: "restart" })}
              >
                {restartDraft.isPending ? "Restarting…" : "Restart draft"}
              </button>
            </div>
          )}
          <div className="danger-zone-row">
            <div>
              <strong>Delete this league</strong>
              <p className="muted">Permanently deletes the league, its draft, rosters, and standings. Can't be undone.</p>
            </div>
            <button
              type="button"
              className="danger-button"
              disabled={deleteLeague.isPending}
              onClick={() => setPendingConfirm({ type: "delete" })}
            >
              {deleteLeague.isPending ? "Deleting…" : "Delete league"}
            </button>
          </div>
          {restartDraft.isError && <p className="form-error">{restartDraft.error.message}</p>}
          {deleteLeague.isError && <p className="form-error">{deleteLeague.error.message}</p>}
        </div>
      )}

      {pendingConfirm?.type === "kick" && (
        <ConfirmDialog
          title="Remove manager"
          message={`Remove ${pendingConfirm.teamName} from this league?`}
          confirmLabel="Remove"
          danger
          pending={kickMember.isPending}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => kickMember.mutate({ leagueId, memberId: pendingConfirm.memberId })}
        />
      )}
      {pendingConfirm?.type === "restart" && (
        <ConfirmDialog
          title="Restart the draft"
          message="This deletes all picks and roster assignments made so far. Managers stay in the league."
          confirmLabel="Restart draft"
          danger
          pending={restartDraft.isPending}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => restartDraft.mutate({ leagueId })}
        />
      )}
      {pendingConfirm?.type === "delete" && (
        <ConfirmDialog
          title="Delete league"
          message={`Permanently delete "${l.name}"? This deletes its draft, rosters, and standings, and can't be undone.`}
          confirmLabel="Delete league"
          danger
          pending={deleteLeague.isPending}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => deleteLeague.mutate({ leagueId })}
        />
      )}
    </div>
  );
}
