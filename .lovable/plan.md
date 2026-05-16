## Ho capito così — confermami con 2 esempi

Un **Broker** o una **Plurimandataria** (es. *Etisicura S.r.l.*) non lavora con una sola compagnia: ha **N rapporti** in essere, ciascuno dei quali è un "contratto di collaborazione" con una specifica **Compagnia Assicurativa** e con una **specifica sede/agenzia** di quella compagnia, con il proprio IBAN.

Ogni rapporto è quindi un'entità autonoma con:

1. **Nome del rapporto** (etichetta libera, es. *"Nobis – Agenzia Torino Centro"*)
2. **Tipologia** (Mandato diretto / Agenzia / Direzione / Broker / Sub-agenzia / Coverholder / Convenzione)
3. **Compagnia Assicurativa** di riferimento (gruppo madre, es. *Nobis Assicurazioni*)
4. **Sede operativa del rapporto** (denominazione agenzia + indirizzo, CAP, città, provincia — es. *"Agenzia Nobis Torino – Via Moncalieri 12, 10133 Torino TO"*)
5. **Conto bancario dedicato** (IBAN su cui transita la liquidità di quel rapporto)
6. **Referente in compagnia** (nome / email / telefono — già presente)
7. Codice rapporto, rami abilitati, date inizio/fine, % provvigione, note (già presenti)

---

### Esempio 1 — Broker "Etisicura S.r.l."

| Campo | Rapporto A | Rapporto B |
|---|---|---|
| Nome rapporto | Nobis – Agenzia Torino Centro | Generali – Direzione Milano |
| Tipologia | Agenzia | Mandato diretto |
| Compagnia | Nobis Assicurazioni | Generali Italia |
| Sede del rapporto | Via Moncalieri 12, 10133 Torino TO | Piazza Cordusio 2, 20123 Milano MI |
| IBAN dedicato | IT60 X054 2811 1010 0000 0123 456 | IT12 A030 6909 6061 0000 0000 789 |
| Referente | Marco Rossi · m.rossi@nobis.it · 011-555123 | Laura Bianchi · l.bianchi@generali.it |
| Rami abilitati | RCA, Property | Vita, Infortuni |
| % Provv. | 15% | 12,5% |

→ Quando emetto una polizza Nobis per un cliente di Etisicura, il sistema sa che l'IBAN per il versamento premi è quello di **Torino**, non quello di Milano.

### Esempio 2 — Plurimandataria "Assicura Insieme Snc"

| Campo | Rapporto A | Rapporto B | Rapporto C |
|---|---|---|---|
| Nome rapporto | UnipolSai – Mandato Bologna | Allianz – Sub-agenzia Modena | Cattolica – Conv. broker |
| Tipologia | Mandato principale | Sub-agenzia | Convenzione broker |
| Compagnia | UnipolSai | Allianz | Cattolica |
| Sede | Via Indipendenza 8, 40121 BO | Corso Canalgrande 33, 41121 MO | Lungadige Cangrande 16, 37126 VR |
| IBAN dedicato | IT… UnipolSai BO | IT… Allianz MO | IT… Cattolica VR |

---

## Cosa propongo di costruire

### 1. Schema DB — `compagnia_rapporti` (campi nuovi)

```text
nome_rapporto        text            -- etichetta libera mostrata in tabella e select
sede_denominazione   text            -- es. "Agenzia Torino Centro"
sede_indirizzo       text
sede_cap             text
sede_citta           text
sede_provincia       text(2)
```

(Restano invariati: `gruppo_compagnia_id`, `tipo_rapporto`, `conto_bancario_id`, `codice_rapporto`, `rami_abilitati`, date, `percentuale_provvigione`, referente, note, `attivo`.)

### 2. Tipologia rapporto — estendo la lista

Oggi: *Mandato diretto · Mandato principale · Sub-agenzia · Convenzione broker · Coverholder · Altro*
Aggiungo: ***Agenzia · Direzione · Broker***.

### 3. UI — `RapportiCompagniaDialog.tsx`

- In testa al form: nuovo campo **Nome del rapporto** (obbligatorio, identificativo umano).
- Nuovo blocco **Sede del rapporto** (denominazione + AddressAutocomplete che popola indirizzo/CAP/città/provincia).
- Tabella: prima colonna diventa **Nome rapporto** (con sotto, piccolo, la compagnia); aggiunta colonna **Sede** (città + provincia) e colonna **IBAN** (ultime 4 cifre del conto collegato).
- Il conto bancario dedicato resta come oggi (select con tipi `agenzia` / `generico`); se vuoto, fallback all'IBAN dell'agenzia madre.

### 4. Validazioni

- `nome_rapporto` obbligatorio.
- `gruppo_compagnia_id` obbligatorio (già oggi).
- Se `sede_indirizzo` è valorizzato, `sede_citta` e `sede_provincia` diventano obbligatori.
- Nessun unique su `(compagnia_id, gruppo_compagnia_id)`: si possono avere più rapporti con la stessa compagnia ma su sedi diverse (è esattamente il caso d'uso).

### 5. Impatto altrove

- I conteggi e badge in `CompagnieList` (tab Plurimandataria/Broker) continuano a leggere `compagnia_rapporti.count`: nessuna modifica necessaria.
- L'IBAN proposto per i versamenti di una polizza intermediata da broker/plurimandataria dovrà, in un secondo step, risolversi prima dal `conto_bancario_id` del rapporto, poi dal conto dell'agenzia madre. Lo segnalo ma non lo tocco in questa iterazione (richiede ragionare su dove la polizza dichiara "quale rapporto" sta usando).

---

**Confermi che ho interpretato bene?** In particolare:

- Va bene "Nome del rapporto" come etichetta libera, o preferisci derivarlo automaticamente da *"{Compagnia} – {Città sede}"*?
- La **Sede del rapporto** è sempre la sede *della compagnia partner* (agenzia Nobis Torino), giusto? Non una sede del broker.
- Tipologia: tieni l'elenco esteso che ho proposto o vuoi un set diverso?

Appena confermi, procedo con migration + UI in un colpo solo.