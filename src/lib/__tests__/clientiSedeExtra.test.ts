import { describe, expect, it } from "vitest";
import { filtroUfficioOClientiExtra } from "../clientiSedeExtra";

describe("filtroUfficioOClientiExtra", () => {
  it("resta sulla sede se non ci sono eccezioni", () => {
    expect(filtroUfficioOClientiExtra("sede-sd", [])).toBe("ufficio_id.eq.sede-sd");
  });

  it("aggiunge solo i clienti in eccezione", () => {
    expect(filtroUfficioOClientiExtra("sede-sd", ["cli-1"])).toBe(
      "ufficio_id.eq.sede-sd,id.in.(cli-1)",
    );
  });
});
