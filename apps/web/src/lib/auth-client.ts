import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "./trpc";

/** null = signed out, undefined = still loading. */
export function useCurrentUser() {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.auth.me.queryOptions(),
    retry: false,
  });

  if (query.isLoading) return { user: undefined, isLoading: true };
  if (query.isError) return { user: null, isLoading: false };
  return { user: query.data?.user ?? null, isLoading: false };
}
