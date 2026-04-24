

## Risoluzione cache stale al login (vedi sempre versione vecchia)

### Diagnosi del problema

Il problema è causato da **3 difetti combinati** nel sistema di versioning attuale (`main.tsx` + `vite.config.ts` + `index.html`):

#### 1. ⚠️ Bug logico in `main.tsx` (causa principale)

Alla riga 11 il codice **scrive subito la nuova versione** in `localStorage`, **prima** del controllo anti-loop:

```ts
if (prevVersion && prevVersion !== APP_VERSION && APP_VERSION !== "dev") {
  localStorage.setItem("app_version", APP_VERSION);   // ← scrive SUBITO
  if (!sessionStorage.getItem(`refreshed_${APP_VERSION}`)) {
    sessionStorage.setItem(`refreshed_${APP_VERSION}`, "1");
    location.reload();   // dopo il reload, prevVersion === APP_VERSION → mai più reload
  }
}
```

Conseguenza: quando il browser carica HTML/JS **vecchi cachati** (dove `APP_VERSION` è il timestamp vecchio), il controllo passa, scrive la versione vecchia in localStorage, **non rileva mai più aggiornamenti** finché la sessione non viene chiusa. L'utente continua a vedere la vecchia UI anche dopo deploy nuovi.

#### 2. ⚠️ `VITE_APP_VERSION` calcolato a build-time è **dentro al bundle JS cachato**

In `vite.config.ts`:
```ts
'import.meta.env.VITE_APP_VERSION': JSON.stringify(new Date().toISOString())
```

Questa stringa finisce dentro `index-[hash].js`. Se il browser serve il **vecchio** `index.html` dalla cache, carica anche il **vecchio** `index-[hash].js` con il **vecchio** `APP_VERSION` → l'app non sa di essere obsoleta. È un check inutile: confronta il timestamp del bundle con sé stesso.

#### 3. ⚠️ `index.html` non è realmente "no-cache" sui CDN

I meta `Cache-Control` in HTML **vengono ignorati** da molti CDN/proxy (incluso Lovable hosting). Il `index.html` può restare cachato per ore, e con esso i riferimenti agli script vecchi.

#### 4. ⚠️ Service worker fantasma residuo

Il cleanup SW in `main.tsx` viene eseguito **dopo** il primo render: se in passato un SW ha cachato l'app shell, il primo caricamento al login mostra ancora i contenuti vecchi prima dell'unregister.

### Soluzione proposta

#### A. Riscrivere `main.tsx` con logica corretta

Sequenza corretta:
1. **Prima** registrare il listener visibility/focus.
2. Al boot: leggere `prevVersion`, se diverso → **NON aggiornare** localStorage, fare reload "hard" (`location.reload()` con cache busting in querystring), poi al secondo giro la nuova `APP_VERSION` viene scritta.
3. Aggiornare `localStorage` **solo** dopo che il render React è andato a buon fine (fine `createRoot().render`).
4. Anti-loop basato su confronto: scrivere `app_version` solo all'esito positivo, non prima del reload.

#### B. Polling server per nuova versione (vero fix)

Al posto di confrontare `APP_VERSION` con sé stesso, fare **fetch periodico di `/version.json`** (file generato a build-time in `public/`) e confrontarlo con `APP_VERSION` del bundle in memoria. Quando differiscono → toast "Nuova versione disponibile" + reload con cache busting (`location.replace(location.pathname + '?v=' + Date.now())`).

Implementazione:
- Generare `public/version.json` a build-time tramite **plugin Vite custom** dentro `vite.config.ts` (hook `closeBundle` o `transformIndexHtml`) che scrive `{ "version": "<timestamp>" }`. Stesso timestamp viene iniettato in `VITE_APP_VERSION`.
- In `main.tsx`: `setInterval(checkVersion, 60_000)` + check su `visibilitychange` + check al login (in `LoginPage` dopo signIn success).
- Fetch con `cache: 'no-store'` per bypassare la cache HTTP.

#### C. Hard reload con cache busting

Sostituire `location.reload()` con:
```ts
const url = new URL(location.href);
url.searchParams.set('_v', Date.now().toString());
location.replace(url.toString());
```
Così il browser scarica davvero `index.html` nuovo bypassando cache HTTP/SW.

#### D. Cleanup SW **sincrono prima del render**

Spostare il cleanup service worker in cima al file e attendere `await` prima di `createRoot().render`. In più, se vengono trovati SW registrati → fare un reload una tantum dopo unregister (flag in sessionStorage anti-loop).

#### E. Headers Cache-Control corretti su `index.html` (lato hosting)

I meta tag in HTML **non bastano**. Dato che Lovable serve l'app come SPA statica, `index.html` deve avere header HTTP `Cache-Control: no-cache, must-revalidate` lato CDN. Aggiungo un commento/nota in `index.html` e mi affido alla configurazione di hosting Lovable (che già dovrebbe gestirlo per `index.html` ma non per i bundle hashati). Se necessario, aggiungo anche un **redirect 302 query-busted** sul service worker fantasma.

### File da modificare

1. **`vite.config.ts`** — aggiungere plugin custom `writeVersionJson` che genera `public/version.json` con lo stesso timestamp di `VITE_APP_VERSION`. (Oppure scriverlo a `dist/version.json` nel hook `closeBundle`.)
2. **`src/main.tsx`** — riscrittura completa:
   - Cleanup SW **prima** del render (con flag anti-loop).
   - Polling `/version.json` ogni 60s + on visibility + on focus.
   - Hard reload con cache busting query.
   - Scrittura `app_version` **solo** dopo render OK.
3. **`src/lib/versionCheck.ts`** (nuovo) — funzione `checkAppVersion()` riutilizzabile da chiamare anche dopo login (`LoginPage.tsx`) per intercettare la versione vecchia subito dopo signIn.
4. **`src/pages/LoginPage.tsx`** — dopo signIn riuscito, prima di `navigate(...)`, chiamare `await checkAppVersion()` così se l'utente ha bundle stale viene fatto reload immediato e ricomincia da app aggiornata.
5. **`index.html`** — confermare meta no-cache (già presenti) e aggiungere `<link rel="manifest" href="/manifest.json?v=2">` (cache busting manifest).

### Cosa NON tocco

- La logica di autenticazione/Supabase, le rotte, gli `AuthGuard`/`RoleGuard`.
- Il sistema di `APP_VERSION` come timestamp build (continuo a usarlo, ma confrontato con `version.json` lato server, non con sé stesso).
- I dati (nessuna migrazione DB).

### Verifica

1. **Deploy nuovo** → utente già loggato in tab aperta: entro 60s appare il reload automatico (o al cambio tab).
2. **Login con cache vecchia**: dopo "Accedi" parte il check, se obsoleto → reload con `?_v=...`, al secondo caricamento entra nella dashboard con UI nuova.
3. **Console**: log `[VersionCheck] current=<ts1> server=<ts2> → reload` quando rileva discrepanza; nessun loop di reload (test: due reload max per nuova versione).
4. **Service worker**: in DevTools → Application → Service Workers: vuoto. Cache Storage: vuoto.

