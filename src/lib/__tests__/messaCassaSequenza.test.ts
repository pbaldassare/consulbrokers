import { describe, expect, it } from "vitest";
import {
  messaggioBloccoSequenza,
  prossimoDaIncassare,
  soloIncassabiliInSequenza,
  verificaSequenzaIncasso,
  type TitoloSequenza,
} from "@/lib/messaCassaSequenza";

const polizza2026: TitoloSequenza = {
  id: "pol",
  numero_titolo: "231/118948159",
  sostituisce_polizza: null,
  compagnia_id: "c1",
  riga: 0,
  garanzia_da: "2026-07-31",
  stato: "attivo",
};
const quietanza2027: TitoloSequenza = {
  id: "q27",
  numero_titolo: "231/118948159",
  sostituisce_polizza: "231/118948159",
  compagnia_id: "c1",
  riga: 1,
  garanzia_da: "2027-07-31",
  stato: "attivo",
};
const quietanza2028: TitoloSequenza = {
  ...quietanza2027,
  id: "q28",
  riga: 2,
  garanzia_da: "2028-07-31",
};

describe("prossimoDaIncassare", () => {
  it("prima la polizza, poi le quietanze in ordine", () => {
    expect(prossimoDaIncassare([quietanza2027, polizza2026])?.id).toBe("pol");
    expect(
      prossimoDaIncassare([{ ...polizza2026, stato: "incassato", data_messa_cassa: "2026-08-01" }, quietanza2027, quietanza2028])?.id,
    ).toBe("q27");
  });

  it("catena tutta incassata: nessun prossimo", () => {
    expect(
      prossimoDaIncassare([{ ...polizza2026, stato: "incassato", data_messa_cassa: "2026-08-01" }]),
    ).toBeNull();
  });

  it("titoli aperti rimasti prima di uno già a cassa non bloccano", () => {
    const next = prossimoDaIncassare([
      polizza2026,
      { ...quietanza2027, stato: "incassato", data_messa_cassa: "2027-08-01" },
      quietanza2028,
    ]);
    expect(next?.id).toBe("q28");
  });
});

describe("soloIncassabiliInSequenza", () => {
  it("una sola riga per catena: la polizza 2026, non la quietanza 2027", () => {
    const out = soloIncassabiliInSequenza([polizza2026, quietanza2027, quietanza2028]);
    expect(out.map((t) => t.id)).toEqual(["pol"]);
  });

  it("le appendici restano incassabili a sé", () => {
    const am: TitoloSequenza = {
      id: "am",
      numero_titolo: "231/118948159/AM1",
      sostituisce_polizza: "231/118948159",
      compagnia_id: "c1",
      stato: "attivo",
      is_appendice_modifica: true,
    };
    const out = soloIncassabiliInSequenza([polizza2026, quietanza2027, am]);
    expect(out.map((t) => t.id).sort()).toEqual(["am", "pol"]);
  });

  it("stesso numero su compagnie diverse sono catene diverse", () => {
    const altra = { ...polizza2026, id: "pol-c2", compagnia_id: "c2" };
    const out = soloIncassabiliInSequenza([polizza2026, quietanza2027, altra]);
    expect(out.map((t) => t.id).sort()).toEqual(["pol", "pol-c2"]);
  });
});

describe("verificaSequenzaIncasso", () => {
  it("blocca la quietanza 2027 se la polizza 2026 è da incassare", () => {
    const blocchi = verificaSequenzaIncasso(["q27"], [polizza2026, quietanza2027]);
    expect(blocchi).toHaveLength(1);
    expect(blocchi[0].primaDa.id).toBe("pol");
    expect(messaggioBloccoSequenza(blocchi[0])).toContain("prima va incassato 231/118948159");
  });

  it("polizza e quietanza insieme: passa la polizza, si blocca la quietanza", () => {
    const blocchi = verificaSequenzaIncasso(["pol", "q27"], [polizza2026, quietanza2027]);
    expect(blocchi.map((b) => b.titoloId)).toEqual(["q27"]);
  });

  it("dopo l'incasso della polizza la quietanza 2027 è libera", () => {
    const blocchi = verificaSequenzaIncasso(
      ["q27"],
      [{ ...polizza2026, stato: "incassato", data_messa_cassa: "2026-08-01" }, quietanza2027],
    );
    expect(blocchi).toHaveLength(0);
  });
});
