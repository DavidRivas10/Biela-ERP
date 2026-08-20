import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/api-client";
import { jsonResponse, testUser } from "../test/fixtures";
import { ACCESS_TOKEN_KEY } from "./token-storage";
import { AuthProvider, useAuth } from "./AuthContext";

afterEach(() => vi.unstubAllGlobals());

function Probe() {
  const auth = useAuth();
  const [loginFailed, setLoginFailed] = useState(false);
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="email">{auth.user?.email}</span>
      <span data-testid="login-failed">{String(loginFailed)}</span>
      <button
        onClick={() =>
          void auth
            .login("operator@example.com", "password")
            .catch(() => setLoginFailed(true))
        }
      >
        login
      </button>
      <button onClick={auth.logout}>logout</button>
      <button onClick={auth.retryRestore}>retry</button>
    </div>
  );
}

function renderAuth(queryClient = new QueryClient()) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

describe("AuthProvider", () => {
  it("logs in, stores only the token in sessionStorage, and exposes the user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          accessToken: "jwt-value",
          tokenType: "Bearer",
          expiresIn: "15m",
          user: testUser,
        }),
      ),
    );
    renderAuth();

    await userEvent.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe("jwt-value");
    expect(screen.getByTestId("email")).toHaveTextContent(testUser.email);
    expect(sessionStorage.length).toBe(1);
  });

  it("keeps invalid login distinct from authenticated-session handling", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Unauthorized" }, 401)),
    );
    renderAuth();

    await userEvent.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() =>
      expect(screen.getByTestId("login-failed")).toHaveTextContent("true"),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("anonymous");
    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it("restores a valid session with /api/auth/me", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "existing");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(testUser));
    vi.stubGlobal("fetch", fetchMock);
    renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/auth/me");
  });

  it("clears an invalid session after a 401", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "expired");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Unauthorized" }, 401)),
    );
    renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("anonymous"),
    );
    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it("keeps the token and offers retry when restoration is unavailable", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "still-possibly-valid");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Unavailable" }, 503)),
    );
    renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unavailable"),
    );
    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe(
      "still-possibly-valid",
    );
  });

  it("clears token, identity, and query cache on logout", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "existing");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(testUser)));
    const queryClient = new QueryClient();
    queryClient.setQueryData(["private"], { value: true });
    renderAuth(queryClient);
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    await userEvent.click(screen.getByRole("button", { name: "logout" }));
    expect(screen.getByTestId("status")).toHaveTextContent("anonymous");
    expect(queryClient.getQueryData(["private"])).toBeUndefined();
    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it("applies global 401 handling once authenticated", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "existing");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(testUser))
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    await act(async () => {
      await expect(apiRequest("/api/products")).rejects.toMatchObject({
        status: 401,
      });
    });
    expect(screen.getByTestId("status")).toHaveTextContent("anonymous");
  });
});
