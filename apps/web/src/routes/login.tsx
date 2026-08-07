import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "../features/auth/LoginForm";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="page page-narrow">
      <h1>Log in</h1>
      <LoginForm />
    </div>
  );
}
