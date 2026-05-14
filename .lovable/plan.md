## Obiettivo

Nel form Immissione Polizza, rendere le sezioni **Provvigioni Firma** e **Provvigioni Quietanza** dentro le card colorate (teal/amber) molto più chiare visivamente, con:
- auto-lookup della **% del Produttore** dal DB (`produttori_provvigioni_ramo` per anagrafica + ramo, fallback `anagrafiche_professionali.percentuale_base`)
- **Consulbrokers SPA** mostrata come differenziale automatico
- **Totale Provvigione (€)** sempre **modificabile** (sblocca % Agenzia)
- **% Agenzia** modificabile (la fonte reale del totale)

## Stato attuale (cosa c'è già e cosa manca)

Già presente in `src/pages/ImmissionePolizzaPage.tsx`:
- Hook `useEffect` (righe 630-663) che, dato `selectedAE` (Produttore, es. *Interfin*) + `selectedRamoData.codice`, legge `produttori_provvigioni_ramo.percentuale_provvigione` e popola `percentualeCommerciale` con badge `auto`.
- Card `PremiGaranziaCardShell` riceve `percentualeAgenzia`, `percentualeCommerciale`, `produttoreLabel`, `produttoreIsSede` e calcola `quotaProd` / `quotaCB`.

Cosa non va (vedi screenshot utente):
1. Il blocco "Ripartizione" (Produttore + Consulbrokers) appare **solo se `totProv > 0`** → con % Agenzia 0 sparisce e l'utente non capisce nulla.
2. Il **nome del produttore** e la **% letta dal DB** non sono evidenziati: non si vede "Interfin = X% (da Provvigioni Ramo)".
3. La sezione separata **"Provvigioni — Commerciale"** in fondo (righe 1513-1555) duplica le informazioni e crea confusione: utente la vuole **dentro** la card Firma/Quietanza.
4. Layout attuale: % Agenzia + Totale Provvigione su 2 colonne, ripartizione sotto come nota → da rendere molto più "graficamente" forte.

## Modifiche

### 1. `src/components/polizze/PremiGaranziaCardShell.tsx` — Footer provvigioni

Ristrutturare il footer (righe ~357-446) in 3 blocchi visivi impilati:

```text
┌─ PROVVIGIONI FIRMA ──────────────────── [auto] ─┐
│  ┌────────────────┬──────────────────────────┐  │
│  │ % AGENZIA      │ TOTALE PROVVIGIONE (€)   │  │
│  │ [  12.50  ]    │ [    137,45    ]   ✏️    │  │
│  └────────────────┴──────────────────────────┘  │
│                                                  │
│  RIPARTIZIONE  (sempre visibile se produttore)   │
│  ┌──────────────────────────────────────────┐   │
│  │ 👤 Interfin SRL              68%  91,87€ │   │
│  │    (da Provvigioni Ramo  ──  RC Generale)│   │
│  ├──────────────────────────────────────────┤   │
│  │ 🏢 Consulbrokers SPA   diff 32%  45,58€  │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

Dettagli:
- Mostrare il blocco **Ripartizione sempre** che ci sia un produttore selezionato (anche con `totProv = 0`), con importi a `0,00 €` quando non c'è premio.
- Riga produttore: icona persona, label produttore, badge `% Produttore` con tooltip "Da produttori_provvigioni_ramo (ramo X)" + importo a destra in mono bold.
- Riga Consulbrokers: icona azienda, label "Consulbrokers SPA", badge `Differenziale (100 - %Prod)%` + importo.
- Caso `produttoreIsSede`: una sola riga "🏢 Sede 100%" con importo intero.
- Background distinto: card produttore con sfondo neutro chiaro, card Consulbrokers con accent `bg-primary/5 border-primary/30`.
- Mantenere `Input` Totale Provvigione (€) editabile che ricalcola % Agenzia (logica `handleTotChange` già presente).
- Quando l'utente modifica % Agenzia o Totale → rimuove badge `auto` su Totale (continua a esserci su % Commerciale).

Aggiungere prop opzionale `ramoLabel?: string` per mostrare il ramo nella riga produttore.

### 2. `src/pages/ImmissionePolizzaPage.tsx`

- Passare `ramoLabel={selectedRamoData?.descrizione}` a entrambe le card.
- **Eliminare** la sezione `PolizzaSection title="Provvigioni — Commerciale"` (righe 1513-1555). Il selettore Commerciale + % Commerciale viene spostato come piccola riga sopra il footer provvigioni dentro la card Firma (read-only nella Quietanza, mostra solo il nome). In alternativa più semplice: lasciare il selettore Commerciale in una mini-section ridotta (solo dropdown commerciale) e mostrare % + ripartizione esclusivamente dentro le card.
  - Scelgo opzione semplice: ridurre la sezione a **solo dropdown "Commerciale"** + nota; % e ripartizione vivono dentro le card.

### 3. Comportamento auto-lookup

Nessun cambio funzionale richiesto: l'`useEffect` esistente è corretto. Aggiungiamo solo:
- log toast quando si auto-popola: `toast.info("% Produttore caricata da Provvigioni Ramo")` (una volta per cambio ramo/produttore).
- Se non trovata né `produttori_provvigioni_ramo` né `percentuale_base`, mostrare nella riga produttore badge `manuale` invece di `auto`.

## Note tecniche

- Tutte le classi colore via token semantici (`bg-primary/5`, `text-muted-foreground`, `border-border`, `bg-amber-*` già esistenti per quietanza). Nessun colore hardcoded nuovo.
- `percentualeCommerciale` resta lo stato unico per la quota produttore (condiviso Firma/Quietanza).
- Il **Totale Provvigione** resta calcolato da `premioNetto * %Agenzia / 100` ma editabile (handler già presente).
- File toccati: `PremiGaranziaCardShell.tsx`, `ImmissionePolizzaPage.tsx`. Nessuna migrazione DB.
