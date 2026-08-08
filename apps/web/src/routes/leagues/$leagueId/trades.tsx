import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "../../../components/BackLink";
import { ComingSoon } from "../../../components/ComingSoon";

export const Route = createFileRoute("/leagues/$leagueId/trades")({
  component: TradesPage,
});

function TradesPage() {
  const { leagueId } = Route.useParams();
  return (
    <div className="page">
      <BackLink to="/leagues/$leagueId" params={{ leagueId }} label="Back to league" />
      <ComingSoon
        title="Trade Market"
        description="Propose and accept trades, browse the trade block, and manage roster limits here."
      />
    </div>
  );
}
