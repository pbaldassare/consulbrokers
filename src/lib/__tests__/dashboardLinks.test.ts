import { describe, expect, it } from "vitest";
import {
  dashboardDateBounds,
  hrefDaMettereACassa,
  hrefFuoriCopertura,
  hrefIncassiIeri,
  hrefIncassiMese,
  hrefRimesseDaInviare,
  hrefRinnoviMese,
  hrefScadenzeMese,
} from "../dashboardLinks";

describe("dashboardDateBounds", () => {
  it("usa date locali (non UTC)", () => {
    const b = dashboardDateBounds(new Date(2026, 9, 1, 10, 0, 0));
    expect(b.startOfMonth).toBe("2026-10-01");
    expect(b.endOfMonth).toBe("2026-10-31");
    expect(b.yesterday).toBe("2026-09-30");
    expect(b.today).toBe("2026-10-01");
  });
});

describe("href dashboard", () => {
  const now = new Date(2026, 9, 1, 10, 0, 0);

  it("rinnovi del mese → pagina rinnovi con Dal/Al", () => {
    expect(hrefRinnoviMese(now)).toBe("/portafoglio/rinnovi?dal=2026-10-01&al=2026-10-31");
  });

  it("da mettere a cassa → incassi pendenti mese", () => {
    expect(hrefDaMettereACassa()).toBe("/portafoglio/incassi?vista=pendenti&periodo=mese_corrente");
  });

  it("incassi ieri → contabilita con Dal=Al=ieri", () => {
    expect(hrefIncassiIeri(now)).toBe("/contabilita?dal=2026-09-30&al=2026-09-30");
  });

  it("incassi del mese → contabilita mese corrente", () => {
    expect(hrefIncassiMese()).toBe("/contabilita?periodo=mese_corrente");
  });

  it("scadenze e fuori copertura → coda pendenti", () => {
    expect(hrefScadenzeMese()).toBe("/portafoglio/incassi?vista=pendenti&periodo=mese_corrente");
    expect(hrefFuoriCopertura()).toBe("/portafoglio/incassi?vista=pendenti&periodo=mese_corrente");
  });

  it("rimesse → storico (non /rimesse inesistente)", () => {
    expect(hrefRimesseDaInviare()).toBe("/contabilita/storico-rimesse");
  });
});
