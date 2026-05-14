## Obiettivo

Migliorare la sezione **Provvigioni Firma** e **Provvigioni Quietanza** dentro le card colorate dell'Immissione Polizza:

1. Mostrare il **nome reale del produttore** (es. "Interfidi") nella ripartizione, non "Sede" quando in realtà un produttore è selezionato.
2. Caricare la **% Produttore** dal DB per quel ramo (es. Interfidi 40% sul ramo X) → quando l'utente digita 100 € di provvigione totale, il sistema mostra **40 € a Interfidi** e **60 € alla Sede** (differenziale).
3. Rinominare la riga differenziale da "Consulbrokers SPA" → **"Sede"**.
4. Permettere di **digitare direttamente il Totale Provvigione (€)** sbloccando lo split senza dover passare per la % Agenzia (già presente, da consolidare visivamente).
5. Replicare lo stesso comportamento sia nella card **Firma** (verde teal) sia nella card **Quietanza** (ambra).

## Causa del bug visivo attuale

Nello screenshot l'utente seleziona Interfidi come Produttore (selettore AE), ma le card mostrano **"Sede 100%"** perché:

- `useEffect` di auto-lookup `produttori_provvigioni_ramo` è agganciato a `selectedAE` (Account Executive).
- La label produttore + flag "isSede" passati alle card vengono invece da `selectedCommerciale`, che parte da `__sede__` di default → la card crede sempre che il commerciale sia la Sede.

## Modifiche

### 1. `src/pages/ImmissionePolizzaPage.tsx`

- Quando l'utente seleziona un **Produttore (AE)**, propagare la stessa selezione anche al **Commerciale** (se ancora `__sede__`), così la card mostra subito nome + split.
- In alternativa: derivare `produttoreLabel` e `produttoreIsSede` dal **Produttore (AE) selezionato** quando `selectedCommerciale === "__sede__"`, leggendo il nome da `aeList`. Così:
   - Se è selezionato un AE produttore → label = "Interfidi", isSede = false.
   - Solo se nessun AE è selezionato → isSede = true.
- Rimuovere la sezione "Provvigioni — Commerciale" duplicata (righe 1515-1557): tutto vive nelle card. Lasciare solo un selettore Commerciale compatto se serve, altrimenti rimuoverlo del tutto e usare l'AE come fonte unica.

### 2. `src/components/polizze/PremiGaranziaCardShell.tsx`

Footer provvigioni (righe 363-489) — restyle:

```text
PROVVIGIONI FIRMA                                   [auto da Provvigioni Ramo]
┌──────────────────────────┬──────────────────────────────────┐
│ TOTALE PROVVIGIONE (€) ✏ │ % AGENZIA (su netto)            │
│ [   100,00   ]            │ [   12,50  ]                    │
└──────────────────────────┴──────────────────────────────────┘

RIPARTIZIONE
┌────────────────────────────────────────────────────────────┐
│ 👤  Interfidi                          40 %     €  40,00  │
│     RC Generale · da Provvigioni Ramo                       │
├────────────────────────────────────────────────────────────┤
│ 🏢  Sede                               60 %     €  60,00  │
│     Differenziale                                           │
└────────────────────────────────────────────────────────────┘
```

Dettagli implementativi:
- Sostituire la label "Consulbrokers SPA" con **"Sede"** nella riga differenziale (mantenendo lo stile primary).
- Invertire l'ordine visivo nei due campi: prima "Totale Provvigione (€)" più grande/evidente, poi "% Agenzia" come campo secondario — entrambi continuano a essere bidirezionali (logica `handleTotChange` già presente).
- Quando `produttoreLabel` esiste e non è sede, il blocco ripartizione resta visibile anche con `totProv = 0` (già fatto), ma deve aggiornarsi live appena l'utente digita nel Totale Provvigione.
- Caso `produttoreIsSede`: rimane riga unica "🏢 Sede 100%".
- Aggiungere un piccolo badge `% Produttore` accanto al nome con tooltip "Da produttori_provvigioni_ramo · ramo {codice}".

### 3. Comportamento auto-lookup (già esistente, nessun cambio funzionale)

- `useEffect` su `selectedAE + selectedRamoData.codice` → popola `percentualeCommerciale` con badge `auto`. Confermato OK.
- Aggiungere fallback: se l'utente seleziona un produttore ma non c'è ancora una % nel DB né in `percentuale_base`, mostrare badge `manuale` e lasciare il campo a 0 modificabile.

## Note tecniche

- File toccati: `src/pages/ImmissionePolizzaPage.tsx`, `src/components/polizze/PremiGaranziaCardShell.tsx`. Nessuna migrazione DB.
- Tutti i colori via token semantici (`bg-primary/5`, `border-border`, `bg-amber-*`, `bg-teal-*` già esistenti).
- Il nome "Sede" mostrato nella ripartizione rappresenta la quota agenzia residuale (Consulbrokers / sede dell'utente loggato).
