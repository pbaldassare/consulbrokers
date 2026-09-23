import { describe, expect, it } from "vitest";
import {
  asOptionalNumber,
  asOptionalUuid,
  DESCRIZIONE_ACCADIMENTO_MIN,
  praticaValuesToDbPayload,
  sinistroPraticaDefaultValues,
  sinistroPraticaSchema,
} from "@/lib/sinistroPraticaSchema";

describe("sinistroPraticaSchema payload edge", () => {
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

  it("descrizione accadimento — minimo 10 caratteri", () => {
    const base = {
      ...sinistroPraticaDefaultValues,
      data_evento: "2026-08-28",
      data_denuncia: "2026-08-28",
    };
    const tooShort = "123456789"; // 9
    const justEnough = "1234567890"; // 10
    expect(tooShort).toHaveLength(DESCRIZIONE_ACCADIMENTO_MIN - 1);
    expect(justEnough).toHaveLength(DESCRIZIONE_ACCADIMENTO_MIN);
    expect(sinistroPraticaSchema.safeParse({ ...base, descrizione: tooShort }).success).toBe(false);
    expect(sinistroPraticaSchema.safeParse({ ...base, descrizione: justEnough }).success).toBe(true);
    const failed = sinistroPraticaSchema.safeParse({ ...base, descrizione: tooShort });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error.issues[0]?.message).toBe(
        `La descrizione deve contenere almeno ${DESCRIZIONE_ACCADIMENTO_MIN} caratteri`,
      );
    }
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
