import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@frc-fantasy/server";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();
