import { describe, expect, it } from "vitest";
import {
  isConsultazioneEmailAllowed,
  normalizeConsultazioneEmail,
} from "../consultazioneSession";

describe("consultazioneSession", () => {
  it("accetta solo @consulbrokers.it", () => {
    expect(isConsultazioneEmailAllowed("mario.rossi@consulbrokers.it")).toBe(true);
    expect(isConsultazioneEmailAllowed("Mario.Rossi@ConsulBrokers.it")).toBe(true);
    expect(isConsultazioneEmailAllowed("x@gmail.com")).toBe(false);
    expect(isConsultazioneEmailAllowed("@consulbrokers.it")).toBe(false);
    expect(isConsultazioneEmailAllowed("consulbrokers.it")).toBe(false);
  });

  it("normalizza email", () => {
    expect(normalizeConsultazioneEmail("  Foo@ConsulBrokers.it ")).toBe("foo@consulbrokers.it");
  });
});
