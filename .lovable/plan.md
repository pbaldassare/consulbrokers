## Obiettivo
Quando in ClienteDetail (tab Polizze) si clicca una riga **Quietanza**, aprire la pagina **QuietanzaDetail** (`/quietanze/:id`), non `TitoloDetail`. Le righe **Polizza** (madre) restano su `/titoli/:id`.

## Modifiche

File: `src/pages/ClienteDetail.tsx`

1. Riga 1310 — vista flat "Quietanze":
   `navigate(\`/titoli/${r.id}\`)` → `navigate(\`/quietanze/${r.id}\`)`

2. Riga 1410 — riga rata espansa in vista "Tutti":
   `navigate(\`/titoli/${r.id}\`)` → `navigate(\`/quietanze/${r.id}\`)`

Invariati:
- Riga 1322 e 1424 (link al numero polizza madre) → restano `/titoli/${madreId}` / `/titoli/${head.id}`.
- Riga 1373 (click sulla riga madre) → resta `/titoli/${head.id}`.

## Cosa NON cambia
- Nessuna modifica DB, RLS, trigger, route, o a `QuietanzaDetail`/`TitoloDetail`.
- Niente cambi alla logica di conteggio/etichette (già corretta nella iterazione precedente).
- Altre pagine (Portafoglio Attive/Carico/Storico, GestionePolizze, ecc.) non toccate.

## Verifica
Ricarica `/archivi/clienti/2249f5de…?tab=polizze`, filtro "Quietanze": click sulla riga "Quietanza 1/1" → URL `/quietanze/<id>` e si apre la scheda quietanza. Click su numero polizza madre (link) → `/titoli/<id>`.
