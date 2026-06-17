## Capito — esempio concreto

Polizza `434334433` (baldassare paolo, CORPI IMBARCAZIONI DIPOR.) ha 3 quietanze:
- Q1 2025-05-25 → 2026-05-25 (messa a cassa)
- Q2 2026-05-25 → 2027-05-25
- Q3 2027-05-25 → 2028-05-25

A fine periodo Q2 la compagnia comunica un conguaglio di €120 di premio extra. L'utente:
1. Clicca **Esegui Appendice** sulla riga `434334433`.
2. Sceglie tipo = **Regolazione**.
3. Seleziona dal **SearchableSelect "Quietanza di riferimento"** la rata Q2 (2026-05-25 → 2027-05-25).
4. Inserisce in 4 campi affiancati: **Netto 100,00 / Tasse 20,00 / Lordo 120,00 / Provvigioni 15,00** (le provvigioni vengono pre-calcolate applicando la % della polizza originale sul netto, ma restano editabili).
5. Allega il PDF del conguaglio compagnia.
6. Salva: viene creato un record `appendici_polizza` (tipo=regolazione, collegato alla polizza madre e alla quietanza Q2) e — automaticamente — un nuovo `titoli` di tipo Regolazione (RG) collegato alla Q2 (`sostituisce_polizza=Q2.id`), che eredita anagrafiche/compagnia/rapporto/ramo/percentuali dalla madre, importi presi dai 4 campi, **stato = "attivo"**.
7. Da quel momento la regolazione vive come una normale rata: appare in **Carico**, può essere **messa a cassa**, **incassata**, genera **provvigioni** secondo i meccanismi esistenti (trigger `genera_quietanza_su_messa_cassa` skip perché tipo RG, niente quietanza successiva).

Niente più redirect a `ImmissionePolizzaPage` con `mode=regolazione`: tutto succede dentro il dialog "Esegui Appendice", coerente con il flusso documenti che già esiste.

---

## Modifiche DB (migrazione)

**`appendici_polizza` — colonne aggiunte**
- `quietanza_id uuid REFERENCES titoli(id) ON DELETE SET NULL` — rata a cui è agganciata la regolazione
- `titolo_regolazione_id uuid REFERENCES titoli(id) ON DELETE SET NULL` — FK al nuovo titolo RG generato
- `premio_netto numeric(14,2)`
- `tasse numeric(14,2)`
- `premio_lordo numeric(14,2)`
- `provvigioni numeric(14,2)`
- `percentuale_provvigione numeric(7,4)` (snapshot della % della madre al momento della creazione)

**`titoli` — nessuna modifica strutturale**: il record RG generato usa colonne esistenti (`sostituisce_polizza`, `premio_netto`, `tasse`, `premio_lordo`, `provvigioni_firma`, `percentuale_provvigione`, `stato`, `numero_titolo`, ecc.) e un nuovo valore in `tipo_movimento` = `'regolazione'` (testo libero, già usato per altri tipi).

**Trigger / RPC**
- Nuova RPC `crea_titolo_da_regolazione(p_appendice_id uuid)` SECURITY DEFINER: legge l'appendice + quietanza di riferimento, INSERT in `titoli` ereditando campi della madre, imposta `appendici_polizza.titolo_regolazione_id`, scrive snapshot in `titoli_regolazioni`.
- Patch trigger `genera_quietanza_su_messa_cassa`: skip se `NEW.tipo_movimento = 'regolazione'` (la regolazione è one-shot, non genera rata successiva).
- Patch `policy-cancellation-cascade`: cancellando una quietanza, cascade anche alle eventuali regolazioni agganciate.

**GRANT** standard per le nuove colonne (eredita dai GRANT esistenti su `appendici_polizza`) + `GRANT EXECUTE ON FUNCTION crea_titolo_da_regolazione TO authenticated`.

---

## Modifiche UI

**`AppendiceDialog.tsx`** — quando `tipo === "regolazione"`:
- Sostituire il banner+bottone "Apri form regolazione" con i campi inline:
  - `SearchableSelect` "Quietanza di riferimento" (lista rate `titoli` con stesso `numero_titolo`, label `"Rata N · gg/mm/aaaa → gg/mm/aaaa · €lordo"`)
  - Grid 4 colonne: Netto / Tasse / Lordo / Provvigioni (auto-calcolate, editabili)
  - Data effetto + Data scadenza (default = periodo della quietanza scelta)
  - Oggetto + Note + Allegato (riusati)
- Footer: bottone "Crea regolazione" (non più "Apri form"). On submit: insert su `appendici_polizza` → chiama RPC `crea_titolo_da_regolazione` → toast con link al nuovo titolo RG.

**`ImmissionePolizzaPage.tsx`** — rimuovere il ramo `mode=regolazione` (banner amber riepilogo, query `polizzaMadre`, logica pre-fill da quietanza). La pagina torna a gestire solo emissione/rinnovo.

**`AppendiciPolizzaPage.tsx`** — rimuovere il bottone "Apri form regolazione" del footer; usare lo stesso flusso del dialog (oppure linkare direttamente al dialog).

**`TitoloDetail.tsx`** — il record RG mostra badge "Regolazione" + link "← Quietanza di riferimento" verso il titolo Q2; sezione Importi e azioni cassa/provvigioni funzionano già senza modifiche.

---

## Aggiornamenti memoria

- `mem://insurance/policy-storno-regolazione-rules.md` — riscrivere la sezione Regolazione: non più "riusa ImmissionePolizzaPage" ma "Appendice tipo=regolazione → genera titolo RG via RPC, agganciato alla quietanza scelta".
- Aggiornare `mem://index.md` di conseguenza.
