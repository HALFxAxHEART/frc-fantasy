import { createFileRoute } from "@tanstack/react-router";
import { AdminPanel } from "../../features/admin/AdminPanel";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="page">
      <h1>Admin</h1>
      <AdminPanel />
    </div>
  );
}
