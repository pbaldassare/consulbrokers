import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BUNDLE_VERSION } from "./lib/versionCheck";

console.info(`[CBnet] bundle version: ${BUNDLE_VERSION}`);

createRoot(document.getElementById("root")!).render(<App />);
