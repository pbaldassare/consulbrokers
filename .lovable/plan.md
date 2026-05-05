## Obiettivo

Sincronizzare i campi **IPT** e **SSN** tra i due punti dove appaiono nella card (sub-righe della riga RCA principale + box "Totali"), così che modificare uno dei due aggiorni l'altro in tempo reale e produca un unico salvataggio coerente.

## Problema attuale

In `src/components/polizze/VociRcaCard.tsx` IPT e SSN compaiono in 2 posti:
1. Sotto la riga RCA principale (input `ipt-${id}` / `ssn-${id}`) → usano `draftVoci` (live).
2. Nel riquadro "Totali Tasse" (input `tot-ipt-*` / `tot-ssn-*`) → ancora **uncontrolled** (`defaultValue` con `key` legato al valore salvato).

Conseguenza: digitando in uno dei due, l'altro non si aggiorna finché il refetch non arriva → percezione di disallineamento.

## Soluzione (1 file)

In `src/components/polizze/VociRcaCard.tsx`, riquadro "Totali" (linee ~969–999):

- Recuperare la riga RCA principale e il suo merge con `draftVoci`.
- Calcolare `iptLive` / `ssnLive` dal draft della riga RCA (fallback al `calcolaLordo` corrente).
- Convertire i due Input "tot-ipt" / "tot-ssn" da uncontrolled a **controlled** (`value={iptLive}` / `value={ssnLive}`):
  - `onChange` → `setDraft(rcaRow.id, { imposta_provinciale | ssn })` (stesso draft della riga RCA → entrambi i posti restano allineati istantaneamente).
  - `onBlur` → `clearDraft` + `handleTotaleIptBlur` / `handleTotaleSsnBlur` (mutation DB invariata).

Nessun cambio a `handleTotaleAccBlur` (Acc. accessorie distribuite, non ha controparte singola sulla riga).

## File toccati

- `src/components/polizze/VociRcaCard.tsx`

## Note

- Nessuna migration.
- Le validazioni e il salvataggio DB rimangono invariati (sempre on-blur via handler esistenti).
