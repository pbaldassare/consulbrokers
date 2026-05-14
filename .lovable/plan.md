## Diagnosi

Le voci **CONT. GENERALE** e **FATTURAPA** che vedi nella sidebar **NON sono più presenti** in `src/components/AppSidebar.tsx` (verificato — la sidebar attuale ha: Home, Assistente IA, Area CFO, Trattative, Bandi Pubblici, Chat, Portafoglio, Archivio Documentale, Anagrafiche Utenti, Sinistri, Contabilità, Sistema, Provvigioni, Notifiche).

Quello che vedi nello screenshot è una **build precedente cache-ata nel browser** (badge "Previewing last saved version"). Tuttavia in repo restano **artefatti legacy** che continuano a evocarle. Pulizia necessaria:

### Artefatti legacy da rimuovere

1. **`src/pages/contGenerale/`** — 7 pagine orfane (mai importate dalle route): `ClientiContabPage.tsx`, `DichiarativiCUPage.tsx`, `ElabAnnualiPage.tsx`, `ElabPeriodichePage.tsx`, `PianoDeiContiPage.tsx`, `PrimanotaGeneralePage.tsx`, `ScadenziarioPage.tsx`.
2. **`src/routes/sistema.tsx` linee 49-52, 53-54, 56-57** — redirect orfani per percorsi rimossi (`/cont-generale`, `/fatturapa`, `/prodotti`, `/categorie`, `/banca-import`, `/fornitori`). Tengo solo i redirect che proteggono link esterni recenti; tutto il resto va via.
3. **`src/pages/SitemapPage.tsx` linee 247-261** — sezione "Contabilità Generale" elenca 9 pagine inesistenti (Piano dei Conti, Primanota Generale, Scadenziario, Clienti Contabilità, Elaborazioni Periodiche/Annuali, Dichiarativi CU, Fornitori, Import Bancario). Da eliminare.

### Azione lato browser

Dopo il deploy, l'utente deve fare **hard refresh** (Cmd/Ctrl+Shift+R) per scaricare la nuova build. Esiste già un `service-worker.js` "kill-switch" che si auto-disinstalla, quindi al primo refresh la cache viene svuotata automaticamente.

---

## Modifiche

### A. Cancellare cartella legacy
- `rm -rf src/pages/contGenerale/` (7 file)

### B. `src/routes/sistema.tsx`
Rimuovere i redirect orfani (linee 49-57):
```diff
- <Route path="/cont-generale" element={<Navigate to="/contabilita" replace />} />
- <Route path="/cont-generale/*" element={<Navigate to="/contabilita" replace />} />
- <Route path="/fatturapa" element={<Navigate to="/contabilita" replace />} />
- <Route path="/fatturapa/*" element={<Navigate to="/contabilita" replace />} />
- <Route path="/prodotti" element={<Navigate to="/compagnie" replace />} />
- <Route path="/categorie" element={<Navigate to="/compagnie" replace />} />
- <Route path="/banca-import" element={<Navigate to="/contabilita" replace />} />
- <Route path="/fornitori" element={<Navigate to="/contabilita" replace />} />
```
Mantengo `/portafoglio/gestione-polizze` → `/portafoglio/attive` (rinominato di recente, link interni potrebbero esistere).

### C. `src/pages/SitemapPage.tsx`
Rimuovere blocco "Contabilità Generale" (linee 247-261).

### D. Verifica audit
Eseguire grep finale per assicurarsi che nessun import o link punti più a:
- `contGenerale/`
- `/cont-generale`
- `/fatturapa`
- `Piano dei Conti`, `Dichiarativi CU`, `Scadenziario`

### E. Memory
Aggiungere `mem://navigation/legacy-pages-removed` come constraint:
> Le pagine "Contabilità Generale", "FatturaPA", "Fornitori", "Banca Import", "Prodotti/Categorie standalone" sono state rimosse dalla piattaforma. Non re-introdurle. La contabilità generale è confluita nella sezione "Contabilità" unificata.

---

## File toccati
- `src/pages/contGenerale/*` (DELETE)
- `src/routes/sistema.tsx` (cleanup redirects)
- `src/pages/SitemapPage.tsx` (rimozione sezione)
- `mem://navigation/legacy-pages-removed` (NEW)
- `mem://index.md` (aggiunta riferimento)

## Esempio concreto
Dopo le modifiche e hard-refresh:
- Sidebar: nessuna voce "CONT. GENERALE" / "FATTURAPA" (già il caso ora ma confermato dal cleanup).
- Sitemap (`/sitemap`): l'area "Contabilità Generale" sparisce; restano solo "Contabilità" (operativa) e "Estrazioni & Stampe".
- Visitando `/cont-generale` o `/fatturapa` → 404 (pulito), invece del redirect fantasma.
