
## Diagnosi

L'utente è su `/portafoglio/attive` e non vede un pulsante per creare una nuova polizza. Dallo screenshot, la pagina "Polizze Attive" mostra solo: card con conteggio (227), barra ricerca, filtro rami, toggle "Escludi scadenze del mese", e tabella. **Manca un CTA "+ Nuova Polizza"** che porti a `/portafoglio/immissione`.

## Soluzione

Aggiungere un pulsante **"+ Nuova Polizza"** in alto a destra nella pagina `PortafoglioAttivePage.tsx` (e idealmente anche in `PortafoglioCaricoPage` e `PortafoglioStoricoPage` per coerenza), allineato all'header, che fa `navigate("/portafoglio/immissione")`.

## File toccati

- `src/pages/PortafoglioAttivePage.tsx` — aggiunta pulsante CTA nell'header
- (opzionale) `src/pages/PortafoglioCaricoPage.tsx` e `PortafoglioStoricoPage.tsx` — stesso pulsante per coerenza UX

## Dettaglio implementativo

Nell'header della pagina (dove ora c'è solo "Polizze Attive / Polizze in corso di validità") aggiungere a destra:

```tsx
<Button onClick={() => navigate("/portafoglio/immissione")}>
  <Plus className="w-4 h-4 mr-2" />
  Nuova Polizza
</Button>
```

Layout: `flex items-center justify-between` sull'header per allineare titolo a sinistra e pulsante a destra.

## Cosa NON cambia

- Logica della pagina, query, filtri, tabella
- Route `/portafoglio/immissione` (già esistente e funzionante)
- Sidebar (la voce nel menu rimane com'è)
