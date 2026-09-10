import { describe, expect, it } from "vitest";
import { edgeFunctionErrorMessage, formatEdgeFunctionError } from "@/lib/edgeFunctionError";

describe("formatEdgeFunctionError", () => {
  it("preferisce error dal body e ignora il messaggio generico non-2xx", () => {
    expect(
      formatEdgeFunctionError(
        { message: "Edge Function returned a non-2xx status code" },
        { error: "Accesso non autorizzato. Usa un'email aziendale del partner abilitato." },
      ),
    ).toBe("Accesso non autorizzato. Usa un'email aziendale del partner abilitato.");
  });
});

describe("edgeFunctionErrorMessage", () => {
  it("preferisce error dal body JSON", () => {
    expect(
      edgeFunctionErrorMessage(
        { error: "Accesso non autorizzato. Usa un'email aziendale del partner abilitato." },
        { message: "Edge Function returned a non-2xx status code" },
      ),
    ).toBe("Accesso non autorizzato. Usa un'email aziendale del partner abilitato.");
  });

  it("usa il messaggio invoke se il body non ha error", () => {
    expect(edgeFunctionErrorMessage({ ok: true }, { message: "Failed to send" })).toBe(
      "Failed to send",
    );
  });

  it("ritorna null se non c'è nulla di utile", () => {
    expect(edgeFunctionErrorMessage(null, null)).toBeNull();
    expect(edgeFunctionErrorMessage({}, { message: "  " })).toBeNull();
  });
});
