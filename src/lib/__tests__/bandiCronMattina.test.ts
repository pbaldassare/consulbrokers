import { describe, expect, it } from "vitest";
import {
  BANDI_CRON_FONTE,
  BANDI_CRON_KEYWORD,
  BANDI_CRON_KEYWORD_LABEL,
  isBandoScaduto,
  mapBandoToUpsertRow,
  oggiEuropeRome,
  shouldArchiveToStorico,
} from "@/lib/bandiCronMattina";

describe("bandiCronMattina", () => {
  it("usa la stessa ricerca della pagina: tutte le fonti + brokeraggio", () => {
    expect(BANDI_CRON_FONTE).toBe("tutte");
    expect(BANDI_CRON_KEYWORD).toBe("brokeraggio");
    expect(BANDI_CRON_KEYWORD_LABEL).toBe("Brokeraggio assicurativo");
  });

  it("calcola oggi in Europe/Rome come YYYY-MM-DD", () => {
    expect(oggiEuropeRome(new Date("2026-09-17T22:30:00.000Z"))).toBe("2026-09-18");
    expect(oggiEuropeRome(new Date("2026-09-17T21:30:00.000Z"))).toBe("2026-09-17");
  });

  it("marca scaduto solo se la data è precedente a oggi", () => {
    expect(isBandoScaduto("2026-09-16", "2026-09-17")).toBe(true);
    expect(isBandoScaduto("17/09/2026", "2026-09-17")).toBe(false);
    expect(isBandoScaduto("18/09/2026", "2026-09-17")).toBe(false);
    expect(isBandoScaduto(null, "2026-09-17")).toBe(false);
  });

  it("archivia in storico solo i partecipati/cantiere scaduti", () => {
    const today = "2026-09-17";
    expect(shouldArchiveToStorico({
      scadenza: "2026-09-16",
      esito: "voglio_partecipare",
      today,
    })).toBe(true);
    expect(shouldArchiveToStorico({
      scadenza: "2026-09-16",
      cantiere: "in_monitoraggio",
      today,
    })).toBe(true);
    expect(shouldArchiveToStorico({
      scadenza: "2026-09-16",
      trattativeCount: 1,
      today,
    })).toBe(true);
    expect(shouldArchiveToStorico({
      scadenza: "2026-09-16",
      esito: "non_partecipo",
      today,
    })).toBe(false);
    expect(shouldArchiveToStorico({
      scadenza: "2026-09-16",
      esito: "voglio_partecipare",
      cantiere: "archiviato_storico",
      today,
    })).toBe(false);
    expect(shouldArchiveToStorico({
      scadenza: "2026-09-18",
      esito: "voglio_partecipare",
      today,
    })).toBe(false);
    expect(shouldArchiveToStorico({
      scadenza: "2026-09-16",
      cantiere: "abbandonato",
      today,
    })).toBe(false);
  });

  it("mappa la riga upsert come la pagina Bandi Pubblici", () => {
    const row = mapBandoToUpsertRow({
      scheda_id: "2026-123456",
      titolo: "Brokeraggio assicurativo",
      ente: "Comune di Viareggio",
      scadenza: "12/03/2026",
      fonte: "ted",
      stato: "aperto",
      dataPublicazione: "2026-02-01+01:00",
    }, "Brokeraggio assicurativo", "2026-09-17T05:00:00.000Z");
    expect(row?.scheda_id).toBe("2026-123456");
    expect(row?.scadenza).toBe("2026-03-12");
    expect(row?.fonte).toBe("ted");
    expect(row?.keyword).toBe("Brokeraggio assicurativo");
    expect(row?.data_pubblicazione).toBe("2026-02-01");
    expect(row?.stato).toBe("aperto");
    expect(mapBandoToUpsertRow({ titolo: "senza scheda" }, "x")).toBeNull();
  });
});
