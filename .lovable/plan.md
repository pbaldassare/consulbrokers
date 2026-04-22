

## Tendine globali per Specialist, Compagnia, Ramo e Produttore su tutte le polizze

### Situazione attuale

| Campo | DB | Immissione Polizza | Dettaglio Polizza (edit) |
|---|---|---|---|
| **Compagnia** | `compagnia_id` (uuid) | ✅ `SearchableSelect` da `compagnie` | ❌ Read-only 🔒 |
| **Ramo** | `ramo_id` (uuid) | ✅ `SearchableSelect` da `rami` | ❌ Read-only 🔒 |
| **Produttore** | `produttore_nome` (text, libero) + `produttore_id` (uuid, 0/1047 usato → legacy) | ⚠️ Tendina su `anagrafiche_professionali` ma salva in `produttore_id` **mai usato** | ⚠️ Tendina su `profiles.ruolo='produttore'` (vuoto), salva in `produttore_id` legacy |
| **Specialist** | `specialist` (text libero) | ❌ **Doppio campo confuso**: uno con `[danni/vita/auto/re]` hardcoded + uno "Specialist (Backoffice)" da `profiles.ruolo='backoffice'` | ✅ Tendina da `profiles.ruolo='backoffice'` |

Risultato: 426/1047 polizze senza produttore, lo Specialist in immissione genera valori incoerenti, in dettaglio Compagnia e Ramo non si possono modificare.

### Cosa faccio

**1. Tendina unificata "Specialist"** (sorgente unica = `profiles WHERE ruolo='backoffice' AND attivo=true`)
- `ImmissionePolizzaPage.tsx`: rimuovo il campo "Specialist" hardcoded `[danni/vita/auto/re]` (riga 666-671). Resta solo "Specialist (Backoffice)" che già esiste e salva in `titoli.specialist` come `"COGNOME NOME"` (text). Cambio il salvataggio per memorizzare il **nome leggibile** invece dell'uuid (così è coerente con i 3 valori storici già a DB: "GUARRACINO GAETANO", "SCARPELLI PAOLA", "Gestione Milano").
- `TitoloDetail.tsx`: già è `SearchableSelect` corretto, nessuna modifica.

**2. Tendina "Produttore" su tutte le polizze** (sorgente = `anagrafiche_professionali WHERE tipo IN ('account_executive','corrispondente','responsabile_sede') AND attivo=true` → ~560 voci)
- Salvo il **nome leggibile** in `titoli.produttore_nome` (text), non più in `produttore_id` (lo lascio NULL/legacy, come fatto per `prodotto_id`).
- `ImmissionePolizzaPage.tsx`: il campo "Produttore / A.E." (riga 585-597) viene rinominato "Produttore" e popolato dalle 3 categorie sopra; al submit salva `produttore_nome = "COGNOME NOME"` o `ragione_sociale` per le società.
- `TitoloDetail.tsx`: nel form Contratto sostituisco la query `produttoriOpts` (oggi punta a `profiles.ruolo='produttore'`, vuota) con la stessa fonte `anagrafiche_professionali`. Sostituisco il campo "Produttore" che bind su `produttore_id` con un bind su **`produttore_nome`** (text). Aggiorno anche il display read-only (riga 1507) per leggere `produttore_nome` con fallback a `produttore.nome cognome`.

**3. Compagnia e Ramo modificabili anche dal Dettaglio Polizza**
- `TitoloDetail.tsx`: nel pannello Contratto in modalità edit, sostituisco i due box read-only 🔒 "Compagnia" (riga 1517-1520) e "Ramo" (riga 1521-1524) con due `SearchableSelect` popolati da `compagnie` (attiva=true) e `rami` (attivo=true), bound su `contrattoForm.compagnia_id` e `contrattoForm.ramo_id`. Aggiungo i due campi allo state `contrattoForm`, alla funzione `startEditContratto`, alla mutation `saveContrattoMutation` (UPDATE su `titoli.compagnia_id` e `titoli.ramo_id`) e al log attività.
- Aggiungo le query `compagnieOpts` e `ramiOpts` con lo stesso pattern già usato per `produttoriOpts`/`specialistOpts`.

**4. Pulizia dati specialist (1 record sporco)**
- Migrazione SQL: l'unico record con valore uuid (`cf2372e6-…`, 7 polizze) viene risolto in `"COGNOME NOME"` leggendo dal profilo corrispondente, con UPDATE mirato. Se il profilo non esiste più, lo lascio invariato.

**5. Memory**
- Aggiorno `mem://insurance/policy-data-inheritance` con: Specialist e Produttore vivono come **testo leggibile** in `titoli.specialist` e `titoli.produttore_nome` (con tendina sorgente `profiles`/`anagrafiche_professionali`); `produttore_id` è legacy.

### Cosa NON tocco

- Il campo `produttore_id` resta a DB (legacy, mai più scritto/letto da UI — stesso pattern già applicato a `prodotto_id`).
- Nessun cambio a `compagnie`, `rami`, `profiles`, `anagrafiche_professionali`.
- Nessun trigger, nessun constraint nuovo.
- Nessun cambio a `RinnovoTitoloDialog.tsx`: già copia `compagnia_id`, `ramo_id`, `produttore_nome`, `specialist` dal padre.
- Nessun cambio alle Edge Function di import.

### Verifica

1. `/immissione-polizza`: vedo **un solo** campo "Specialist" (tendina backoffice) e **un solo** campo "Produttore" (tendina anagrafiche professionali). Salvando, in DB `titoli.specialist = "GUARRACINO GAETANO"` e `titoli.produttore_nome = "AMATO MARCELLINO"` (text leggibile).
2. `/titoli/{id}` → "Modifica Contratto": Compagnia e Ramo sono ora **tendine** modificabili (non più con 🔒). Cambio compagnia, salvo, riapro: il valore è cambiato.
3. Stesso form: tendina Produttore mostra le ~560 anagrafiche professionali; tendina Specialist mostra i backoffice da `profiles`.
4. Vista read-only Contratto: "Produttore" mostra il nome (es. "AMATO MARCELLINO") leggendo `produttore_nome` con fallback al join legacy.
5. AI Assistant: `SELECT specialist, COUNT(*) FROM titoli GROUP BY specialist` non contiene più valori uuid sporchi; `SELECT produttore_nome, COUNT(*) FROM titoli WHERE produttore_nome IS NOT NULL` cresce nel tempo man mano che le polizze vengono editate/create.
6. Rinnovo polizza: il nuovo titolo eredita correttamente compagnia, ramo, produttore_nome e specialist dal padre.

