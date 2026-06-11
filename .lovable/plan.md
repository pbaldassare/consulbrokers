## Spostare "Inserimento manuale" in alto come tab/azione che apre un popup

### Cosa cambia in `CaricamentoMovBancariPage.tsx`

1. **Rimuovere la card laterale** `InserimentoManualeCard` dal layout della tab Monitor Real-time. La tabella Monitor torna a piena larghezza (niente più grid `1fr_320px`).

2. **Aggiungere un bottone "+ Inserimento manuale"** in alto, in linea con le tab `Importazione | Revisione | Monitor Real-time`, sulla destra della `TabsList`. Stile coerente (outline, icona `Plus`, stesso colore primario).

3. **Trasformare la card esistente in un Dialog** (`@/components/ui/dialog`) che si apre al click del bottone. Il contenuto del dialog è identico alla card attuale: Cliente (SearchableSelect obbligatorio), Data, Importo, Ordinante, Descrizione, Note, con la validazione inline già implementata (errori rossi sotto i campi, warning se cliente senza sede).

4. **Flusso invariato al salvataggio**: il movimento viene creato con `stato='matchato'`, `cliente_id` e `ufficio_id` (derivato dal cliente). Dopo il salvataggio: toast di successo, chiusura del dialog, reset del form, refresh della query `mov-bancari`.

5. Il bottone resta visibile e cliccabile in tutte e tre le tab (Importazione, Revisione, Monitor) — è un'azione globale della pagina, non legata alla tab attiva.

### Layout risultante

```text
[Importazione] [Revisione] [Monitor Real-time]            [+ Inserimento manuale]
─────────────────────────────────────────────────────────────────────────────
(contenuto della tab attiva, a piena larghezza)
```

Al click su "+ Inserimento manuale" → si apre un Dialog centrato con il form.

### File toccati
- `src/pages/contabilita/CaricamentoMovBancariPage.tsx` (unico file).

Nessuna modifica a edge function, DB o altre pagine.
