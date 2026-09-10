import { useCallback, useSyncExternalStore } from "react";
import { resolveTheme, setTheme, type ThemeChoice } from "../theme";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange();
  media.addEventListener("change", handler);
  window.addEventListener("biela:theme", handler);
  return () => {
    media.removeEventListener("change", handler);
    window.removeEventListener("biela:theme", handler);
  };
}

/** Light/dark switch. Follows the OS until the person makes a choice. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, resolveTheme, () => "light");
  const toggle = useCallback(() => {
    const next: ThemeChoice = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.dispatchEvent(new Event("biela:theme"));
  }, [theme]);

  return (
    <button
      type="button"
      className="theme-switch"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
      }
      title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
