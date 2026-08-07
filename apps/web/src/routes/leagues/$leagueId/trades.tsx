import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "../../../components/ComingSoon";

export const Route = createFileRoute("/leagues/$leagueId/trades")({
  component: TradesPage,
});

function TradesPage() {
  return (
    <div className="page">
      <ComingSoon
        title="Trade Market"
        description="Propose and accept trades, browse the trade block, and manage roster limits here."
      />
    </div>
  );
}
