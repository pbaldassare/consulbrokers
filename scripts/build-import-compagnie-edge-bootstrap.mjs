/**
 * Genera bootstrap gzip per deploy MCP di import-compagnie (limite dimensione payload).
 * Uso: node scripts/build-import-compagnie-edge-bootstrap.mjs
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcTs = path.join(root, "supabase/functions/import-compagnie/index.ts");
const outDir = path.join(root, "scripts/output");
const bundlePath = path.join(outDir, "import-compagnie-bundle.mjs");
const outBootstrap = path.join(outDir, "import-compagnie-edge-bootstrap.ts");

execSync(
  `npx esbuild "${srcTs}" --bundle --platform=neutral --format=esm --outfile="${bundlePath}"`,
  { stdio: "inherit", cwd: root },
);

const bundle = fs.readFileSync(bundlePath, "utf8");
const b64 = zlib.gzipSync(bundle).toString("base64");
const bootstrap = `const B64 = ${JSON.stringify(b64)};
const bytes = Uint8Array.from(atob(B64), (c) => c.charCodeAt(0));
const ds = new DecompressionStream("gzip");
const code = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
await import("data:application/javascript," + encodeURIComponent(code));
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outBootstrap, bootstrap, "utf8");
console.log(`Bootstrap ${bootstrap.length} bytes → ${outBootstrap}`);
