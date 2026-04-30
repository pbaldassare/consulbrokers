# Anteprima + Stampa + Salvataggio PDF Precontrattuale

## Obiettivo
Nella pagina **Documentazione Precontrattuale**, dopo che l'utente compila / verifica i dati pre-popolati, deve poter:
1. **Vedere l'anteprima** del PDF dentro l'app (modale).
2. **Stampare** il documento (apre il dialog di stampa del browser sul PDF).
3. **Salvare** il PDF su disco (download) e su **Archivio Documentale** del cliente (storage Supabase + record in `documenti`).

Il layout del PDF deve essere **identico** al modello caricato (`DOCUMENTAZIONE_PRECONTRATTUALE_1.pdf`, 7 pagine):
- Pag. 1–3: Informativa Privacy GDPR (testo fisso, intestazione CONSULBROKERS)
- Pag. 3 fondo: dati anagrafici cliente (CF, P.IVA, Residenza) + riga firma
- Pag. 4: Consensi facoltativi (Profilazione / Marketing) con caselle ACCONSENTO / NON ACCONSENTO
- Pag. 5–7: **Modulo Unico Precontrattuale (MUP)** — Sezioni I–VIII con dati Cliente + Polizza + Intermediario (Specialist + Sede)

## Cosa cambia in UI

In fondo alla pagina, sostituire il singolo bottone "Conferma" con **3 bottoni**:

```
[ Chiudi ]                       [ Anteprima ]  [ Stampa ]  [ Salva PDF ]
```

- **Anteprima**: apre un `Dialog` a tutto schermo con un `<iframe>` che mostra il PDF generato in memoria (blob URL).
- **Stampa**: genera il PDF, lo apre in nuova finestra e chiama `window.print()`.
- **Salva PDF**: genera il PDF, scarica il file in locale **e** lo carica su Supabase Storage (bucket `documenti`) collegandolo al cliente con una riga in `documenti` (tipo: "Precontrattuale").

## Generazione PDF (lato client)

Aggiungere libreria **`pdf-lib`** (puro JS, niente headless browser, file leggero).
Motivo: serve un layout fisso, replica del modello — non HTML→PDF (che cambia rendering tra browser).

File nuovo: `src/lib/precontrattuale-pdf.ts`
- Funzione `buildPrecontrattualePdf(data: PrecontrattualeData): Promise<Uint8Array>`
- Pagine A4 (595×842 pt), font standard Helvetica/Helvetica-Bold (built-in pdf-lib).
- Helpers per:
  - intestazione "INFORMATIVA RELATIVA AL TRATTAMENTO DEI DATI PERSONALI…"
  - tabella finalità trattamento (testo a sinistra, base giuridica/conservazione a destra)
  - blocco firma con linee `Data, luogo ___` / `Timbro, firma ___`
  - check-box ACCONSENTO / NON ACCONSENTO (riquadri vuoti)
  - sezioni MUP I–VIII con titoli su sfondo grigio chiaro

I **dati dinamici** che vengono iniettati nel PDF:
- **Cliente**: nome/ragione sociale, CF, P.IVA, indirizzo+CAP+città+prov
- **Polizza**: numero polizza, riferimento, compagnia (testo libero — ora è vuoto)
- **Intermediario "che entra in contatto"** (Specialist):
  - Nome+Cognome (o `nome_rui`), Sezione/Numero/Data RUI, telefono, email, indirizzo Sede
- **Attività svolta per conto di**: blocco fisso CONSULBROKERS S.p.A. (Sez. B, B000778092, 23/04/2025, Corso di Porta Nuova 16 Milano, ecc.)
- **Sezione II**: testo dalla scelta `modelloDistribuzione` + flag collaborazione
- **Sezione IV**: testo della radio `sezioneII`
- **Sezione V**: testo `tipoRemunerazione` (importi commissioni lasciati vuoti finché non c'è una polizza collegata)
- **Sezione VI**: testo `sezioneIV` + flag pagamento non liberatorio

Tutto il testo "fisso" (privacy, sezioni VII–VIII, ecc.) viene messo in costanti dentro lo stesso file `precontrattuale-pdf.ts`.

## Salvataggio su Archivio Documentale

In `handleSavePdf`:
1. Genera `Uint8Array` con `buildPrecontrattualePdf`.
2. Nome file: `Precontrattuale_<COGNOME>_<YYYY-MM-DD>.pdf`.
3. Upload su `supabase.storage.from('documenti').upload(path, blob)` con path `clienti/<clienteId>/precontrattuale/<filename>`.
4. Insert in tabella `documenti` (verifico lo schema esatto in implementazione) con:
   - `cliente_id`, `nome_file`, `tipo_documento` = "Precontrattuale", `path_storage`, `created_by`.
5. Toast "Documento salvato in Archivio Documentale" + trigger download locale.

Se l'utente non è arrivato dalla pagina cliente (`clienteIdParam` mancante), l'upload viene saltato e si fa solo download.

## File coinvolti

- **Nuovo** `src/lib/precontrattuale-pdf.ts` — generazione PDF con pdf-lib.
- **Mod.** `src/pages/DocPrecontrattualePage.tsx` — bottoni Anteprima/Stampa/Salva, modale anteprima, handlers.
- **Dep.** `pdf-lib` aggiunta al `package.json`.
- `public/version.json` bump.

## QA prima di consegnare

Dopo l'implementazione genero un PDF di esempio con dati finti, lo apro come immagini con `pdftoppm` e confronto pagina per pagina con il modello caricato per verificare:
- intestazioni, ordine sezioni, numerazione
- tabelle privacy con colonne allineate
- blocchi firma su tutte le pagine richieste
- box consensi
- sezione MUP con dati cliente/intermediario corretti
