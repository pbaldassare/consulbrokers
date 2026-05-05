## Obiettivo

1. **Correggere** la formula errata del contributo SSN (oggi calcolato sull'imposta provinciale, deve essere sul **netto**).
2. **Permettere override manuale** sulla riga RCA principale per:
   - **SSN** (campo editabile, sostituisce il calcolo automatico)
   - **Imposta provinciale** in valore € (oltre all'aliquota %)

## Formula corretta (normativa RCA)

```
IPT  = netto × aliquota_provinciale%
SSN  = netto × 10,5%        ← oggi è imposta × 10,5% (BUG)
Lordo = netto + IPT + SSN
```

Verifica con i tuoi numeri (Napoli, netto 668,85, ali. 16%):
IPT 107,02 + SSN 70,23 = Lordo 846,10 € ✓

## Modifiche file `src/components/polizze/VociRcaCard.tsx`

### A. Fix calcolo (sempre attivo)

- **Riga 56**: `ssn = round2(imposta × SSN_PCT/100)` → `ssn = round2(netto × SSN_PCT/100)`
- **Riga 266**: `factor = 1 + (aliq/100) × (1 + SSN%/100)` → `factor = 1 + aliq/100 + SSN%/100`

### B. Override manuale SSN e Imposta sulla riga RCA

Logica: la funzione `calcolaLordo` accetta `imposta_provinciale` e `ssn` opzionali; se la voce RCA ha valori salvati e diversi dal calcolo standard, li usa come "override" e ricalcola il lordo come `netto + imposta_override + ssn_override`.

UI nelle due righe sub-RCA (desktop righe 482-494, mobile righe 573-578): trasformo i valori da semplice testo a `<Input>` editabile (numeric step 0.01), allineato a destra, con `onBlur` che salva il valore manuale e ricalcola il lordo. Aggiungo un piccolo bottone "↺" accanto a ciascun campo per ripristinare il calcolo automatico (cancella l'override → torna alla formula).

Stato dell'override: per non aggiungere colonne, uso una **flag locale derivata**:
- Se `imposta_provinciale` salvato differisce di > 0,01 € da `netto × aliq%` ⇒ override IPT attivo.
- Se `ssn` salvato differisce di > 0,01 € da `netto × 10,5%` ⇒ override SSN attivo.

Quando l'utente modifica `Netto` o `Aliquota %`, mostro un toast "Sovrascrittura SSN/IPT mantenuta" se gli override sono attivi e li lascio invariati; altrimenti li ricalcolo come oggi.

Nuovi handler:
- `handleImpostaOverrideBlur(v, value)` → upsert `imposta_provinciale = value`, `lordo_calcolato = netto + value + (ssn_corrente)`.
- `handleSsnOverrideBlur(v, value)` → upsert `ssn = value`, `lordo_calcolato = netto + (imposta_corrente) + value`.
- `handleResetOverride(v, campo)` → ricalcola con la formula standard e salva.

Il calcolo Lordo→Netto inverso (riga 266) resta basato sulla formula standard: se l'utente edita il Lordo mentre ci sono override attivi, gli override vengono **azzerati** (toast informativo) e si rientra in modalità automatica. Questo evita ambiguità matematiche.

### C. Quietanza

Stessa identica logica vale per la card Quietanza (è lo stesso componente con `tipoPremio="quietanza"`). L'override marca automaticamente `quietanza_personalizzata=true` come già succede per gli altri edit.

## Memoria

Aggiorno `mem://insurance/rca-voci-composizione-premio`:
- Cambio formula documentata: `ssn = netto × 10.5%`.
- Aggiungo nota: "IPT e SSN della riga RCA sono editabili manualmente; se editati, restano fissi finché l'utente non clicca ↺ Ripristina, oppure modifica il Lordo (che azzera gli override)."

## Nessuna modifica DB

Le colonne `imposta_provinciale` e `ssn` esistono già su `premi_garanzia_polizza`. Nessuna migration necessaria.
