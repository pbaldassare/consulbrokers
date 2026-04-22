

## Riduzione card "Assegnazioni Gestionali" + fix Sede non valorizzata

### Cosa cambia

1. **Semplificare la card in alto**: rimuovo Specialist e Gruppo Finanziario dalla card "Assegnazioni Gestionali". Restano gestiti nella sezione "Codici Commerciali (Rete)" / "Dati Statistici" in fondo, come prima. La card in alto contiene **solo Sede** (= Ufficio), in evidenza, su una colonna piena.

2. **Fix Sede vuota** (es. ADINOLFI VINCENZO che è di Napoli ma il select mostra "— Seleziona sede —"): il valore `ufficio_id` esiste sul cliente ma il `SearchableSelect` non lo trova. Cause possibili da verificare e correggere:
   - La query `uffici` filtra per `attivo = true` e l'ufficio assegnato non è attivo → il valore non compare tra le option e il select si svuota visivamente.
   - Mismatch di tipo (string vs uuid) tra `value` passato e `option.value`.
   
   Fix: rimuovo il filtro `attivo` dalla query (oppure lo allargo a "attivo OR id = valore corrente"), e mi assicuro che il `value` passato al select sia sempre `String(ufficio_id ?? "")`. Verifico anche che la query restituisca tutti gli uffici esistenti (Napoli incluso).

3. **Validazione**: Sede resta obbligatoria. Gruppo Finanziario e Specialist **restano obbligatori** ai fini del Salva (regole già approvate), ma la loro UI di compilazione torna nelle sezioni originali in fondo. Il counter "Compila i campi obbligatori (N)" continua a contarli; cliccando il counter (se presente lo scroll-to) o leggendo gli hint rossi nelle sezioni in fondo l'utente li trova.

### File toccato

- `src/pages/ClienteDetail.tsx`
  - Card "Assegnazioni Gestionali": rimuovo i 2 `SearchableSelect` Gruppo Finanziario e Specialist + relative mutation/note di sync. Resta solo Sede a larghezza piena.
  - Query `uffici`: rimuovo filtro `attivo` (o aggiungo fallback per id corrente).
  - Riporto `SearchableSelect` Gruppo Finanziario nella sezione "Dati Statistici" (com'era prima) con marker required.
  - Riporto Specialist come gestione esclusiva nella sezione "Codici Commerciali (Rete)" con marker required sulla riga backoffice.
  - Mantengo `requiredFieldsList` con i 3 campi (Sede + Gruppo + Specialist).

### Cosa NON tocco

- DB, RLS, Edge Functions.
- Logica auto-fill CF, hint coerenza, combobox comuni.
- Sezione "Codici Commerciali (Rete)": resta l'unico punto di gestione Specialist.

### Verifica

1. Apro ADINOLFI VINCENZO → la card in alto mostra **solo Sede** con "Ufficio di Napoli" preselezionato.
2. La card non contiene più Gruppo Finanziario né Specialist.
3. Gruppo Finanziario è visibile e modificabile in "Dati Statistici" con asterisco rosso se vuoto.
4. Specialist è visibile e modificabile in "Codici Commerciali (Rete)" con asterisco rosso se mancante.
5. Counter "Compila i campi obbligatori (N)" continua a includere tutti e 3.
6. Salvo senza Sede → bloccato. Salvo con tutti e 3 compilati → ok.

