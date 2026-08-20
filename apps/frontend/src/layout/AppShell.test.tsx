import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { testUser } from "../test/fixtures";
import { AppShell } from "./AppShell";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: testUser, logout: vi.fn() }),
}));

describe("AppShell", () => {
  it("toggles and dismisses the responsive navigation with Escape", async () => {
    render(
      <MemoryRouter initialEntries={["/app/dashboard"]}>
        <Routes>
          <Route path="/app" element={<AppShell />}>
            <Route path="dashboard" element={<p>Dashboard content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const menu = screen.getByRole("button", { name: "Abrir navegación" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
  });
});
