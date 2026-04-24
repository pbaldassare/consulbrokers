

## Fix loop di reload del version check

### Problema osservato

Dai console log:
```
[VersionCheck] reload già eseguito per 2026-04-24T12:48:13.602Z — skip per evitare loop
```

Significa che ad **ogni** boot della pagina il sistema rileva una discrepanza tra `BUNDLE_VERSION` (embedded nel JS) e `serverVersion` (letto da `/version.json`), e quindi tenta sempre il reload — bloccato solo dal flag anti-loop in `sessionStorage`. Risultato: l'utente vede comunque il warning, e in alcuni casi (sessionStorage svuotato dal browser) può finire in un loop di reload.

### Causa

`BUNDLE_VERSION` viene preso da `import.meta.env.VITE_APP_VERSION`, che in `vite.config.ts` è impostato a:
```ts
'import.meta.env.VITE_APP_VERSION': JSON.stringify(new Date().toISOString())
```

Questo timestamp viene generato **ad ogni avvio del dev server / hot reload**, **NON** allo stesso istante in cui il custom plugin scrive `public/version.json`. In sviluppo (Lovable preview) i due timestamp **non coincidono mai esattamente**, perché:

1. `define` viene calcolato all'avvio di Vite → timestamp X
2. Il plugin `writeVersionJson` scrive `version.json` in un altro hook → timestamp Y ≠ X
3. Ad ogni HMR / restart del sandbox, X cambia ma il file su `public/version.json` resta quello vecchio (committato)

Quindi `BUNDLE_VERSION !== serverVersion` praticamente sempre → reload sempre triggerato → loop.

Inoltre il file `public/version.json` attualmente contiene `2026-04-24T12:48:13.602Z` (committato manualmente dall'AI), che non corrisponde al `define` di runtime.

### Soluzione

#### 1. Sincronizzare `VITE_APP_VERSION` e `version.json` con un **singolo timestamp** generato una volta sola

In `vite.config.ts`:
```ts
const BUILD_TIMESTAMP = new Date().toISOString();

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(BUILD_TIMESTAMP),
  },
  plugins: [
    {
      name: 'write-version-json',
      buildStart() {
        // dev mode: scrive in public/
        fs.writeFileSync('public/version.json', JSON.stringify({ version: BUILD_TIMESTAMP }));
      },
      closeBundle() {
        // build mode: scrive anche in dist/
        fs.writeFileSync('dist/version.json', JSON.stringify({ version: BUILD_TIMESTAMP }));
      },
    },
    // ...altri plugin
  ],
});
```

Così `BUNDLE_VERSION === serverVersion` per definizione finché il sandbox non viene riavviato. Quando viene riavviato (= nuovo deploy), entrambi cambiano insieme → reload solo quando serve davvero.

#### 2. Disabilitare completamente il version check in **dev mode**

In `vite.config.ts` Lovable usa lo stesso build sia per preview sia per produzione, ma possiamo distinguere via `mode`:

In `src/lib/versionCheck.ts` e `src/main.tsx`:
- Se `import.meta.env.DEV === true` → **skip totale** del version check (no fetch, no polling, no reload). In dev/preview HMR gestisce già il refresh.
- Solo in `import.meta.env.PROD === true` il check è attivo.

Questo elimina i warning fastidiosi nella preview Lovable e previene loop dovuti a timestamp non sincronizzati durante lo sviluppo.

#### 3. Pulizia del flag stale in `sessionStorage`

Il flag `reloaded_for_<version>` resta in sessionStorage anche se la versione server cambia — accumulando garbage. Aggiungere cleanup: al boot, rimuovere tutti i flag `reloaded_for_*` che non corrispondono alla versione server attuale.

### File da modificare

1. **`vite.config.ts`** — definire `BUILD_TIMESTAMP` come costante module-level e usarla sia in `define` sia nel plugin `write-version-json` (sia `buildStart` per dev sia `closeBundle` per build).
2. **`src/lib/versionCheck.ts`** — early-return se `import.meta.env.DEV`; aggiungere cleanup flag stale; usare `import.meta.env.PROD` come gate.
3. **`src/main.tsx`** — wrappare `checkAppVersion()` e `startVersionPolling()` in `if (import.meta.env.PROD)`.
4. **`public/version.json`** — sarà rigenerato automaticamente dal plugin al prossimo restart, nessuna modifica manuale.

### Cosa NON tocco

- La logica di hard reload (cache busting con `?_v=...`) resta corretta.
- Il cleanup Service Worker in `main.tsx` resta sincrono prima del render.
- L'integrazione in `LoginPage.tsx` resta — chiamerà `checkAppVersion()` che in dev sarà no-op, in prod farà il check vero.

### Verifica

1. **Preview Lovable** (dev): nessun warning `[VersionCheck]` in console; nessun reload spurio; navigazione fluida.
2. **Produzione** dopo nuovo deploy: utente in tab aperta riceve reload entro 60s o al cambio tab.
3. **Console PROD**: log `[VersionCheck] bundle=<X> server=<Y> → hard reload` UNA SOLA VOLTA per nuova versione, poi silenzio.
4. **sessionStorage**: solo il flag della versione corrente (vecchi puliti).

