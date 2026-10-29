import { describe, expect, it } from "vitest";
import { resendAddressList } from "../../../supabase/functions/send-email/resendAddressList";

describe("resendAddressList", () => {
  it("spezza punto e virgola e virgola", () => {
    expect(resendAddressList("info@roland-italia.it; incassi@roland-italia.it")).toEqual([
      "info@roland-italia.it",
      "incassi@roland-italia.it",
    ]);
  });

  it("lascia un solo indirizzo e gli array", () => {
    expect(resendAddressList("dualitalia@legalmail.it")).toEqual(["dualitalia@legalmail.it"]);
    expect(resendAddressList(["a@b.it", "c@d.it; e@f.it"])).toEqual(["a@b.it", "c@d.it", "e@f.it"]);
  });
});
