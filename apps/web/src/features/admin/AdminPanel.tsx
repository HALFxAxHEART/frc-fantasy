import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTRPC } from "../../lib/trpc";
import { ConfirmDialog } from "../../components/ConfirmDialog";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function AdminPanel() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const leagues = useQuery(trpc.admin.listLeagues.queryOptions());
  const syncRuns = useQuery({
    ...trpc.admin.getRecentSyncRuns.queryOptions(),
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === "running") ? 3_000 : false),
  });

  const deleteLeague = useMutation(
    trpc.admin.deleteLeague.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.admin.listLeagues.queryKey() });
        setDeleteTarget(null);
      },
    }),
  );

  const triggerSync = useMutation(
    trpc.admin.triggerSync.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.admin.getRecentSyncRuns.queryKey() }),
    }),
  );

  return (
    <div className="settings-page">
      <div className="card">
        <div className="page-header">
          <h2>Data sync</h2>
          <button type="button" onClick={() => triggerSync.mutate()} disabled={triggerSync.isPending}>
            {triggerSync.isPending ? "Starting…" : "Force sync now"}
          </button>
        </div>
        <p className="muted">
          Pulls fresh teams/districts/events from TBA and Statbotics. Runs in the background — this list
          refreshes on its own while a sync is running.
        </p>
        {triggerSync.isError && <p className="form-error">{triggerSync.error.message}</p>}
        {syncRuns.isLoading && <p className="muted">Loading sync history…</p>}
        {syncRuns.data && syncRuns.data.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {syncRuns.data.map((run) => (
                <tr key={run.id}>
                  <td>{run.jobName}</td>
                  <td>
                    <span className={`badge${run.status === "failed" ? " badge-danger" : ""}`}>{run.status}</span>
                  </td>
                  <td>{formatDate(run.startedAt)}</td>
                  <td>{formatDate(run.finishedAt)}</td>
                  <td className="muted">
                    {run.status === "failed" ? run.errorMessage : run.summary ? JSON.stringify(run.summary) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>All leagues</h2>
        {leagues.isLoading && <p className="muted">Loading leagues…</p>}
        {leagues.isError && <p className="form-error">{leagues.error.message}</p>}
        {leagues.data && leagues.data.length === 0 && <p className="muted">No leagues exist yet.</p>}
        {leagues.data && leagues.data.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Commissioner</th>
                <th>Status</th>
                <th>Members</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leagues.data.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.name}
                    {l.isPractice && <span className="badge"> Practice</span>}
                  </td>
                  <td className="muted">
                    {l.commissionerName} ({l.commissionerEmail})
                  </td>
                  <td>{l.status}</td>
                  <td>{l.memberCount}</td>
                  <td className="muted">{formatDate(l.createdAt)}</td>
                  <td>
                    <div className="admin-league-actions">
                      <Link to="/leagues/$leagueId/settings" params={{ leagueId: l.id }} className="button-link">
                        Manage
                      </Link>
                      <button type="button" className="danger-button" onClick={() => setDeleteTarget({ id: l.id, name: l.name })}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete league"
          message={`Permanently delete "${deleteTarget.name}"? This deletes its draft, rosters, and standings, and can't be undone.`}
          confirmLabel="Delete league"
          danger
          pending={deleteLeague.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteLeague.mutate({ leagueId: deleteTarget.id })}
        />
      )}
    </div>
  );
}
