import { createFileRoute } from "@tanstack/react-router";
import { SignupForm } from "../features/auth/SignupForm";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  return (
    <div className="page page-narrow">
      <h1>Create your account</h1>
      <SignupForm />
    </div>
  );
}
