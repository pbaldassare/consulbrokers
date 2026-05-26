# Cache PWA: bump versione per forzare reload

## Stato attuale (verificato)

- **DB** — `rami.ssn_attivo` e `rami.aliquota_ssn` esistono. Rami ZQ - R.C.A. già a `10.50%` con flag ON.
- **Codice** — `src/pages/TabelleBasePage.tsx` tab "Rami":
  - Colonna "% Tasse ARD" NON è renderizzata (header: Codice · Descrizione · Gruppo Ramo · % Tasse Ramo · **SSN** · Attivo · Azioni)
  - Dialog Modifica/Nuovo Ramo contiene già toggle "Contributo SSN" + input "% SSN"
- Nessuna stringa "ARD" presente nel file.

## Causa

Il progetto è una PWA con service worker (cache aggressiva via Workbox). Il tuo browser sta servendo la versione vecchia di `TabelleBasePage` dalla cache. `AppVersionGuard` reagisce a un cambio di `APP_VERSION`.

## Azioni

1. **Bump `APP_VERSION`** nel file che lo dichiara (cerco tra `src/components/AppVersionGuard.tsx` / `src/lib/appVersion.ts`) per innescare il toast "Nuova versione disponibile" e il reload con purge cache.
2. (No modifiche a DB, no modifiche a UI Rami — già a posto.)

## Verifica post-deploy

1. Aprire `/tabelle-base` → tab **Rami** (di default si apre su "Gruppi Ramo": cliccare "Rami").
2. Verificare colonna **SSN** visibile, righe ZQ-R.C.A. mostrano badge `10.50%`.
3. Aprire "Modifica" su un ramo → vedere toggle "Contributo SSN" + campo "% SSN".

## Se dopo il bump ancora non si vede

Significa che il SW non si è aggiornato: chiedo di fare **Ctrl/Cmd + Shift + R** (hard reload) o di disinstallare il service worker da DevTools → Application → Service Workers → Unregister.
