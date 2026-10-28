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
