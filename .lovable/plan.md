

## Piano: Aggiungere tutte le sezioni al form di creazione cliente

### Problema

Il dialog "Nuovo Cliente" ha solo dati anagrafici base, contatti, gruppo finanziario e rete commerciale. Mancano le sezioni **Dati Gestionali**, **Dati Statistici** e **Dati Contabili** che sono presenti nella pagina di dettaglio (`ClienteDetail.tsx`).

### Cosa cambia

Il dialog viene ampliato con 3 sezioni aggiuntive in Accordion (collassabili), replicando esattamente i campi del dettaglio:

```text
Dialog "Nuovo Cliente" (max-w-3xl)
├── Tipo Cliente + AI Scanner
├── Dati Anagrafici (esistente)
├── Contatti (esistente)
├── Gruppo Finanziario (esistente → spostato dentro Dati Statistici)
├── [NUOVO] Dati Gestionali (Accordion)
│   ├── Tipo Persona, Sesso, Comune/Prov Nascita
│   ├── Tipo Sommario, Cliente Non Ceduto, Azienda SSN/SX
│   ├── Stat. Premi/Sinistri, Spec SX Danni/Sanità
│   ├── Codice Ricerca, Titolo, Stato Cliente, Prospect
│   └── Cellulare, Fax, Nazione, Attenzione di
├── [NUOVO] Dati Statistici (Accordion)
│   ├── Zona, Indotto, Gruppo Finanziario
│   ├── Attività, Settore, Azienda Stat., Contratto
│   ├── Matricola, Riferimento, Fatturato, N. Dipendenti
│   ├── Codice ATECO
│   └── Cliente Associato, Captive, Internazionale
├── Rete Commerciale (esistente)
└── [NUOVO] Dati Contabili (Accordion)
    ├── Fido Credito €
    └── Fido Cauzioni €
```

### Modifiche

| File | Modifica |
|---|---|
| **`src/pages/ClientiList.tsx`** | Aggiungere ~20 nuovi state per i campi mancanti (codice_ricerca, titolo, stato_cliente, prospect, tipo_persona, sesso, comune_nascita, provincia_nascita, tipo_sommario, zona, indotto, attivita, settore, codice_ateco, fatturato, num_dipendenti, fido_credito, fido_cauzioni, nazione, cellulare, fax, attenzione_di + switch booleani). Aggiungere 3 sezioni Accordion nel dialog con gli stessi campi/dropdown del dettaglio. Includere tutti i nuovi campi nel payload di `createMutation`. Aggiornare `resetForm` per resettare tutti i nuovi state. Spostare "Gruppo Finanziario" dentro la sezione Statistici |

### Dettagli tecnici

- Stessi dropdown/opzioni usati in `ClienteDetail.tsx` (Titolo, Stato, Prospect, Tipo Persona, Sesso, Tipo Sommario)
- Switch per booleani: cliente_non_ceduto, azienda_ssn_sx, statistica_premi_sinistri, cliente_associato, cliente_captive, internazionale
- I campi numerici (fatturato, num_dipendenti, fido_credito, fido_cauzioni) usano `type="number"`
- Nessuna modifica DB: tutte le colonne esistono gia nella tabella `clienti`
- Le sezioni sono in Accordion collassati di default per non appesantire il form

