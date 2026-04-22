

## Sede obbligatoria + riorganizzazione visiva campi obbligatori

### Cosa cambia

1. **"Sede" diventa obbligatoria** per tutti i clienti (privati, aziende, enti). Campo DB: `ufficio_id` (label UI "Sede", come da convenzione terminologica del progetto).

2. **Riorganizzazione visiva**: i 3 campi gestionali obbligatori comuni a tutti i clienti (Sede, Specialist, Gruppo Finanziario) vengono raggruppati in una **nuova sezione "Assegnazioni Gestionali"** in cima alla scheda Anagrafica, prima dei dati anagrafici personali. Sono i 3 campi che il backoffice deve sempre completare per ogni cliente: avere una propria card dedicata in alto rende immediato vedere se il cliente è "completo gestionalmente".

### Layout proposto (tab Anagrafica)

```text
┌─ Assegnazioni Gestionali ──────────────────────┐
│  Sede *          Specialist *    Gruppo Fin. * │  ← nuova card, 3 colonne
└────────────────────────────────────────────────┘
┌─ Dati Anagrafici ──────────────────────────────┐
│  CF * | Cognome | Nome | Data nascita * | ...  │  ← esistente
└────────────────────────────────────────────────┘
┌─ Indirizzi ────────────────────────────────────┐  ← esistente
└────────────────────────────────────────────────┘
┌─ Contatti / Privacy / Dati Statistici ─────────┐  ← esistenti
└────────────────────────────────────────────────┘
```

Il Gruppo Finanziario viene **spostato** dalla sezione "Dati Statistici" alla nuova card in alto (resta lo stesso campo DB `gruppo_finanziario_id`, cambia solo dove si vede). Specialist viene **spostato** dalla sezione anagrafica generica alla stessa card.

### Modifiche al codice

**File unico: `src/pages/ClienteDetail.tsx`**

1. **Helper `getMissingRequiredFields`**: aggiungo `ufficio_id` ai campi obbligatori (per tutti i tipi cliente).
2. **Helper `isFieldRequired`**: aggiungo `ufficio_id`.
3. **Rendering**: creo un nuovo blocco `<Card>` "Assegnazioni Gestionali" sopra la card anagrafica esistente, contenente i 3 `SearchableSelect` per Sede / Specialist / Gruppo Finanziario, ognuno con prop `required` (asterisco rosso, bordo rosso quando vuoto, hint "Campo obbligatorio").
4. **Rimuovo** i campi Specialist e Gruppo Finanziario dalle posizioni attuali (spostati, non duplicati).
5. **Counter "Compila i campi obbligatori (N)"** già esistente: si aggiorna automaticamente includendo Sede.

### Cosa NON tocco

- Schema DB (nessun NOT NULL aggiunto).
- Logica RLS, Edge Functions, altri tab/pagine.
- Lookup uffici (già caricato come `uffici` nel componente), lookup specialist, lookup gruppi finanziari.
- Auto-fill da CF, hint coerenza, combobox comuni, blocco Salva — invariati nel comportamento.

### Verifica

1. Apri un cliente esistente senza Sede → in edit mode vedo la nuova card "Assegnazioni Gestionali" in alto, asterisco rosso su Sede, bordo rosso, "Compila i campi obbligatori (N)" incrementato di 1.
2. Seleziono una Sede → bordo sparisce, contatore decresce.
3. La sezione "Dati Statistici" non mostra più Gruppo Finanziario (spostato sopra). La sezione anagrafica non mostra più Specialist (spostato sopra).
4. Cliente già completo → Salva subito abilitato.

