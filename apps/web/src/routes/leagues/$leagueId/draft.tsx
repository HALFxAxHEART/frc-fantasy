import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "../../../components/ComingSoon";

export const Route = createFileRoute("/leagues/$leagueId/draft")({
  component: DraftPage,
});

function DraftPage() {
  return (
    <div className="page">
      <ComingSoon
        title="Draft Room"
        description="The live snake draft, Kanban-style board, and pick trading land here."
      />
    </div>
  );
}
