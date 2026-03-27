

## Piano: Svuotare Napoli e rinominare Specialist → Backoffice

### Situazione attuale
- **1187 clienti** assegnati ad "Agenzia Napoli"
- L'utente **backoffice@consul.it** esiste gia con ruolo `backoffice`
- Il campo/label "Specialist" appare in 4 file come etichetta UI (non e un ruolo utente, e un campo nella tabella `titoli`)

### Operazioni

**1. Redistribuire i 1187 clienti di Napoli nelle altre 4 sedi**

Distribuzione proporzionale via UPDATE SQL (usando il tool insert/update):
- Sede Centrale Roma: ~300 clienti
- Filiale Milano: ~300 clienti  
- Filiale Firenze: ~300 clienti
- Punto Vendita Bologna: ~287 clienti

Eseguito con query UPDATE + ROW_NUMBER() per distribuire equamente.

**2. Rinominare "Specialist" → "Backoffice" nelle UI**

File da modificare:
- `src/pages/ImmissionePolizzaPage.tsx` — label "Specialist" → "Backoffice", variabile `specialist`
- `src/pages/RinnoviPolizzaPage.tsx` — label "Specialist" → "Backoffice", option text
- `src/pages/TitoloDetail.tsx` — FieldRow label "Specialist" → "Backoffice"
- `src/pages/contabilita/ECClientiContabPage.tsx` — label "Specialista (A/E)" → "Backoffice" (se pertinente)

Il campo `specialist` nella tabella `titoli` resta invariato (cambio solo cosmetico lato UI).

### Nessuna migrazione DB
- Lo spostamento clienti e un UPDATE dati (tool insert)
- Le label sono solo modifiche UI
- L'utente backoffice esiste gia

