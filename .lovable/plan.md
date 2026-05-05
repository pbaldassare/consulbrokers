# Pulizia sezione Importi + due card RCA in colonna + restyle Provvigioni

Tre interventi mirati:

## 1. Rimuovere i campi "doppione" nella sezione Importi (solo per polizze RCA Auto)

Quando `isRamoAuto((t as any).ramo)` è vero:

- **Modalità lettura**: nascondere completamente i due blocchi "Premio alla firma odierno" e "Premio prossima quietanza" (Netto / Addizionali / Tasse / Lordo / Totale). Restano visibili solo:
  - `Provvigioni Firma` e `Provvigioni Quietanza` (in una riga compatta a 2 colonne)
  - Il blocco flags (Valuta, Indicizzata, Rimborso, Pag. Diretto Comp., Formato Elettronico, Incassato, Data Incasso)
- **Modalità modifica**: rimuovere i 4 input × 2 colonne (Netto/Addiz/Tasse/Lordo per Firma e Quietanza). Restano editabili solo `Provvigioni Firma`, `Provvigioni Quietanza` e i flag (Valuta/Indicizzata/Rimborso). Aggiungere banner blu: "Per le polizze RCA Auto i premi sono calcolati dalle voci di garanzia sotto."
- Per le polizze **non-RCA** la sezione resta identica a oggi (nessun cambio).

## 2. Card RCA Firma e Quietanza in colonna (una sotto l'altra)

In `TitoloDetail.tsx` cambiare la griglia che le contiene:

```tsx
<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
```

→

```tsx
<div className="space-y-4">
```

Le due card occuperanno l'intera larghezza, una sopra l'altra, più ordinato e leggibile sul viewport ~800px.

## 3. Eliminare la card "Premi per Garanzia" (doppione)

Nella vista titolo c'è una `SectionCollapsible title="Premi per Garanzia"` (intorno a riga 2651) che gestisce un'altra tabella di garanzie con capitale/tasso/firma/rata/annuo: per le polizze RCA Auto è completamente sovrapposta alle nuove card RCA. Per coerenza la **rimuoviamo dall'UI** (la tabella `premi_garanzia_polizza` continua a esistere e il blocco di codice per l'edit resta inutilizzato — lo possiamo rimuovere in un secondo passaggio insieme a `editingPremi/premiRows/savePremiMutation` se vuoi una pulizia totale; per ora togliamo solo il render). Se la card serve per polizze NON-RCA con elenco garanzie (vita/aziende), la rendiamo condizionale: visibile solo se `!isRamoAuto`.

Soluzione adottata: **mantengo la card solo per i rami non-RCA**, nascosta per RCA Auto (dove c'è già la composizione dedicata).

## 4. Restyle "Commerciale & Provvigioni" — Consul + Produttore collegato

Trasformare il blocco di lettura corrente (riga 2127-2152) in una mini-dashboard:

- Header con avatar/iniziali del commerciale e badge ruolo (Consul / Sede / Admin).
- Due card affiancate (`grid grid-cols-1 md:grid-cols-2 gap-3`):
  - **Card Commerciale** (border-l teal): nome, ruolo, % e importo provvigione (con icona `User` e formatazione monetaria grande).
  - **Card Consulbrokers SPA** (border-l amber): "Quota agenzia", % residua e importo (icona `Building2`).
- Quando commerciale = admin, una sola card centrata con badge "Statistico" e label esplicativa.
- Aggiungere progress bar visiva che mostra lo split percentuale (es. 70% Commerciale / 30% Consulbrokers).
- Tipografia: importi in `font-mono tabular-nums text-2xl text-teal-900`, percentuali in pill.

Non cambia la logica di salvataggio né la struttura DB — solo il render in modalità lettura.

## File toccati

- `src/pages/TitoloDetail.tsx`
  - Sezione Importi: branching `isRamoAuto` per nascondere blocchi premio in lettura/modifica.
  - Container delle due `<VociRcaCard />`: da `grid xl:grid-cols-2` a `space-y-4`.
  - `SectionCollapsible "Premi per Garanzia"`: avvolta in `{!isRamoAuto((t as any).ramo) && (...)}`.
  - Blocco di lettura `Commerciale & Provvigioni`: nuovo layout a card con avatar + progress bar.

Nessuna migrazione DB.
