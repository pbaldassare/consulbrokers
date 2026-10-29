import { describe, expect, it } from "vitest";
import {
  emailConflittoPortaleGestionale,
  ruoloPortale,
} from "../../../supabase/functions/_shared/emailPortaleGestionale";

describe("emailPortaleGestionale", () => {
  it("segnala il conflitto solo fra portale e gestionale", () => {
    expect(ruoloPortale("cliente")).toBe(true);
    expect(ruoloPortale(" Prospect ")).toBe(true);
    expect(ruoloPortale("admin")).toBe(false);
    expect(emailConflittoPortaleGestionale("admin", "cliente")).toBe(true);
    expect(emailConflittoPortaleGestionale("cliente", "backoffice")).toBe(true);
    expect(emailConflittoPortaleGestionale("cliente", "prospect")).toBe(false);
    expect(emailConflittoPortaleGestionale("ufficio", "admin")).toBe(false);
    expect(emailConflittoPortaleGestionale(null, "cliente")).toBe(false);
  });
});
