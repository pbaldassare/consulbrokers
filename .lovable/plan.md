## Obiettivo

Nei tab **Account Executive**, **Produttori** e **Resp. Sede** della pagina *Anagrafiche Amministrative* aggiungere:
1. Feedback chiaro su salvataggio modifiche (errori reali, non generici).
2. Toggle **Attivo/Disattivato** direttamente in tabella.
3. Pulsante **Elimina** con conferma e protezione integrità referenziale.

Gli altri due tab restano invariati:
- *Specialist* → già gestito da `SpecialistList` (ha già toggle ed elimina).
- *Sedi* → già gestito da `SediManager`.

---

## 1. Salvataggi modifiche più affidabili

In `src/pages/AnagraficheInternePage.tsx`:
- `createMutation.onError` e `updateMutation.onError`: mostrare il messaggio reale via `toast.error(e.message || "Errore...")` invece del solo "Errore".
- Mantenere la validazione client esistente (Sede obbligatoria per produttori).
- Il bottone "Salva" già si disabilita durante la mutazione: ok.

## 2. Toggle Attivo/Disattivato in tabella (AE, Produttori, Resp. Sede)

Oggi l'ultima colonna mostra solo il badge derivato da `annullato`. Sostituirla con uno **Switch** sul campo `attivo` (booleano già presente sulla tabella `anagrafiche_professionali`) + badge testuale a fianco:

- `attivo = true` → Switch ON, badge "Attivo".
- `attivo = false` → Switch OFF, badge "Disattivato" (riga con `opacity-60`).

Il toggle riusa la `toggleMutation` già definita (`update({ attivo }).eq("id", id)`) e ferma la propagazione del click per non aprire il dialog. Toast di conferma "Stato aggiornato".

Il campo separato `annullato` (usato per AE storici) resta visibile come piccolo badge "A" solo per AE quando `annullato = true`, ma non viene più usato come stato principale di riga.

## 3. Eliminazione anagrafica con conferma + guardia integrità

Aggiungere in fondo al dialog di modifica (solo quando `editingId` è valorizzato) un pulsante **"Elimina"** rosso, allineato a sinistra, separato da Annulla/Salva.

Flusso:
1. Click → AlertDialog di conferma ("Sei sicuro? L'azione è irreversibile.").
2. Pre-check con query: `select count(id) from titoli where produttore_id = :id`. Se > 0 → toast di errore "Impossibile eliminare: l'anagrafica è collegata a N titoli/polizze. Disattivala invece di eliminarla." e si interrompe.
3. Altrimenti `delete from anagrafiche_professionali where id = :id`. Toast successo, chiusura dialog, invalidate query.

Suggerimento UX: nel toast del blocco includere un pulsante "Disattiva ora" che esegue direttamente `toggleMutation.mutate({ id, attivo: false })`.

## 4. Coerenza visiva

- Riga `opacity-60` quando `attivo === false` (oltre al caso `annullato` per AE).
- Filtro ricerca invariato (l'utente vede sia attivi sia disattivati; opzionale: aggiungere checkbox "Mostra solo attivi" — *fuori scope salvo richiesta*).

---

## File coinvolti

- `src/pages/AnagraficheInternePage.tsx` — unico file da modificare:
  - error handler delle mutation,
  - render colonna stato per AE / Corr / RespSede (Switch + badge),
  - nuova `deleteMutation` con pre-check su `titoli.produttore_id`,
  - nuovo `AlertDialog` di conferma e bottone "Elimina" nel `DialogFooter`.

Nessuna nuova migrazione DB necessaria: tutti i campi e le RLS esistono già (`attivo`, FK `titoli.produttore_id`).

## Out of scope

- Soft-delete con tabella di archivio.
- Cascading verso altre entità diverse da `titoli`.
- Filtro "solo attivi" e bulk actions.
- Modifiche ai tab Specialist/Sedi (già hanno proprie azioni).
