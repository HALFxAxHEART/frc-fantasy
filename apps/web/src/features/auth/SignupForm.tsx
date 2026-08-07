import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTRPC } from "../../lib/trpc";

export function SignupForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const register = useMutation(
    trpc.auth.register.mutationOptions({
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
        register.mutate({ email, password, displayName });
      }}
    >
      <label>
        Display name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
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
          minLength={8}
          required
        />
      </label>
      {register.isError && <p className="form-error">{register.error.message}</p>}
      <button type="submit" disabled={register.isPending}>
        {register.isPending ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}
