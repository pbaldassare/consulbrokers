# Provvigioni visibili dentro le card Firma e Quietanza

## Obiettivo
Portare il calcolo provvigioni dentro le card "Premi per Garanzia – Firma" e "– Quietanza" (oggi mostrano solo `Provvigioni Firma/Quietanza: €X` come riga finale anonima). Devono comparire graficamente:

- **Totale provvigione agenzia** (€) — derivato da `% Provvigione Agenzia × Premio Netto`, **editabile** (override sia in % sia in €).
- **Ripartizione**:
  - **Produttore** (nome + €) — calcolato con `% commerciale` auto-popolata dalla tabella `produttori_provvigioni_ramo` (lookup `anagrafica_id + ramo_codice` → fallback `percentuale_base`).
  - **Consulbrokers SPA** (€) — il differenziale (100 − % commerciale).

Identico in entrambe le card, con i valori di Firma calcolati su `premioNettoFirma` e Quietanza su `premioNettoQuietanza`.

## Cosa cambia (UI)

`src/components/polizze/PremiGaranziaCardShell.tsx`
- Sostituisce l'attuale footer monoriga "Provvigioni Firma/Quietanza" con un blocco strutturato:

```text
┌───────────────────────────────────────────────────────────┐
│ PROVVIGIONI FIRMA                                         │
│ ┌──────────────┬──────────────┐                           │
│ │ % Agenzia    │ Totale (€)   │  ← entrambi editabili,    │
│ │ [ 12.50  ]   │ [ 125.00 ]   │     bidirezionali         │
│ └──────────────┴──────────────┘                           │
│ Ripartizione:                                             │
│  • Mario Rossi (Produttore, 70%)        €  87,50          │
│  • Consulbrokers SPA (differenziale)    €  37,50          │
└───────────────────────────────────────────────────────────┘
```

- Nuove props: `percentualeAgenzia`, `onPercentualeAgenziaChange`, `produttoreLabel`, `percentualeCommerciale`, `produttoreIsSede` (per nascondere lo split quando 100% Sede).
- Editing del **Totale (€)** → ricalcola `% agenzia` come `totale / premioNetto * 100` (override manuale).
- Lo split si aggiorna in tempo reale.

`src/pages/ImmissionePolizzaPage.tsx`
- Passa le nuove props a entrambe le card (stesso valore di `percentualeProvvigione` e `percentualeCommerciale`, label produttore preso da `commercialiList`).
- La sezione **"Provvigioni"** in fondo viene **alleggerita**: rimane solo la **selezione del Commerciale/Sede** (perché serve scegliere il produttore prima di vedere lo split). I campi `% Agenzia`, `% Commerciale`, importi e split duplicati vengono rimossi da lì — sono ora nelle card.
- Il flag `auto` (auto-popolata da Provvigioni per Ramo) si sposta accanto al campo `% Agenzia` dentro la card.

## Fuori scope
- Logica DB / edge function `calcola-provvigioni` (resta invariata).
- Caso "commerciale = admin" / `solo_statistico` (gestito a backend, non cambia).
- Card RCA, Firma/Quietanza addizionali, totali generali.

## Domande prima di implementare
1. **Sezione Provvigioni in fondo**: la riduco al solo selettore Commerciale (come proposto) o la elimino del tutto spostando anche il select Commerciale dentro la card Firma?
2. **Editing del totale €**: se l'utente edita il totale in Firma, lo propaghiamo anche a Quietanza (oggi `% agenzia` è unica) o teniamo le due card indipendenti con due % distinte?
