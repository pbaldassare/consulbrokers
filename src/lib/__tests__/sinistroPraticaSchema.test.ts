import { describe, expect, it } from "vitest";
import {
  asOptionalNumber,
  asOptionalUuid,
  DESCRIZIONE_MIN_CHARS,
  praticaValuesToDbPayload,
  sinistroPraticaDefaultValues,
  sinistroPraticaSchema,
  sinistroRowToPraticaValues,
  toDateInputValue,
} from "@/lib/sinistroPraticaSchema";

describe("sinistroPraticaSchema payload edge", () => {
  it("accetta descrizione di 10 caratteri e rifiuta 9", () => {
    const base = {
      ...sinistroPraticaDefaultValues,
      data_evento: "2026-08-28",
      data_denuncia: "2026-08-28",
    };
    expect(DESCRIZIONE_MIN_CHARS).toBe(10);
    expect(sinistroPraticaSchema.safeParse({ ...base, descrizione: "1234567890" }).success).toBe(true);
    expect(sinistroPraticaSchema.safeParse({ ...base, descrizione: "123456789" }).success).toBe(false);
  });

  it("asOptionalNumber — omette stringa vuota e NaN", () => {
    expect(asOptionalNumber("")).toBeUndefined();
    expect(asOptionalNumber(undefined)).toBeUndefined();
    expect(asOptionalNumber("12.5")).toBe(12.5);
    expect(asOptionalNumber("abc")).toBeUndefined();
  });

  it("asOptionalUuid — omette stringa vuota", () => {
    expect(asOptionalUuid("")).toBeUndefined();
    expect(asOptionalUuid("  ")).toBeUndefined();
    expect(asOptionalUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("toDateInputValue — normalizza ISO, timestamp e italiano per DateInput", () => {
    expect(toDateInputValue("2026-10-05")).toBe("2026-10-05");
    expect(toDateInputValue("2026-10-05T00:00:00+00:00")).toBe("2026-10-05");
    expect(toDateInputValue("2026-10-05T12:30:00.000Z")).toBe("2026-10-05");
    expect(toDateInputValue("05/10/2026")).toBe("2026-10-05");
    expect(toDateInputValue("5/10/2026")).toBe("2026-10-05");
    expect(toDateInputValue(new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("")).toBe("");
    expect(toDateInputValue("31/02/2026")).toBe("");
  });

  it("sinistroRowToPraticaValues — conserva data_evento e data_denuncia per DateInput", () => {
    const values = sinistroRowToPraticaValues({
      data_evento: "2026-10-05T00:00:00+00:00",
      data_denuncia: "06/10/2026",
      tipo_sinistro: "rc_patrimoniale",
      luogo_sinistro: "Comune di Varese",
      cap_sinistro: "21100",
      citta_sinistro: "Varese",
      provincia_sinistro: "VA",
      descrizione: "Danno a immobile comunale",
    });
    expect(values.data_evento).toBe("2026-10-05");
    expect(values.data_denuncia).toBe("2026-10-06");
    expect(values.tipo_sinistro).toBe("rc_patrimoniale");
    expect(values.cap_sinistro).toBe("21100");
    expect(values.citta_sinistro).toBe("Varese");
    expect(values.provincia_sinistro).toBe("VA");
  });

  it("sinistroRowToPraticaValues — date già yyyy-MM-dd restano invariate (Modifica)", () => {
    const values = sinistroRowToPraticaValues({
      data_evento: "2026-10-05",
      data_denuncia: "2026-10-05",
    });
    expect(values.data_evento).toBe("2026-10-05");
    expect(values.data_denuncia).toBe("2026-10-05");
  });

  it("praticaValuesToDbPayload — non invia importo_riserva vuoto all'edge function", () => {
    const payload = praticaValuesToDbPayload({
      ...sinistroPraticaDefaultValues,
      data_evento: "2026-08-28",
      data_denuncia: "2026-08-28",
      importo_riserva: "" as unknown as undefined,
      responsabile_id: "",
      liquidatore_id: "",
      descrizione: "Descrizione di test sufficientemente lunga",
    });
    expect(payload).not.toHaveProperty("importo_riserva");
    expect(payload).not.toHaveProperty("responsabile_id");
    expect(payload).not.toHaveProperty("liquidatore_id");
    expect(payload.descrizione).toBe("Descrizione di test sufficientemente lunga");
  });
});
