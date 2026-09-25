import { describe, it, expect } from "vitest";
import {
  buildUfficioSedeSavePayload,
  emptyUfficioSedeForm,
  ufficioToFormData,
} from "../ufficioSedeForm";

describe("ufficioSedeForm", () => {
  it("include email_ufficio_sinistri nel payload di salvataggio", () => {
    const form = emptyUfficioSedeForm();
    form.codice_ufficio = " SD ";
    form.nome_ufficio = " SEDE SAN DONA' DI PIAVE ";
    form.email = "sandona@consulbrokers.it";
    form.email_ufficio_sinistri = "  sinistri.sandona@consulbrokers.it  ";

    expect(buildUfficioSedeSavePayload(form)).toMatchObject({
      codice_ufficio: "SD",
      nome_ufficio: "SEDE SAN DONA' DI PIAVE",
      email: "sandona@consulbrokers.it",
      email_ufficio_sinistri: "sinistri.sandona@consulbrokers.it",
    });
  });

  it("persiste NULL se la mail sinistri è vuota, senza toccare la mail sede", () => {
    const payload = buildUfficioSedeSavePayload({
      ...emptyUfficioSedeForm(),
      codice_ufficio: "SD",
      nome_ufficio: "San Donà",
      email: "sandona@consulbrokers.it",
      email_ufficio_sinistri: "   ",
    });

    expect(payload.email).toBe("sandona@consulbrokers.it");
    expect(payload.email_ufficio_sinistri).toBeNull();
  });

  it("ricarica email sede e email ufficio sinistri in modifica", () => {
    const form = ufficioToFormData({
      codice_ufficio: "SD",
      nome_ufficio: "SEDE SAN DONA' DI PIAVE",
      email: "sandona@consulbrokers.it",
      email_ufficio_sinistri: "sinistri.sandona@consulbrokers.it",
      attivo: true,
    });

    expect(form.email).toBe("sandona@consulbrokers.it");
    expect(form.email_ufficio_sinistri).toBe("sinistri.sandona@consulbrokers.it");
  });
});
