

## Piano: Ricerca Dati Reali nei Template Email

### Problema attuale
L'anteprima usa solo dati fake. L'utente vuole poter cercare e selezionare clienti e polizze reali dal database per popolare le variabili del template con dati veri.

### Interventi

**1. Ristrutturare l'anteprima con ricerca dati reali**

Nell'anteprima del template (e nel futuro invio), aggiungere:
- **Cerca Cliente**: campo di ricerca che interroga `clienti` + `profiles` (nome, cognome, ragione sociale, codice fiscale) con risultati in dropdown
- **Cerca Polizza**: campo di ricerca che interroga `titoli` con join su `prodotti`, `compagnie` — cerca per numero_titolo, nome prodotto, nome compagnia. Filtrato opzionalmente per cliente selezionato
- Quando si seleziona un cliente e/o una polizza, le variabili del template vengono sostituite con i dati reali dal DB
- Se nessun dato selezionato, mostra i dati di esempio come fallback

**2. Migliorare il dialog anteprima**

Il dialog anteprima diventa:
```text
┌─────────────────────────────────────┐
│ Anteprima: Sollecito pagamento      │
├─────────────────────────────────────┤
│ 🔍 Cerca Cliente: [___________]    │
│    → Mario Rossi - RSSMRA80A01H501 │
│    → Rossi S.r.l.                  │
│                                     │
│ 🔍 Cerca Polizza: [___________]    │
│    → POL-2026-001234 - Auto Allianz│
│                                     │
│ ─── Anteprima ───                  │
│ Oggetto: Sollecito polizza POL-... │
│ Corpo: Gentile Mario Rossi, ...    │
└─────────────────────────────────────┘
```

**3. Componenti di ricerca**

- Usare il pattern `SearchableSelect` (Popover + Command) gia presente nel progetto
- Query cliente: `clienti` join `profiles` con ricerca ILIKE su nome/cognome/ragione_sociale/codice_fiscale
- Query polizza: `titoli` join `prodotti` + `compagnie` + `uffici` con ricerca ILIKE su numero_titolo

**4. Nessuna modifica al DB**

Tutto lato frontend: le query di ricerca usano le tabelle esistenti (`clienti`, `profiles`, `titoli`, `prodotti`, `compagnie`, `uffici`).

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File modificato | `src/pages/TemplatePage.tsx` |
| Ricerca cliente | `clienti` join `profiles` → nome, cognome, email, codice_fiscale, ragione_sociale |
| Ricerca polizza | `titoli` join `prodotti`, `compagnie`, `uffici` → numero_titolo, data_scadenza, premio_lordo, compagnia, sede |
| Pattern UI | SearchableSelect (Popover+Command) per entrambe le ricerche |
| Fallback | Se nessuna selezione, mostra dati di esempio |

