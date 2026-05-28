import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { APP_RELEASE_VERSION } from "./src/lib/appRelease";

// Timestamp condiviso fra VITE_APP_VERSION (embedded nel bundle) e
// public/version.json (servito statico). Permette al client di confrontare
// la propria versione con quella sul server.
const APP_VERSION = `${APP_RELEASE_VERSION}__${new Date().toISOString()}`;

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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    writeVersionJson(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
