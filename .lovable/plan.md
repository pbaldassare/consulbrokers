# Incassi e Coperture — Anteprima / Stampa / Salva PDF

Allinea la pagina `/contabilita` (componente `ContabilitaUfficio`) al pattern già usato in `ECAgenziaPdfPage`: tre bottoni in alto a destra + dialog di anteprima.

## Cosa contiene il PDF

Header riepilogo (mese selezionato + filtro agenzia se attivo) e poi:
- KPI riga: Titoli a Cassa, Premio Lordo, Provvigioni, Da Rimettere
- Tabella "Riepilogo Messa a Cassa" raggruppata per Agenzia con totali
- Per ogni agenzia, dettaglio titoli (numero, cliente, premio, provvigioni, netto, tipo pagamento, tipo incasso)
- Footer con totali generali

## File da creare

**`src/lib/incassi-coperture-pdf.ts`** — generatore PDF con `pdf-lib`, stessa impostazione visiva di `ec-agenzia-pdf.ts` (A4, font Helvetica, palette teal/headerBg, righe alternate). Espone:
```ts
buildIncassiCoperturePdf(data: IncassiCopertureData): Promise<Uint8Array>
```
con `IncassiCopertureData` = `{ meseLabel, sedeNome, gruppi: GruppoCompagnia[], totali, generatoIl }`.

## Modifiche a `src/pages/ContabilitaUfficio.tsx`

- Stato `busy`, `previewBytes`.
- Funzioni `handleAnteprima` / `handleStampa` / `handleSalva` copiate dal pattern di `ECAgenziaPdfPage` (download locale + upload su `documenti_generali`).
- `handleSalva`: archivia su bucket `documenti_generali` con `entita_tipo='sede'` e `entita_id = profile.ufficio_id` (categoria `Incassi e Coperture`); se l'utente non ha sede assegnata fallback a solo download. Log via `logAttivita`.
- `nomeFile` = `Incassi_Coperture_<YYYY-MM>.pdf`.
- Toolbar in alto: a destra del titolo aggiungo `[Anteprima] [Stampa] [Salva PDF]` (Button `outline/outline/default`).
- Dialog `<PdfPreview data={previewBytes} />` come in `ECAgenziaPdfPage`.

## Out of scope
- Nessuna modifica DB.
- Nessuna modifica al calcolo dei dati: il PDF usa lo stesso `filtered` e `totaliCassa` già in pagina.
