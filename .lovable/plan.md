## Obiettivo
Permettere al cliente, se nessuno dei tipi predefiniti è adatto, di aprire un **sinistro personalizzato** descrivendo a parole il tipo. Il dato viene salvato e gestito anche dall'admin.

## 1. Database — nuova colonna
Migrazione su `sinistri`:
```sql
ALTER TABLE public.sinistri
  ADD COLUMN tipo_sinistro_personalizzato text;
```
Nessuna policy nuova: eredita le RLS esistenti di `sinistri`.

## 2. Frontend cliente — `NuovaDenunciaSinistroDialog.tsx`
- Aggiungere checkbox **"Tipo di sinistro non in elenco — descrivilo"** sopra il campo "Tipo di sinistro".
- Quando attivo:
  - nasconde il `SearchableSelect` dei tipi predefiniti
  - mostra un `Input` "Descrivi il tipo di sinistro" (es. *"Danno da grandine al tetto del comune"*)
  - `tipoSinistro` non è più obbligatorio; obbligatorio diventa il campo personalizzato (min 3 char)
- Validazione `canSubmit`:
  - se personalizzato → `tipo_sinistro_personalizzato.trim().length >= 3 && dataEvento && dinamica >5`
  - altrimenti → comportamento attuale (`tipoSinistro && dataEvento && dinamica >5`)
- Insert su `sinistri`: salva sia `tipo_sinistro` (null se personalizzato) sia `tipo_sinistro_personalizzato`.
- `showTarga` resta legato al tipo predefinito (un personalizzato non è veicolo).

## 3. Lato admin — visualizzazione
- `src/lib/tipiSinistro.ts → getTipoSinistroLabel`: non si tocca; aggiungiamo una piccola util **`formatTipoSinistro(s)`** che ritorna:
  - `tipo_sinistro_personalizzato` se valorizzato (con prefisso badge "Personalizzato:" davanti al testo)
  - altrimenti `getTipoSinistroLabel(tipo_sinistro)`.
- Aggiornare:
  - `SinistriList.tsx` colonna "Tipo" → usa `formatTipoSinistro(s)`.
  - `SinistroDetail.tsx` header → stesso.
- In `SinistroDetail.tsx` aggiungere campo **modificabile** "Tipo personalizzato" nella sezione anagrafica sinistro (visibile solo se valorizzato o se `tipo_sinistro` è null), così admin può correggerlo/riclassificarlo. Salvataggio via update standard su `sinistri`.

## 4. Wizard admin (`SinistriList.tsx` dialog "Nuovo Sinistro")
Estendere allo stesso modo (checkbox + campo libero) per coerenza: anche da admin si può aprire un sinistro personalizzato. Il payload passa `tipo_sinistro_personalizzato` all'edge function `gestione-sinistri`.

## 5. Edge function `gestione-sinistri`
Aggiungere `tipo_sinistro_personalizzato: z.string().optional().nullable()` allo schema input azione `crea`; passare al record `sinistri`. `tipo_sinistro` resta opzionale (già lo è).

## 6. Verifica
- Da `/cliente/sinistri`: aprire dialog → flag "personalizzato" → compilare descrizione + data + dinamica → invio → record creato con `tipo_sinistro=null` e `tipo_sinistro_personalizzato` valorizzato.
- Da `/sinistri` admin: la riga mostra "Personalizzato: …"; aprendo il dettaglio si vede e si può modificare.

## Fuori scope
- Nessun cambio a checklist/eventi: i trigger esistenti continuano a popolare default.
- Nessuna catalogazione storica dei tipi personalizzati (eventuale step futuro: promozione a tipo predefinito).
