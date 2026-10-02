import { describe, expect, it } from "vitest";
import {
  AREA_RISERVATA_PASSWORD,
  PORTALE_CLIENTE_URL,
  areaRiservataEmailSubject,
  buildAreaRiservataEmail,
  labelTipoAccessoAreaRiservata,
} from "@/lib/areaRiservataEmail";

describe("areaRiservataEmail", () => {
  it("usa sempre cbnet.it/cliente, mai origin locale", () => {
    expect(PORTALE_CLIENTE_URL).toBe("https://cbnet.it/cliente");
    const text = buildAreaRiservataEmail({
      mode: "attivazione",
      clienteName: "Paolo Baldassare",
      email: "paolo.baldassare@gmail.com",
      tipo: "completa",
    });
    expect(text).toContain("https://cbnet.it/cliente");
    expect(text).not.toMatch(/localhost|127\.0\.0\.1|31\.220\.82/);
    expect(text).toContain(AREA_RISERVATA_PASSWORD);
    expect(text).toContain("paolo.baldassare@gmail.com");
    expect(text).toContain("è stata attivata");
  });

  it("testo reset password e oggetto dedicato", () => {
    const text = buildAreaRiservataEmail({
      mode: "reset",
      clienteName: "Paolo Baldassare",
      email: "paolo.baldassare@gmail.com",
      tipo: "sola_lettura",
    });
    expect(text).toContain("è stata resettata");
    expect(text).not.toContain("è stata attivata");
    expect(text).toContain(labelTipoAccessoAreaRiservata("sola_lettura"));
    expect(areaRiservataEmailSubject("reset")).toMatch(/resettata/i);
    expect(areaRiservataEmailSubject("attivazione")).toMatch(/Attivazione/i);
  });
});
