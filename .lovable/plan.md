## Obiettivo

Aggregare i duplicati residui delle compagnie causati da differenze di **maiuscole/minuscole, suffissi societari (SPA, S.p.A., Assicurazioni, S.A., Ltd, …), punteggiatura, asterischi e apostrofi**. Questi varianti non erano stati catturati dalla normalizzazione precedente perché differiscono per più di sole maiuscole.

## Analisi

Dopo il primo dedup (1.374 → 740) restano **35 cluster** con varianti tipografiche, per un totale di **~50 record duplicati** da consolidare. Esempi chiave:

- **ASSIMOCO**: `*ASSIMOCO ASS.NI` (B0736) + `ASSIMOCO SPA` (ASM000)
- **GENERALI ITALIA**: `GENERALI ITALIA SPA` (188 titoli) + `*Generali Italia S.p.a.` (2 titoli)
- **ALLIANZ**: 4 varianti (`ALLIANZ`, `ALLIANZ SPA`, `*Allianz Assicurazioni`, `ALLIANZ S.p.A.`) – 33 titoli totali
- **HELVETIA**: 5 varianti (`HELVETIA`, `HELVETIA SA`, `HELVETIA SPA`, `HELVETIA VITA`, `*Helvetia Assicurazioni`) ⚠️ *vedi nota Vita/Danni sotto*
- **REVO INSURANCE**: 47 titoli su `REVO Insurance S.p.A.` + duplicato `REVO INSURANCE SPA`
- **LLOYD'S**: `LLOYD'S INSURANCE COMPANY S.A.` (33 titoli) + variante con apostrofo curvo `’`
- Altri: AMISSIMA, ARAG, AXA, ARGOGLOBAL, CHUBB, COFACE, D.A.S., ERGO, GROUPAMA, HDI, ITAS, LIGURIA, NOBIS, QBE, REALE MUTUA, TUTELA LEGALE, UNIPOL, UNIPOLSAI, VITTORIA, ecc.

## Regole di clustering proposte (normalizzazione 2° giro)

Due nomi appartengono allo stesso cluster se, **DOPO** queste trasformazioni, risultano identici:

1. UPPER + TRIM + collassa spazi multipli
2. Rimuovi asterischi iniziali (`*`)
3. Sostituisci apostrofi curvi `’` con dritti `'`
4. Rimuovi tutta la punteggiatura (`.`, `,`, `'`, `(`, `)`, `-`, `/`)
5. Rimuovi i suffissi societari finali (anche ripetuti): `SPA`, `S P A`, `SRL`, `S R L`, `SA`, `S A`, `AG`, `PLC`, `LTD`, `LIMITED`, `ASSICURAZIONI`, `ASSICURAZIONE`, `ASSICURATIVA`, `COMPAGNIA`, `INSURANCE`, `MUTUA`, `SOC`, `SOCIETA`, `GROUP`, `GRUPPO`, `ITALIA`
6. Collassa di nuovo spazi

### Eccezioni (NON aggregare)

- **HELVETIA VITA** resta separata da HELVETIA SPA (ramo Vita vs Danni – business diverso)
- **HDI** vs **HDI ASSICURAZIONI**: due gruppi distinti (HDI Global vs HDI Assicurazioni Retail) → mantengo entrambi i cluster ma consolido le varianti **dentro** ciascuno
- **AXA** vs **AXA ASS.NI**: probabile holding vs operativa → mantengo separati (puoi confermare diversamente)
- Tutto ciò che contiene "Div.", "Vita", "Danni", "Global" specifico → resta separato

## Master record per cluster

Stessa regola del primo round: vince il record con **più titoli collegati**; a parità, quello con il nome più "pulito" (senza asterisco iniziale, con suffisso SPA esplicito).

## Steps

1. **Genera PDF di anteprima** `duplicati_compagnie_round2.pdf` con i 35 cluster, master proposto evidenziato e impatto su titoli/sinistri/flussi.
2. **Attesa conferma utente** (puoi escludere singoli cluster prima dell'esecuzione).
3. **Migrazione transazionale**:
   - Snapshot di sicurezza `compagnie_snapshot_round2`
   - Remap FK su: `titoli`, `sinistri`, `prodotti`, `flussi_compagnia`, `provvigioni_compagnia_ramo`, `rimessa_premi`, `dettaglio_riparto`, `document_folders`, `anagrafiche_professionali`, `trattative`
   - DELETE dei record duplicati
4. **Verifica integrità** post-migrazione (conteggi titoli/sinistri invariati) e bump `version.json`.

## Output atteso

- Compagnie: **740 → ~705** (≈35 record eliminati)
- Zero perdita dati: tutti i collegamenti rimappati sui master
- Lista `/compagnie` definitivamente pulita