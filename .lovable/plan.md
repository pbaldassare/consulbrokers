

## Piano: Spostare "Area Riservata" nell'header accanto ai badge

### Cosa cambia

La card `AreaRiservataCard` viene rimossa dal fondo del tab Anagrafica e il suo pulsante/badge viene integrato nell'header del ClienteDetail (riga 1070-1097), accanto al badge "Attivo/Disattivo" e al badge "Portale".

### Modifiche in `src/pages/ClienteDetail.tsx`

**1. Header (riga ~1081-1088)** — Aggiungere un pulsante "Attiva Area Riservata" (se `area_riservata_tipo === 'nessuna'` o assente) oppure mostrare il badge portale + un dropdown/pulsante per gestire (modifica tipo / disattiva). Il click apre lo stesso Dialog con anteprima email e select tipo accesso.

**2. Rimuovere `<AreaRiservataCard>` dal tab Anagrafica** (riga ~1370) — Non serve più in basso.

**3. Il Dialog resta identico** — Anteprima email, select tipo, pulsanti Invia e Attiva / Modifica / Disattiva. Viene solo spostato il trigger nell'header.

### Layout header risultante

```text
[← ] Nome Cliente                    [Attivo] [Portale: Sola Lettura] [Attiva Area Riservata] [Modifica]
      Cliente Privato / Azienda
```

- Se portale non attivo: pulsante "Attiva Area Riservata" (verde, con icona Globe)
- Se portale attivo: badge portale + pulsante piccolo "Gestisci Portale" che apre il dialog per modificare tipo o disattivare

