#!/usr/bin/env python3
"""Build JSON manifest for Supabase MCP deploy_edge_function (project cbnet)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUN = ROOT / "supabase/functions"
CONFIG = ROOT / "supabase/config.toml"
OUT = Path("/tmp/cbnet-edge-deploy/manifest.json")


def parse_verify_jwt() -> dict[str, bool]:
    out: dict[str, bool] = {}
    if not CONFIG.exists():
        return out
    current: str | None = None
    for line in CONFIG.read_text().splitlines():
        m = re.match(r"\[functions\.(.+)\]", line.strip())
        if m:
            current = m.group(1)
            continue
        if current and line.strip().startswith("verify_jwt"):
            out[current] = "true" in line.split("=", 1)[1].lower()
    return out


def jsr_to_npm(text: str) -> str:
    return text.replace(
        'from "jsr:@supabase/supabase-js@2"',
        'from "npm:@supabase/supabase-js@2.49.1"',
    )


def collect_files(fn_dir: Path) -> dict[str, str]:
    files: dict[str, str] = {}
    pending = [fn_dir / "index.ts"]
    seen: set[Path] = set()
    while pending:
        p = pending.pop()
        if p in seen or not p.exists():
            continue
        seen.add(p)
        rel = p.relative_to(FUN).as_posix()
        text = jsr_to_npm(p.read_text())
        files[rel] = text
        for m in re.finditer(r'from\s+["\']([^"\']+)["\']', text):
            imp = m.group(1)
            if imp.startswith("../_shared/"):
                pending.append(FUN / "_shared" / imp.removeprefix("../_shared/"))
            elif imp.startswith("./"):
                pending.append(fn_dir / imp[2:])
    return files


def main() -> None:
    verify = parse_verify_jwt()
    manifest = []
    for fn_dir in sorted(p for p in FUN.iterdir() if p.is_dir() and not p.name.startswith("_")):
        name = fn_dir.name
        file_map = collect_files(fn_dir)
        manifest.append(
            {
                "name": name,
                "entrypoint_path": f"{name}/index.ts",
                "verify_jwt": verify.get(name, False),
                "files": [{"name": k, "content": v} for k, v in sorted(file_map.items())],
            }
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, ensure_ascii=False))
    print(f"wrote {len(manifest)} functions -> {OUT}")


if __name__ == "__main__":
    main()
