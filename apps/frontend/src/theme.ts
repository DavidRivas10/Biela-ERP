const STORAGE_KEY = "biela.theme";

export type ThemeChoice = "light" | "dark";

function readStored(): ThemeChoice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/** The theme actually in effect: an explicit choice, else the OS preference. */
export function resolveTheme(): ThemeChoice {
  const stored = readStored();
  if (stored) return stored;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

/** Apply the stored choice (or nothing, letting `prefers-color-scheme` decide). */
export function applyStoredTheme(): void {
  const stored = readStored();
  const root = document.documentElement;
  if (stored) root.setAttribute("data-theme", stored);
  else root.removeAttribute("data-theme");
}

export function setTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* private mode / storage disabled — the toggle still works for this view */
  }
  document.documentElement.setAttribute("data-theme", choice);
}
