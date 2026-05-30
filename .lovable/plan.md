## Aggiornamento RESEND_API_KEY

Aggiorno il secret `RESEND_API_KEY` in Lovable Cloud con il nuovo valore fornito (`re_YuyXKLXA_...`).

**Nota di sicurezza**: hai condiviso la chiave in chat. Ti consiglio di **rigenerarla subito su resend.com** dopo l'aggiornamento, perché ora è esposta nello storico della conversazione.

### Passi
1. Aggiorno il secret `RESEND_API_KEY` tramite il tool sicuro (non richiede di reincollarla, userò il valore fornito).
2. Le edge functions che la usano (`send-email`, `check-resend-domain`, `notifica-messa-cassa-agenzia`) la leggeranno automaticamente al prossimo invoke — nessun redeploy necessario.
3. Test rapido: chiamata a `check-resend-domain` per verificare che la nuova chiave sia valida e listare i domini verificati.

### Fuori scopo
- Verifica dominio `consulbrokers.it` su Resend (da fare separatamente)
- Modifica del `from` in `send-email` (resta `onboarding@resend.dev` finché non verifichi un dominio)

Confermi di procedere?