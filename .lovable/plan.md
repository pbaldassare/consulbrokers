## Problema

Sul viewport corrente (805px) la tabella desktop di `VociRcaCard` viene renderizzata ma le righe di override IPT/SSN finiscono in overflow orizzontale, quindi i campi editabili per SSN/IPT non sono raggiungibili. Le funzioni di override (`handleSsnOverrideBlur`, `handleImpostaOverrideBlur`, `handleResetOverride`) e gli input sono già implementati, ma visivamente nascosti.

Inoltre il valore SSN salvato a DB (`12.08`) è stato calcolato con la vecchia formula errata (su IPT invece che su netto), per questo viene mostrato come "manuale" anche se l'utente non lo ha mai toccato.

## Modifiche a `src/components/polizze/VociRcaCard.tsx`

### 1. Breakpoint layout (linee 489 e 657)
Sostituire la breakpoint `md` con `lg` così che sotto 1024px (incluso 805px) venga renderizzato il layout mobile a card, dove gli input SSN/IPT sono ben visibili in colonna:
- Linea 489: `className="hidden md:block overflow-x-auto"` → `"hidden lg:block overflow-x-auto"`
- Linea 657: `className="md:hidden divide-y"` → `"lg:hidden divide-y"`

### 2. Auto-correzione SSN salvato in modo errato (linee 49-82, `calcolaLordo`)
Quando il valore SSN salvato è suggestivamente errato (= IPT × 10,5%, vecchia formula bug), trattarlo come "non override" e ricalcolarlo automaticamente. Concretamente:
- Calcolare `ssnLegacyBug = round2(impostaAuto * 0.105)` (vecchia formula)
- Se `ssnSaved` è entro 0,01€ da `ssnLegacyBug` E differisce da `ssnAuto`, considerarlo NON override (ssnAuto vince) e contestualmente schedulare un upsert per riportare il DB al valore corretto (passare attraverso `useEffect` o inline al primo render utile, oppure lasciare che venga corretto al primo blur dell'utente).

Approccio scelto: solo flag `overrideSsn = false` se il valore salvato corrisponde al bug legacy, così sparisce il badge "manuale" e il bottone reset. Il prossimo evento di edit (Netto, Lordo, IPT) sovrascrive comunque il valore in DB con quello corretto.

### 3. Pulsante "Reset SSN" sempre disponibile per RCA principale
Anche se `overrideSsn` è false, mostrare un piccolo bottone reset accanto all'input SSN che forza il valore al calcolo `netto × 10,5%` e lo persiste — utile per pulire valori storici sbagliati senza dover toccare Netto o Lordo.

In alternativa più semplice: aggiungere un pulsante "Ricalcola IPT/SSN" nell'header della card che riapplica `calcolaLordo` con `imposta_provinciale: null, ssn: null` e salva i valori auto-calcolati per la riga RCA principale.

## Approccio consigliato (più semplice e robusto)

Implementare solo:
- **(1)** breakpoint `lg`
- **(3 alternativo)** un pulsante "Ricalcola IPT/SSN" nell'header della VociRcaCard, accanto al campo Imposta provinciale, che azzera `imposta_provinciale` e `ssn` sulla riga RCA principale e li riscrive ai valori auto-calcolati.

Questo permette all'utente di:
- vedere e modificare SSN/IPT su qualsiasi viewport ≥ 320px
- ripulire con un click eventuali valori SSN errati salvati con la vecchia formula bug
