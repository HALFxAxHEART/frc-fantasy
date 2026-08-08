import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "../../components/BackLink";
import { PracticeDraftWizard } from "../../features/practice/PracticeDraftWizard";

export const Route = createFileRoute("/practice/new")({
  component: NewPracticeDraftPage,
});

function NewPracticeDraftPage() {
  return (
    <div className="page page-narrow">
      <BackLink to="/leagues" label="Back to my leagues" />
      <h1>Practice draft</h1>
      <p className="muted">
        Draft solo against EPA-ranked bot managers to scout an event or district before the real thing.
      </p>
      <PracticeDraftWizard />
    </div>
  );
}
