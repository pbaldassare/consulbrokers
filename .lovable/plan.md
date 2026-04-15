

## Piano: Eliminare il caching PWA che mostra versioni vecchie delle pagine

### Problema
Il progetto ha `vite-plugin-pwa` configurato con Workbox che pre-cacha tutti i file JS/CSS/HTML e usa `runtimeCaching` per le API Supabase. Il Service Worker serve le versioni vecchie dalla cache anche dopo ogni deploy, causando il problema "vedo sempre la versione vecchia".

### Cosa fare

**1. Rimuovere `vite-plugin-pwa` dalla configurazione Vite**
Eliminare l'intero blocco `VitePWA({...})` da `vite.config.ts` e il relativo import. La PWA con service worker non è necessaria per il gestionale admin — serve solo per il portale cliente, e anche lì basta un semplice `manifest.json` senza service worker per l'installabilità.

**2. Aggiungere script di pulizia Service Worker in `main.tsx`**
Inserire all'avvio dell'app un blocco che de-registra tutti i service worker esistenti e svuota le cache Workbox. Questo garantisce che i browser degli utenti che hanno già il vecchio SW lo eliminino automaticamente al primo caricamento.

```typescript
// Cleanup any stale service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister());
  });
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name));
  });
}
```

**3. Spostare `vite-plugin-pwa` da dependencies a devDependencies (o rimuovere del tutto)**
La dipendenza è in `dependencies` invece che in `devDependencies`. Va rimossa dal `package.json` dato che non la usiamo più.

**4. Mantenere il manifest base per installabilità (opzionale)**
Se serve il "Aggiungi alla Home" per il portale cliente, possiamo lasciare un semplice `manifest.json` in `public/` senza service worker. Nessun caching, nessuna versione stale.

### File coinvolti
- **Modifica**: `vite.config.ts` — rimuovere VitePWA
- **Modifica**: `src/main.tsx` — aggiungere cleanup SW + cache
- **Modifica**: `package.json` — rimuovere `vite-plugin-pwa`
- **Creazione**: `public/manifest.json` — manifest minimale per installabilità (solo icone + display)

