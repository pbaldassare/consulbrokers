
## Domanda dell'utente

Vuole sapere cosa succede quando sospende una polizza:
1. Effetti nel database (quali tabelle/campi vengono modificati)
2. Effetti pratici (cosa cambia nell'app, nelle viste, nei calcoli)

Questa è una domanda di **ricerca/spiegazione**, non un task di implementazione. Indago il codice per dare una risposta precisa e poi rispondo direttamente (senza piano di build).

## Esplorazione necessaria

1. Leggere `src/pages/SospensionePolizzaPage.tsx` per vedere la logica di sospensione
2. Verificare la memoria `mem://insurance/policy-lifecycle-operations` (già nota: stati sospeso/attivo)
3. Verificare la memoria `mem://insurance/policy-states` (stati ammessi)
4. Cercare riferimenti a `stato = 'sospeso'` nelle viste portafoglio e nei filtri
5. Verificare schema `titoli` e `titoli_movimenti` (lifecycle 1:N)
6. Controllare se ci sono trigger DB su sospensione

## Output atteso

Risposta testuale strutturata in due parti:
- **DB**: tabelle aggiornate, campi modificati, eventuale movimento creato, log timeline
- **Pratici**: visibilità nel portafoglio (Attive/Storico), incassi bloccati, scadenze sospese, notifiche, possibilità riattivazione
