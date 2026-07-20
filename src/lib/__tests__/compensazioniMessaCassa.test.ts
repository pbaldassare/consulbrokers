import { describe, expect, it } from "vitest";
import {
  isCausaleAccontoCliente,
  isCausaleCompMessaCassaUi,
} from "@/lib/compensazioniMessaCassa";

describe("compensazioniMessaCassa", () => {
  it("UI messa a cassa: solo abbuoni e arrotondamenti", () => {
    expect(isCausaleCompMessaCassaUi("ABB_ATT")).toBe(true);
    expect(isCausaleCompMessaCassaUi("ARROT_P")).toBe(true);
    expect(isCausaleCompMessaCassaUi("ECCED")).toBe(false);
    expect(isCausaleCompMessaCassaUi("SCONTO")).toBe(false);
    expect(isCausaleCompMessaCassaUi("SPESE")).toBe(false);
    expect(isCausaleCompMessaCassaUi("ACC_STOR")).toBe(false);
  });

  it("scheda Acconti: solo causali ACC_*", () => {
    expect(isCausaleAccontoCliente("ACC_STOR")).toBe(true);
    expect(isCausaleAccontoCliente("ACC_CRED")).toBe(true);
    expect(isCausaleAccontoCliente("ABB_ATT")).toBe(false);
    expect(isCausaleAccontoCliente("ECCED")).toBe(false);
  });
});
