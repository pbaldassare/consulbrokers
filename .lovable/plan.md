## Obiettivo
Uniformare la gestione documenti del portale cliente: **anteprima** disponibile su TUTTI i documenti, **eliminazione con popup di conferma** solo sui documenti caricati dal cliente stesso (`caricato_da_cliente = true`), come richiesto.

## Stato attuale
- `ClienteDocumenti.tsx` e `ClientePolizzaDetail.tsx` → preview ✅ + delete ✅ (già con AlertDialog di conferma) — OK.
- `SinistroDocumentiCliente.tsx` (usato in `/cliente/sinistri` dentro le card sinistro) → solo download. **Manca preview e delete.**

## Modifiche

### 1. `src/components/cliente/SinistroDocumentiCliente.tsx`
Allineare al pattern di `ClientePolizzaDetail`:
- Aggiungere stato `previewDoc` e `deleteDoc`.
- Per ogni doc mostrare tre azioni: 👁 Anteprima · ⬇ Scarica · 🗑 Elimina (solo se `caricato_da_cliente`).
- Anteprima tramite `DocPreviewDialog` (componente già esistente).
- Eliminazione con `AlertDialog` di conferma ("Eliminare il documento? Operazione irreversibile") che rimuove file da storage (`documenti_sinistri`) e riga da `documenti`, poi `toast.success` e refresh lista.
- Conservare upload esistente.

### 2. Verifica RLS
Le policy DELETE su `documenti` e sul bucket `documenti_sinistri` per il ruolo cliente (limitate a `caricato_da_cliente=true` e path `{cliente_id}/...`) sono già state create nella migration precedente — nessuna nuova migration necessaria.

## Out of scope
- Eliminazione di documenti caricati dall'agenzia (richiederebbe workflow di approvazione).
- Modifiche a `ClienteDocumenti` e `ClientePolizzaDetail` (già conformi).

## File toccati
- `src/components/cliente/SinistroDocumentiCliente.tsx` (riscrittura sezione lista doc + dialog conferma).
