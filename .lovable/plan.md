# Eliminazione completa polizza 184667297

## Stato attuale
Due titoli trovati con numero `184667297`:
- `01fbb860-7d18-4ad5-918a-c3cb0d421704` — stato `incassato`, premio 1971,08€, **data_messa_cassa 2026-05-28** (residuo dell'ultima messa a cassa)
- `5ce9667e-136e-4b3c-855f-39ddd7023246` — stato `attivo`, premio 1925,03€, `sostituisce_polizza=184667297` (quietanza successiva)

Riferimenti collegati: 1 `rimessa_dettaglio`, 1 `provvigioni_generate`, 4 `log_attivita`.

## Migration di pulizia (in un singolo DO $$ block)
1. DELETE da `rimessa_dettaglio` per i due titolo_id (rimuove la riga dalla rimessa/estratto conto agenzia)
2. DELETE da `provvigioni_generate` per i due titolo_id (rimuove dall'estratto conto produttore/AE)
3. DELETE da `log_attivita` con `entita_id` nei due titoli
4. DELETE da `titoli` per i due id

Le altre dipendenze (movimenti_contabili, sinistri, documenti, premi per garanzia, split commerciali, snapshot, quietanze isolate, ecc.) vengono pulite via CASCADE.

## Effetti attesi
- Polizza scomparsa da Portafoglio Attive / Storico / Carico
- Riga rimossa da E/C Agenzia, E/C Cliente, E/C Compagnia, E/C Produttore
- Nessuna provvigione residua
- Nessuna voce in Storico Rimesse riferita a questi titoli
