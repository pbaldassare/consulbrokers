## Problema

In `ImmissionePolizzaPage` (preventivazione/immissione polizza) se l'utente esce dalla pagina o ricarica il browser perde tutto il lavoro: nessun salvataggio finché non si conferma il titolo.

## Soluzione: bozza locale autosalvata (localStorage)

Aggiungere un autosave su `localStorage` per la bozza corrente della polizza, scoped per cliente (così cambiando cliente non si mischiano i dati).

### Comportamento

- **Chiave**: `immissione-draft:v1:<clienteId|new>` (per cliente per evitare collisioni).
- **Autosave**: debounce 500–800 ms su ogni cambio di stato rilevante della form (anagrafica polizza, date, frazionamento, premi/garanzie, ripartizioni, RCA, ecc.).
- **Restore**: al mount, se esiste una bozza per il `clienteId` corrente, ripristina i campi e mostra un banner discreto in cima alla pagina:  
  `Bozza ripristinata del DD/MM HH:mm` con due azioni → **Continua** (default) / **Scarta bozza**.
- **Cleanup**: la bozza viene cancellata automaticamente dopo:
  - salvataggio definitivo del titolo (success),
  - click su "Scarta bozza",
  - click su un pulsante "Nuova polizza" / reset.
- **Scope dei dati**: solo stato form serializzabile. Esclusi: file/allegati binari, risultati di query/lookup, flag UI transitori (`saving`, `aiImportOpen`, `*Touched`).
- **Versioning**: prefisso `v1:` nella chiave per poter invalidare bozze vecchie se cambia lo schema.
- **TTL soft**: bozze più vecchie di 7 giorni vengono ignorate al restore e ripulite.

### Implementazione

1. Nuovo hook `src/hooks/useDraftPersistence.ts`:
   - `useDraftPersistence(key, state, { debounceMs, enabled })` → salva su localStorage debounced.
   - `loadDraft(key)` e `clearDraft(key)` esposti come helper.
2. In `src/pages/ImmissionePolizzaPage.tsx`:
   - Costruire `draftKey` da `selectedClienteId || preselectedClienteId || "new"`.
   - Raccogliere lo stato form in un oggetto memoizzato `draftSnapshot`.
   - `useDraftPersistence(draftKey, draftSnapshot)`.
   - All'init (after lookups loaded), tentare `loadDraft(draftKey)`: se presente e <7gg, idratare gli `useState` e mostrare il banner.
   - Su submit success → `clearDraft(draftKey)`.
3. Banner riusabile inline (no nuovo componente esterno) sopra la prima card: piccola toolbar con `Bozza ripristinata · <tempo>` + bottoni `Continua` / `Scarta`.
4. Bump `public/version.json`.

### Fuori scope

- Salvataggio server-side delle bozze (richiederebbe tabella `titoli_bozze` con RLS) — opzionale in un secondo step se serve cross-device.
- Persistenza di altre pagine (Rinnovi, Appendici, ecc.) — applichiamo prima qui, poi eventualmente estendiamo.
