import { describe, expect, it } from "vitest";
import { getLevelByRole } from "../userLevels";

describe("privilegi sede L3", () => {
  it("include anagrafiche e compagnie/agenzie", () => {
    const sede = getLevelByRole("ufficio");
    expect(sede.id).toBe("L3");
    expect(sede.defaultPermissions.anagrafiche).toBe(true);
    expect(sede.defaultPermissions.agenzie).toBe(true);
    expect(sede.defaultPermissions.titoli).toBe(true);
    expect(sede.defaultVisibility).toBe("own_office");
  });
});
