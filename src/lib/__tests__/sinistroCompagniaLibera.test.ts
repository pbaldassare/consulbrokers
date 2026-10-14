import { describe, expect, it } from "vitest";
import {
  buildSinistroCompagniaHeaderOptions,
  COMPAGNIA_LIBERA_BADGE,
  COMPAGNIA_NON_IDENTIFICATA_LABEL,
  COMPAGNIA_NON_IDENTIFICATA_VALUE,
  displayNomeCompagniaSinistro,
  payloadCompagniaCatalogo,
  payloadCompagniaLibera,
  resolveSceltaCompagniaHeader,
  selectedCompagniaHeaderValue,
} from "../sinistroCompagniaLibera";

const AXA = { id: "11111111-1111-1111-1111-111111111111", nome: "AXA", codice: "AXA" };

describe("opzione --Non identificato--", () => {
  it("è la prima voce, in corsivo, con label fissa", () => {
    const options = buildSinistroCompagniaHeaderOptions({
      compagnie: [AXA],
      currentId: AXA.id,
      compagniaNome: "AXA",
    });

    expect(options[0]).toMatchObject({
      value: COMPAGNIA_NON_IDENTIFICATA_VALUE,
      label: COMPAGNIA_NON_IDENTIFICATA_LABEL,
      labelClassName: "italic",
    });
    expect(options[0].label).toBe("--Non identificato--");
    expect(options[1].value).toBe(AXA.id);
    expect(options.some((o) => o.value === AXA.id && o.label === "AXA")).toBe(true);
  });

  it("resta --Non identificato-- in lista anche con nome libero già persistito", () => {
    const options = buildSinistroCompagniaHeaderOptions({
      compagnie: [AXA],
      compagniaLibera: "Compagnia inventata XYZ",
    });
    expect(options[0].label).toBe(COMPAGNIA_NON_IDENTIFICATA_LABEL);
    expect(options[0].triggerLabel).toBe("Compagnia inventata XYZ");
    expect(selectedCompagniaHeaderValue({ compagniaLibera: "Compagnia inventata XYZ" })).toBe(
      COMPAGNIA_NON_IDENTIFICATA_VALUE,
    );
  });

  it("antepone la compagnia corrente assente dal catalogo dopo --Non identificato--", () => {
    const options = buildSinistroCompagniaHeaderOptions({
      compagnie: [AXA],
      currentId: "22222222-2222-2222-2222-222222222222",
      compagniaNome: "AGENZIA MILANO VIA FILIBERTO",
    });
    expect(options[0].label).toBe(COMPAGNIA_NON_IDENTIFICATA_LABEL);
    expect(options[1].label).toBe("AGENZIA MILANO VIA FILIBERTO");
    expect(options[2].label).toBe("AXA");
  });
});

describe("scelta tendina", () => {
  it("apre il popup su --Non identificato-- o re-click se già libera", () => {
    expect(resolveSceltaCompagniaHeader(COMPAGNIA_NON_IDENTIFICATA_VALUE, false)).toBe("dialog");
    expect(resolveSceltaCompagniaHeader("", true)).toBe("dialog");
    expect(resolveSceltaCompagniaHeader("", false)).toBe("noop");
    expect(resolveSceltaCompagniaHeader(AXA.id, true)).toBe("catalogo");
  });
});

describe("payload persistenza isolata", () => {
  it("salva solo testo + FK null sul sinistro, senza insert in catalogo", () => {
    const payload = payloadCompagniaLibera(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "  Lloyd extra  ",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    );
    expect(payload).toEqual({
      azione: "aggiorna",
      sinistro_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      user_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      compagnia_id: null,
      compagnia_libera: "Lloyd extra",
    });
    expect(payload).not.toHaveProperty("compagnie");
    expect(JSON.stringify(payload)).not.toContain("insert");
    expect(Object.keys(payload!)).toEqual([
      "azione",
      "sinistro_id",
      "user_id",
      "compagnia_id",
      "compagnia_libera",
    ]);
  });

  it("rifiuta nome vuoto e non produce payload catalogo", () => {
    expect(payloadCompagniaLibera("s1", "   ")).toBeNull();
    expect(payloadCompagniaLibera("s1", "")).toBeNull();
  });

  it("scegliendo una compagnia di anagrafica azzera il testo libero", () => {
    const payload = payloadCompagniaCatalogo("s1", AXA.id, "u1");
    expect(payload).toEqual({
      azione: "aggiorna",
      sinistro_id: "s1",
      user_id: "u1",
      compagnia_id: AXA.id,
      compagnia_libera: null,
    });
  });

  it("non accetta il sentinella come id catalogo", () => {
    expect(payloadCompagniaCatalogo("s1", COMPAGNIA_NON_IDENTIFICATA_VALUE)).toBeNull();
  });
});

describe("display header", () => {
  it("preferisce l'anagrafica; altrimenti il testo libero con badge", () => {
    expect(displayNomeCompagniaSinistro({ compagniaNome: "AXA", compagniaLibera: "Altro" })).toEqual({
      text: "AXA",
      libera: false,
    });
    expect(displayNomeCompagniaSinistro({ compagniaLibera: "  Libera  " })).toEqual({
      text: "Libera",
      libera: true,
    });
    expect(COMPAGNIA_LIBERA_BADGE).toBe("non in anagrafica");
  });
});
