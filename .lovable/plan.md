## Obiettivo

Nella pagina **E/C Agenzia PDF** (`/contabilita/ec-agenzia/pdf`) precompilare la sezione "Sede Mittente (intestazione)" con la **Sede dei titoli inclusi** invece della sede Napoli forzata.

## Logica

In `src/pages/contabilita/ECAgenziaPdfPage.tsx`:

1. Aggiungere `ufficio_id` al SELECT della query `titoli`.
2. Sostituire la query `ec-pdf-sede-napoli` con una nuova query `ec-pdf-sede-titoli` che:
   - parte dai `titoli` caricati,
   - conta le occorrenze di `ufficio_id`,
   - sceglie l'`ufficio_id` più frequente (in caso di parità, il primo),
   - se nessun titolo ha `ufficio_id`, fallback alla sede Napoli (per non lasciare l'intestazione vuota).
3. Carica i dati dell'ufficio scelto da `uffici` (stessi campi: `nome_ufficio, indirizzo, cap, citta, provincia, email, telefono`).
4. L'`useEffect` di pre-popolamento e il dropdown manuale "Carica dati da una Sede esistente" restano invariati: l'utente può sempre sovrascrivere.

## Memoria

Aggiornare `mem://accounting/rimessa-mittente-napoli` per riflettere che la sede default ora è quella dei titoli (Napoli resta solo come fallback).

## File toccati

- `src/pages/contabilita/ECAgenziaPdfPage.tsx`
- `.lovable/memory/accounting/rimessa-mittente-napoli.md`