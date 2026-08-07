import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@frc-fantasy/server";
import { TRPCProvider } from "./lib/trpc";
import { routeTree } from "./routeTree.gen";
import "./styles/index.css";

const queryClient = new QueryClient();

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      fetch: (url, options) => fetch(url, { ...options, credentials: "include" }),
    }),
  ],
});

const router = createRouter({ routeTree, context: { queryClient } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <RouterProvider router={router} />
      </TRPCProvider>
    </QueryClientProvider>
  </StrictMode>,
);
