## Problema

Nella pagina Dettaglio Cliente (`/archivi/clienti/:id`), la sezione "Dati Anagrafici" in modalità Modifica permette di editare CF, P.IVA, indirizzi, email, ecc. ma **non** espone i campi **Nome**, **Cognome** (per privati) e **Ragione Sociale** (per aziende/enti). Questi sono già nel DB (`clienti.nome`, `clienti.cognome`, `clienti.ragione_sociale`) e già nella validazione `requiredFieldsList`, ma non hanno un input nel form: per questo l'utente non riesce a correggerli.

## Modifiche

File: `src/pages/ClienteDetail.tsx`, dentro la card "Dati Anagrafici" (intorno a riga 2161-2215).

1. **Cliente Privato** — aggiungere all'inizio del blocco `isPrivato`:
   - `<FieldInput label="Nome" field="nome" required />`
   - `<FieldInput label="Cognome" field="cognome" required />`

2. **Cliente Azienda / Ente** — aggiungere all'inizio del blocco else:
   - `<FieldInput label="Ragione Sociale" field="ragione_sociale" required />`

3. Aggiungere `ragione_sociale` a `requiredFieldsList` per il ramo non-privato (riga ~1721-1734), così la validazione è coerente con il fatto che è obbligatoria.

4. Nessuna modifica DB, nessuna modifica all'header (il `displayName` già usa questi campi e si aggiornerà automaticamente dopo il salvataggio).

Mantengo lo stesso pattern `FieldInput` + `readOnly`/`updateField` usato dagli altri campi, quindi rispetta lo stato `editMode` (in sola lettura quando non si è in Modifica).