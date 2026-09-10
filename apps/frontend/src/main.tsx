import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/ibm-plex-sans/wght.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import { applyStoredTheme } from "./theme";
import { App } from "./app/App";
import "./styles/global.css";

applyStoredTheme();

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el contenedor raíz de BIELA.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
