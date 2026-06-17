In `src/pages/ImmissionePolizzaPage.tsx` (intorno alle righe 1797-1810), nel blocco "Tipo Operazione", rimuovere dalle opzioni radio le voci:

- `{ value: "cp_nuova", label: "CP (Nuova)" }`
- `{ value: "cp_sost_rinn", label: "CP (Sost/Rinn)" }`

Restano visibili solo: **Polizza**, **Emittenda** e il flag separato **Polizza Auto**.

Nessuna modifica al type union né alla logica di salvataggio: i valori restano supportati a livello dati (per compatibilità con record esistenti), semplicemente non più selezionabili dalla UI in fase di immissione.