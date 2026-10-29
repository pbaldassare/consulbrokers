#!/usr/bin/env node
/** Copy /tmp/mcp-args-<name>.json or args-by-name into agent-tools for CallDynamicTool deploy_edge_function. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const name = process.argv[2];
if (!name) {
  console.error("usage: prepare-mcp-deploy-args.mjs <function-slug>");
  process.exit(1);
}
const candidates = [
  `/tmp/mcp-args-${name}.json`,
  join("/tmp/cbnet-edge-deploy/args-by-name", `${name}.json`),
];
const src = candidates.find((p) => {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
});
if (!src) {
  console.error("no args file for", name);
  process.exit(1);
}
const args = JSON.parse(readFileSync(src, "utf8"));
const idx = args.files?.find((f) => f.name?.includes("index.ts"));
if (!idx?.content || idx.content.includes("PLACEHOLDER")) {
  console.error("invalid or PLACEHOLDER payload:", name);
  process.exit(1);
}
const outDir = join(process.cwd(), ".cursor/agent-tools");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `calldynamictool-args-Supabase-deploy_edge_function-${name}.json`);
writeFileSync(out, JSON.stringify(args));
console.log(out, args.files.length, "files");
