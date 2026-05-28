import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { APP_RELEASE_VERSION } from "./src/lib/appRelease";

// Versione STABILE condivisa fra VITE_APP_VERSION (embedded nel bundle) e
// public/version.json (servito statico). Deve restare identica fra build
// successive con lo stesso APP_RELEASE_VERSION, altrimenti il client va in
// loop di reload per mismatch versione.
const APP_VERSION = APP_RELEASE_VERSION;

/**
 * Plugin che scrive `version.json` sia in `public/` (per dev server)
 * sia in `dist/` (per produzione) con lo stesso timestamp del bundle.
 */
function writeVersionJson(): Plugin {
  const payload = JSON.stringify({ version: APP_VERSION }, null, 2);
  return {
    name: "write-version-json",
    apply: () => true,
    buildStart() {
      try {
        const publicDir = path.resolve(__dirname, "public");
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(path.join(publicDir, "version.json"), payload);
      } catch (err) {
        console.warn("[writeVersionJson] cannot write public/version.json:", err);
      }
    },
    closeBundle() {
      try {
        const distDir = path.resolve(__dirname, "dist");
        if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
        fs.writeFileSync(path.join(distDir, "version.json"), payload);
      } catch (err) {
        console.warn("[writeVersionJson] cannot write dist/version.json:", err);
      }
    },
  };
}

function forcePreviewFullReload(): Plugin {
  return {
    name: "force-preview-full-reload",
    apply: "serve",
    handleHotUpdate(ctx) {
      if (ctx.file.includes("node_modules") || ctx.file.includes(".git")) return;
      ctx.server.ws.send({ type: "full-reload", path: "*" });
      return [];
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
  },
  server: {
    host: "::",
    port: 8080,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    writeVersionJson(),
    forcePreviewFullReload(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
