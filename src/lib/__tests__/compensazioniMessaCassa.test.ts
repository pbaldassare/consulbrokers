import { describe, expect, it } from "vitest";
import {
  isCausaleAccontoCliente,
  isCausaleCompMessaCassaUi,
  isCausaleMessaCassaMenu,
  rettificaDovutoQuietanza,
} from "@/lib/compensazioniMessaCassa";

describe("compensazioniMessaCassa", () => {
  it("menu messa a cassa: abbuoni, arrotondamenti e acconti", () => {
    expect(isCausaleMessaCassaMenu("ABB_ATT")).toBe(true);
    expect(isCausaleMessaCassaMenu("ARROT_P")).toBe(true);
    expect(isCausaleMessaCassaMenu("ACC_STOR")).toBe(true);
    expect(isCausaleMessaCassaMenu("ACC_CRED")).toBe(true);
    expect(isCausaleMessaCassaMenu("ECCED")).toBe(false);
    expect(isCausaleMessaCassaMenu("SCONTO")).toBe(false);
  });

  it("rettifica dovuto quietanza: solo abbuoni/arrotondamenti", () => {
    expect(rettificaDovutoQuietanza("ABB_ATT")).toBe(true);
    expect(rettificaDovutoQuietanza("ARROT_A")).toBe(true);
    expect(rettificaDovutoQuietanza("ACC_STOR")).toBe(false);
    expect(isCausaleCompMessaCassaUi("ACC_STOR")).toBe(false);
  });

  it("scheda Acconti: solo causali ACC_*", () => {
    expect(isCausaleAccontoCliente("ACC_STOR")).toBe(true);
    expect(isCausaleAccontoCliente("ACC_CRED")).toBe(true);
    expect(isCausaleAccontoCliente("ABB_ATT")).toBe(false);
    expect(isCausaleAccontoCliente("ECCED")).toBe(false);
  });
});
