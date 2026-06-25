import { describe, it, expect } from "vitest";
import { syncPeriodoRateo } from "../syncPeriodoRateo";

describe("syncPeriodoRateo", () => {
  it("allinea garanzia da e competenza a durata da", () => {
    expect(
      syncPeriodoRateo({
        garanziaDa: "2026-03-20",
        durataDa: "2026-03-15",
        durataATouched: false,
        anniDurata: 1,
      }),
    ).toEqual({
      garanzia_da: "2026-03-15",
      data_competenza: "2026-03-20",
      durata_a: "2027-03-15",
    });
  });

  it("calcola durata_a da anni durata se non toccata", () => {
    expect(
      syncPeriodoRateo({
        garanziaDa: "",
        durataDa: "2026-01-01",
        durataATouched: false,
        anniDurata: 3,
      }),
    ).toEqual({
      garanzia_da: "2026-01-01",
      data_competenza: "2026-01-01",
      durata_a: "2029-01-01",
    });
  });

  it("non sovrascrive durata_a se toccata manualmente", () => {
    expect(
      syncPeriodoRateo({
        garanziaDa: "2026-01-01",
        durataDa: "2026-01-01",
        durataATouched: true,
        anniDurata: 1,
      }),
    ).toEqual({
      garanzia_da: "2026-01-01",
      data_competenza: "2026-01-01",
    });
  });

  it("restituisce stringhe vuote se mancano le date", () => {
    expect(
      syncPeriodoRateo({
        garanziaDa: "",
        durataDa: "",
        durataATouched: false,
        anniDurata: 1,
      }),
    ).toEqual({
      garanzia_da: "",
      data_competenza: "",
    });
  });
});
