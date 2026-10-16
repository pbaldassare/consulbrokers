import { describe, expect, it } from "vitest";
import { labelOperazioneLog, logAttivitaIsFallita, statoLogAttivita } from "@/lib/logAttivitaStato";

describe("statoLogAttivita", () => {
  it("RIUSCITA di default e per audit info", () => {
    expect(statoLogAttivita(null, "info")).toBe("RIUSCITA");
    expect(statoLogAttivita({ descrizione: "Modificati 2 campi" }, "info")).toBe("RIUSCITA");
    expect(statoLogAttivita({}, "critical")).toBe("RIUSCITA");
  });

  it("usa esito_fallita da DB se presente", () => {
    expect(statoLogAttivita({}, "info", false)).toBe("RIUSCITA");
    expect(statoLogAttivita({ ok: false }, "info", false)).toBe("RIUSCITA");
    expect(statoLogAttivita({}, "info", true)).toBe("FALLITA");
  });

  it("FALLITA con ok/success false o campi errore", () => {
    expect(logAttivitaIsFallita({ ok: false })).toBe(true);
    expect(statoLogAttivita({ ok: false })).toBe("FALLITA");
    expect(statoLogAttivita({ success: "false" })).toBe("FALLITA");
    expect(statoLogAttivita({ error: "Permesso negato" })).toBe("FALLITA");
    expect(statoLogAttivita({ messaggio_errore: "Timeout" })).toBe("FALLITA");
  });
});

describe("labelOperazioneLog", () => {
  it("preferisce descrizione da dettagli_json", () => {
    expect(labelOperazioneLog("titolo_modificato", { descrizione: "Modificati 4 campi" })).toBe(
      "Modificati 4 campi",
    );
  });
});
