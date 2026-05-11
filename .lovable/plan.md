## Obiettivo

Rendere la pagina **Nuova Emissione Polizza** (`ImmissionePolizzaPage.tsx`) graficamente identica alla pagina **Polizza esistente** (`TitoloDetail.tsx`), così l'utente vede lo stesso layout sia in inserimento sia in modifica. Solo restyle: nessun cambio di logica/salvataggio.

## Differenze attuali

| Elemento | TitoloDetail (esistenti) | ImmissionePolizzaPage (nuovo) |
|---|---|---|
| Wrapper sezioni | `SectionCollapsible` (teal, **con icona**) | `PolizzaSection` (teal, **senza icona** sui blocchi principali) |
| Sezione Importi | 2 card `VociRcaCard` "Premi per Garanzia — Firma" / "— Quietanza" (per RCA) + blocco Importi standard per altri rami | Tabella semplice Firma / Pros. Quietanza |
| Pulsante "Importa con AI" | Presente in Importi (solo RCA) | Assente |
| Sezioni e ordine | Contratto → Periodo → Regolazione → Commerciale & Provvigioni → Importi → … → Dati Veicolo / Premi per Garanzia / Conducente | Cliente & Sede → Contratto → Periodo → Regolazione → Importi → Provvigioni → Tipo → Dati Veicolo / Dati Premio per Garanzia / Conducente |
| Icone sui titoli | Sì (FileText, Calendar, Shield, Percent, DollarSign, Car, ShieldCheck, UserCheck…) | Solo le sezioni RCA hanno l'icona |

## 1. Allineare il wrapper di sezione

`PolizzaSection` ha **già** lo stesso stile visivo di `SectionCollapsible` (border-l teal, header teal, chevron). Differenza: in immissione manca solo l'icona sulla maggior parte dei titoli.

→ Aggiungere il prop `icon` a tutte le `<PolizzaSection>` di `ImmissionePolizzaPage` con le stesse icone usate in TitoloDetail:

```text
Cliente & Sede           → Users
Contratto                → FileText
Periodo                  → Calendar
Regolazione              → Shield (defaultOpen={false} come in TitoloDetail)
Importi                  → DollarSign
Provvigioni              → Percent
Tipo                     → Tag
Dati Veicolo             → Car        (già presente)
Dati Premio per Garanzia → ShieldCheck (rinominare titolo in "Premi per Garanzia")
Dati Conducente          → UserCheck   (già Car? sostituire)
```

## 2. Sostituire la tabella Importi con le card "Premi per Garanzia"

Nella sezione **Importi** della nuova immissione, riprodurre lo stesso layout di TitoloDetail:

- Per **rami RCA / Natanti** (`isRamoAuto(ramo)`): mostrare **due card affiancate** stile `VociRcaCard` — "Premi per Garanzia — Firma" (teal) e "Premi per Garanzia — Quietanza" (amber), con tabella voci, totali (Totale Netto / Totale Tasse / Addizionali / Premio Lordo) e riga "Provvigioni Firma/Quietanza".
- Per **altri rami**: mantenere l'attuale tabella Firma / Pros. Quietanza ma racchiusa in card con lo stesso stile visivo (header verde "Premi per Garanzia — Firma" / "— Quietanza", totali in fondo come in TitoloDetail).

**Nota workflow**: `VociRcaCard` reale richiede `titoloId` (persiste su `premi_garanzia_polizza`). In immissione il titolo non esiste ancora → in questo step **solo grafica**: creare un componente "shell" `PremiGaranziaCardShell` che riproduce **header, layout, totali, footer Provvigioni** della VociRcaCard ma lavora su state locale (le righe Firma/Quietanza correnti). Il salvataggio resta quello attuale (`titoli.premio_netto`, `tasse`, `premio_lordo`, `provvigioni_firma`, ecc.). La gestione voci-per-garanzia in immissione viene affrontata in un secondo step ("poi passiamo a mettere a posto il resto").

## 3. Sezione "Premi per Garanzia" RCA

L'attuale "Dati Premio per Garanzia" (riga 1193-1226) viene **rinominata** "Premi per Garanzia" con icona `ShieldCheck`, identica a TitoloDetail. Il contenuto resta quello attuale (sarà sostituito dalle card vere in un passo successivo).

## 4. Pulsante "Importa con AI"

Aggiungere `<ImportPolizzaAiButton>` nell'header della sezione Importi (slot `headerExtra` di `PolizzaSection`) **solo per rami RCA/Natanti**, come in TitoloDetail. In immissione il bottone popola gli state locali del form (premi, voci) — la logica di binding è già presente nel componente; va solo passata la callback giusta. Se la callback richiede troppo lavoro in questo step, il bottone può essere lasciato disabilitato con tooltip "disponibile dopo il primo salvataggio" — decisione minima per restare in ambito grafico.

## 5. File toccati

```text
EDIT: src/pages/ImmissionePolizzaPage.tsx
       - import icone (Users, FileText, Calendar, Shield, DollarSign, Percent, Tag, ShieldCheck, UserCheck)
       - aggiungere icon={…} a tutte le PolizzaSection
       - Regolazione: defaultOpen={false}
       - rinominare sezione "Dati Premio per Garanzia" → "Premi per Garanzia"
       - sostituire tabella Importi con <PremiGaranziaCardShell tipoPremio="firma"/"quietanza" />

NEW:  src/components/polizze/PremiGaranziaCardShell.tsx
       - replica visiva di VociRcaCard (header teal/amber, tabella voci, totali, footer Provvigioni)
       - alimentata da props (premioNetto, addizionali, tasse, provvigioni…) e callback onChange
       - usata SOLO in immissione finché non si introduce la persistenza voci pre-titolo
```

## 6. Fuori scopo (prossimo step)

- Persistenza vera delle voci `premi_garanzia_polizza` in fase di immissione (richiede creazione titolo bozza o salvataggio in batch).
- Card "Commerciale & Provvigioni", "Sostituzioni / Storni", "Dettaglio Riparto", "Dettaglio Movimenti" (esistono solo a polizza creata).
- Refactor del salvataggio.

## QA

1. Apri "Nuova Emissione" → tutte le sezioni hanno header teal con icona, identico a una polizza esistente.
2. Sezione Importi: scegli ramo RCA → vedi due card "Premi per Garanzia — Firma/Quietanza" come in TitoloDetail; scegli ramo non-RCA → vedi le stesse card ma con la riga unica Firma/Quietanza, sempre stile teal/amber.
3. Regolazione parte chiusa, espandibile.
4. Salvataggio finale invariato: titolo creato con gli stessi campi di prima.
