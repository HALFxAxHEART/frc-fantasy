import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTRPC } from "../../lib/trpc";

export function LoginForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.auth.me.queryKey() });
        await navigate({ to: "/leagues" });
      },
    }),
  );

  return (
    <form
      className="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        login.mutate({ email, password });
      }}
    >
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {login.isError && <p className="form-error">{login.error.message}</p>}
      <button type="submit" disabled={login.isPending}>
        {login.isPending ? "Signing in…" : "Log in"}
      </button>
    </form>
  );
}
