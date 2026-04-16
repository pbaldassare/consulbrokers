

## Piano: Aggiornare testo circolare nel dialog Conferimento Gestito

### Problema
Il dialog cita erroneamente "Circolare IVASS n. 73/2020". La circolare è interna — **Circolare 02 Consulbrokers**, Procedura operativa 03, punto 3.

### Modifica

**File**: `src/pages/TitoloDetail.tsx` (righe 598-602)

Sostituire il testo della dichiarazione con il contenuto reale della Circolare 02:

**Titolo**: "Dichiarazione di Responsabilità — Circolare 02 Consulbrokers"

**Testo**: Riferimento alla Procedura operativa 03, punto 3:
> Le polizze, una volta inserite NON DEVONO ESSERE GARANTITE, ma dovranno essere effettivamente incassate; casi particolari devono essere concordati PER ISCRITTO con la Direzione seguendo i criteri di seguito esposti:
>
> a. Coperture fino ad euro 1.000,00: occorre l'autorizzazione dell'Amministratore Delegato
> b. Coperture fino ad euro 10.000,00: occorre l'autorizzazione di due Amministratori Delegati
> c. Coperture oltre euro 10.000,00: occorre l'autorizzazione del CDA
>
> Tutto quanto non regolarizzato alla data di chiusura del mese non verrà rimesso alle compagnie entro il giorno 10 del mese successivo.

**Checkbox**: "Dichiaro di aver ottenuto l'autorizzazione necessaria e di assumermi la responsabilità dell'incasso"

### File coinvolti
- `src/pages/TitoloDetail.tsx` — solo modifica testo (righe 598-602)

