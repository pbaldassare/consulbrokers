import { describe, expect, it } from "vitest";
import { sidebarReserveLevel, splitSidebarReserveBlocks } from "@/lib/sidebarReserveZones";

describe("sidebarReserveLevel", () => {
  it("root ha priorità su admin", () => {
    expect(sidebarReserveLevel({ adminOnly: true, rootOnly: true })).toBe("root");
    expect(sidebarReserveLevel({ adminOnly: true })).toBe("admin");
  });
});

describe("splitSidebarReserveBlocks", () => {
  it("raggruppa voci admin consecutive", () => {
    const items = [
      { path: "a", adminOnly: true },
      { path: "b", adminOnly: true },
      { path: "c" },
    ];
    const blocks = splitSidebarReserveBlocks(items);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].level).toBe("admin");
    expect(blocks[0].items).toHaveLength(2);
    expect(blocks[1].level).toBe(null);
  });
});
