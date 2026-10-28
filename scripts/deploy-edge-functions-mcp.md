# Deploy edge functions su cbnet (MCP)

Il PAT locale (`~/.supabase/access-token`) spesso **non** ha `edge_functions_write`. Usare **Supabase MCP** in Cursor (`deploy_edge_function`).

## Preparazione bundle

```bash
python3 scripts/build-edge-deploy-manifest.py
# scrive /tmp/cbnet-edge-deploy/manifest.json e (se generato) args-by-name/*.json
```

Ogni funzione va inviata con:

- `project_id`: `ehvmsdvjqvjulcrmzwzm`
- `entrypoint_path`: `<nome-funzione>/index.ts`
- `verify_jwt`: da `supabase/config.toml` (`[functions.<nome>]`)
- `files`: tutti i `.ts` della cartella + `_shared` importati

Gli import `jsr:@supabase/supabase-js@2` nel manifest sono già convertiti in `npm:@supabase/supabase-js@2.49.1` (il bundler remoto timeout su JSR).

## CLI (solo se il PAT ha edge_functions_write)

```bash
export SUPABASE_ACCESS_TOKEN=...
npx supabase functions deploy --project-ref ehvmsdvjqvjulcrmzwzm --use-api --yes
```

## Secret da impostare in dashboard

`RESEND_API_KEY`, chiavi AI (es. `MOONSHOT_API_KEY`), e altri usati dalle function. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` sono automatici.

## Deploy via agente (obbligatorio per bundle grandi)

1. **Mai** stub/PLACEHOLDER/TRUNCATED: ogni `deploy_edge_function` deve includere **tutti** i `files[].content` completi.
2. **Non** usare stdout shell per il payload (truncation ~20 KB): usare `Read` su `/tmp/mcp-args-<slug>.json` o rigenerare con `python3 scripts/build-edge-deploy-manifest.py` + args in `/tmp/cbnet-edge-deploy/args-by-name/`.
3. Solo **Supabase MCP OAuth** (`CallDynamicTool` → `deploy_edge_function`). CLI/PAT → `edge_functions_write` mancante.

### Coda cbnet (2026-10-28) — target 57 function

| Priorità | slug | stato remoto |
|----------|------|----------------|
| P0 | `chiedi-libreria-cga` | **v3 PLACEHOLDER** — redeploy da `/tmp/mcp-args-chiedi-libreria-cga.json` |
| P1 | 7 slug nuovi | assenti: `chiedi-mercato-assicurativo`, `notifica-messa-cassa-agenzia`, `parse-cga`, `parse-polizza-completa`, `gestione-sinistri`, `cerca-bandi`, `ai-assistant` |
| OK | `cb-bot-analizza-documenti` | v3 bundle pieno |
