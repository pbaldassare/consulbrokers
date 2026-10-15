import { describe, expect, it } from "vitest";
import { controparteDenominazioneNormKey } from "@/lib/controparteSinistriNorm";

describe("controparteDenominazioneNormKey", () => {
  it("tratta nome e cognome invertiti come la stessa chiave", () => {
    expect(controparteDenominazioneNormKey("LA FAUCI MASSIMO")).toBe(
      controparteDenominazioneNormKey("MASSIMO LA FAUCI"),
    );
  });

  it("non confonde persone diverse", () => {
    expect(controparteDenominazioneNormKey("Riolo Massimo")).not.toBe(
      controparteDenominazioneNormKey("LA FAUCI MASSIMO"),
    );
  });
});
