import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import { App } from "./App";
import { applyAppearance, loadAppearance } from "./lib/theme";
import { maybeSeedDemo } from "./lib/demo";
import "./styles.css";

maybeSeedDemo(); // browser + ?demo only; must run before the stores read storage
applyAppearance(loadAppearance());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
