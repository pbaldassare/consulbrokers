import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["placeholder.svg", "robots.txt"],
      manifest: {
        name: "ConsulNet — Area Clienti",
        short_name: "ConsulNet",
        description: "Portale clienti ConsulNet",
        theme_color: "#1a4a5c",
        background_color: "#fafafa",
        display: "standalone",
        start_url: "/cliente",
        icons: [
          { src: "/placeholder.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "/placeholder.svg", sizes: "512x512", type: "image/svg+xml" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
