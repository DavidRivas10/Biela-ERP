import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { isApiUnavailable } from "../api/api-client";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AppRoutes } from "./AppRoutes";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Two counters, two terminals: a sale confirmed on one screen must not
      // leave stock looking available on another that's just sitting open.
      // Refetching on focus is the cheap, standard fix for that cross-tab
      // staleness — it only fires when someone actually looks back at the
      // screen, so it doesn't add background traffic.
      refetchOnWindowFocus: true,
      retry: (failureCount, error) =>
        failureCount < 2 && isApiUnavailable(error),
    },
  },
});

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
