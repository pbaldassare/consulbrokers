import { describe, expect, it } from "vitest";
import {
  buildSinistroAddress,
  buildSinistroLuogoLabel,
  isCalabriaCoords,
  knownCityCenter,
  resolveMapAreaLabel,
  resolveMapFallbackCenter,
  resolveSinistroCoords,
  resolveStoredSinistroCoords,
  VARESE_CENTER,
} from "../sinistriMapUtils";

describe("resolveSinistroCoords", () => {
  it("accetta lat/lng validi", () => {
    expect(resolveSinistroCoords({ lat: 45.82, lng: 8.83 })).toEqual({ lat: 45.82, lng: 8.83 });
  });

  it("rifiuta valori assenti o fuori range", () => {
    expect(resolveSinistroCoords({ lat: null, lng: 15 })).toBeNull();
    expect(resolveSinistroCoords({ lat: 91, lng: 15 })).toBeNull();
  });
});

describe("resolveStoredSinistroCoords", () => {
  it("scarta coordinate Calabria se il sinistro è a Varese", () => {
    expect(
      resolveStoredSinistroCoords({
        id: "1",
        lat: 38.11,
        lng: 15.65,
        citta_sinistro: "Varese",
        provincia_sinistro: "VA",
      }),
    ).toBeNull();
  });

  it("mantiene coordinate Calabria se il sinistro è davvero lì", () => {
    expect(
      resolveStoredSinistroCoords({
        id: "2",
        lat: 38.11,
        lng: 15.65,
        citta_sinistro: "Reggio Calabria",
        provincia_sinistro: "RC",
      }),
    ).toEqual({ lat: 38.11, lng: 15.65 });
  });

  it("mantiene coordinate Varese", () => {
    expect(
      resolveStoredSinistroCoords({
        id: "3",
        lat: 45.82,
        lng: 8.83,
        citta_sinistro: "Varese",
      }),
    ).toEqual({ lat: 45.82, lng: 8.83 });
  });
});

describe("area mappa", () => {
  it("usa la città più frequente sui sinistri", () => {
    expect(
      resolveMapAreaLabel({
        clienteCitta: "Milano",
        sinistri: [
          { citta_sinistro: "Varese" },
          { citta_sinistro: "Varese" },
          { citta_sinistro: "Gallarate" },
        ],
      }),
    ).toBe("Varese");
  });

  it("se i sinistri non hanno città usa la sede, e Varese dal nome ente", () => {
    expect(resolveMapAreaLabel({ clienteCitta: "Varese", sinistri: [] })).toBe("Varese");
    expect(
      resolveMapAreaLabel({ clienteNome: "Comune di Varese", sinistri: [{}] }),
    ).toBe("Varese");
  });

  it("centro fallback Varese / Italia", () => {
    expect(knownCityCenter("Varese")).toEqual(VARESE_CENTER);
    expect(resolveMapFallbackCenter("Varese")).toEqual(VARESE_CENTER);
    expect(isCalabriaCoords(38.11, 15.65)).toBe(true);
    expect(isCalabriaCoords(45.82, 8.83)).toBe(false);
  });
});

describe("luogo sinistro", () => {
  it("compone indirizzo, città e zona/luogo", () => {
    expect(
      buildSinistroLuogoLabel({
        id: "1",
        indirizzo_sinistro: "Piazza della Repubblica 1",
        citta_sinistro: "Varese",
        provincia_sinistro: "VA",
        cap_sinistro: "21100",
        luogo_sinistro: "Zona Biumo",
      }),
    ).toBe("Piazza della Repubblica 1 — 21100 Varese (VA) — Zona Biumo");
  });

  it("geocode usa città sede se manca il luogo", () => {
    expect(buildSinistroAddress({ id: "1" }, "Varese")).toBe("Varese, Italia");
  });
});
