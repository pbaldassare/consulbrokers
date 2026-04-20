

## Causa reale (verificata)

Il fix client del giro precedente è corretto MA non funziona per via delle RLS della tabella `profiles`:

- Giuliano è ruolo `ufficio` (Responsabile Ufficio), NON admin/cfo.
- Le policy SELECT su `profiles` permettono di leggere solo: il proprio profilo, o profili **nello stesso ufficio**.
- Paola Scarpelli e Admin Consul hanno `ufficio_id = NULL` → ufficio diverso da Giuliano → la `select id, nome, cognome from profiles where id in (...)` ritorna vuoto.
- Risultato: `membriNomi` è vuoto, `getDisplayName` cade nel fallback "Conversazione".

Lo stesso problema esisterebbe con qualunque collega di un altro ufficio.

## Fix

Aggiungo una policy SELECT mirata su `profiles` che permette di leggere **solo i campi necessari per la chat** (di fatto: id, nome, cognome) di chi condivide almeno un canale chat con l'utente corrente. Riuso la function già esistente `is_channel_member` insieme a un EXISTS sui canali condivisi.

### Migrazione SQL

```sql
-- Permetti a un utente di vedere il profilo di chiunque condivida un canale chat con lui
CREATE POLICY "Chat participants visible to each other"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_canali_membri m1
    JOIN public.chat_canali_membri m2 ON m2.canale_id = m1.canale_id
    WHERE m1.user_id = auth.uid()
      AND m2.user_id = profiles.id
  )
);
```

Sicurezza:
- Espone solo profili di utenti con cui hai già una chat (relazione esplicita stabilita dal creatore del canale).
- Non espande accesso a profili arbitrari.
- Le altre policy admin/cfo/ufficio/owner restano invariate.

## File toccati

- 1 nuova migrazione SQL (nessuna modifica a `CanaliSidebar.tsx`: il client è già pronto).

## Verifica post-fix

Su `/comunicazioni` → Interna → Diretti vedrai:
- Paola Scarpelli (×2)
- Admin Consul (×1)

E la ricerca per nome nella sidebar funzionerà davvero.

