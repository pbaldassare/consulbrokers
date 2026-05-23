
# Riattivazione Polizza — Modale + Logica completa

Speculare a Sospensione. Risposte utente integrate:
- **Q1 → (b)**: nessuna rata-bis pro-rata. Riprendo dalla rata successiva a quella sospesa.
- **Q2**: mantengo split provvigioni esistente della polizza madre (Sede / Specialist / Consul da `policy-commission-split`).
- **Q3**: oneri riattivazione = **titolo separato** da contabilizzare (avrà propria messa a cassa).

---

## 1. Esempio concreto

Polizza 434334433 — premio annuo 1.200 €, frazionamento Trimestrale (4 rate da 300 €), 01/01/2026 → 31/12/2026.

Stato prima della riattivazione:
```text
Rata 1  01/01 – 01/04   300 €   INCASSATA
Rata 2  01/04 – 01/07   300 €   INCASSATA
Rata 3  01/07 – 01/10   300 €   SOSPESA il 15/07/2026
Rata 4  01/10 – 31/12   (cancellata dalla sospensione)
```

Riattivazione il 20/08/2026 con oneri 25 € a carico cliente.

Risultato:
```text
Rata 3  01/07 – 01/10   300 €   ATTIVA (rimane invariata, stato torna 'attivo')
Rata 4  01/10 – 31/12   300 €   ATTIVA (ricreata)
+ Titolo Oneri Riattivazione  25 €  ATTIVO, da contabilizzare
  - split provvigioni come polizza madre
  - movimento RA, log, allegato opzionale
```

---

## 2. Modale `RiattivazionePolizzaDialog` (nuovo file)

`src/components/polizze/RiattivazionePolizzaDialog.tsx` — pattern identico a `SospensionePolizzaDialog`.

Campi:
- Data riattivazione (default oggi)
- Oneri a carico cliente (importo, default 0; se 0 → niente titolo oneri)
- Motivo (default "Riattivazione su richiesta cliente")
- Documento allegato opzionale (nome editabile, no folder)
- AlertDialog di conferma con riepilogo (rate ricreate, oneri, allegato)

CTA "Riattiva Polizza" nella card gialla di `TitoloDetail` apre il dialog (sostituisce la navigazione a `/riattivazione-polizza`).

---

## 3. Logica mutation (sequenza)

1. Fetch titolo sospeso: `numero_titolo`, `riga`, `garanzia_da/a`, `frazionamento`, `importo_firma`, `data_fine_copertura`, split provvigioni.
2. Update rata sospesa: `stato='attivo'`, `data_riattivazione` set, azzera `data_sospensione / limite_riattivazione / motivo_sospensione`.
3. **Ricrea quietanze future** dal periodo successivo a `garanzia_a` rata sospesa fino a `data_fine_copertura`, usando `frazionamentoMesi()` (`src/lib/frazionamento.ts`); importo per rata = `importo_firma / rate_per_anno`; ogni insert con `sostituisce_polizza` = id rata precedente, riga incrementale, stesso `numero_titolo`. Skip se poliennale (1 sola rata).
4. **Se oneri > 0**: insert nuovo titolo "Oneri Riattivazione" — stesso cliente / polizza / sede, `numero_titolo` differente o suffisso (vedi nota tecnica), importo firma = oneri, split provvigioni copiato dalla madre, `stato='attivo'`, `data_messa_cassa NULL` → entrerà in Carico del Mese normalmente.
5. Insert `movimenti_polizza` con `tipo_documento='RA'`, descrizione "Riattivazione polizza + oneri X € (allegato: …)", `stato='attivo'` sulla rata riattivata.
6. Upload documento (se presente) — stesso pattern Sospensione: `documenti_titoli/titolo/{id}/riattivazione_{ts}_{safeName}`, riga in `documenti` con nome editabile.
7. `logAttivita('riattivazione_polizza', 'titolo', id, { data_riattivazione, oneri, quietanze_ricreate:[ids], titolo_oneri_id, documento_id, documento_nome })`.
8. Invalidate query: `titolo`, `movimenti-polizza`, `timeline`, `documenti`, `portafoglio`, `portafoglio-attive/storico/carico`.

Note tecniche:
- Il titolo "oneri" usa lo stesso `numero_titolo` della polizza madre con marker (es. campo `note='Oneri di riattivazione'`) per riconoscibilità UI senza modificare schema; se serve un campo dedicato lo decidiamo dopo aver visto i campi disponibili su `titoli`.
- Lo split provvigioni è copiato 1:1 dalla rata madre (stesse %/quote Sede/Specialist/Consul).

---

## 4. Memoria

Estendo `mem://insurance/policy-suspension-rules` con sezione "Riattivazione":
- modale dedicato (no pagina),
- ricrea quietanze future complete dal periodo successivo (no pro-rata),
- se oneri > 0 → titolo separato da contabilizzare con split provvigioni copiato dalla madre,
- movimento `RA`, log `riattivazione_polizza`, documento opzionale.

---

Procedo all'implementazione appena approvi.
