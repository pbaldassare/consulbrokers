import { cn } from "@/lib/utils";

/** Bordo soft per voci sidebar riservate agli admin. */
export const SIDEBAR_ADMIN_ZONE =
  "rounded-md border border-red-500/28 bg-red-950/[0.08]";

/** Root admin@consul.it: rosso più acceso (no bordo chiaro/bianco). */
export const SIDEBAR_ROOT_ZONE =
  "rounded-md border border-red-500/80 bg-red-950/30 ring-1 ring-red-400/50";

export type SidebarReserveLevel = "admin" | "root" | null;

export function sidebarReserveLevel(item: {
  adminOnly?: boolean;
  rootOnly?: boolean;
}): SidebarReserveLevel {
  if (item.rootOnly) return "root";
  if (item.adminOnly) return "admin";
  return null;
}

export function sidebarReserveZoneClass(level: SidebarReserveLevel): string | undefined {
  if (level === "root") return SIDEBAR_ROOT_ZONE;
  if (level === "admin") return SIDEBAR_ADMIN_ZONE;
  return undefined;
}

export function sidebarReserveWrapClass(level: SidebarReserveLevel, extra?: string): string {
  return cn("my-0.5", sidebarReserveZoneClass(level), extra);
}

export type SidebarReserveBlock<T> = { level: SidebarReserveLevel; items: T[] };

/** Spezza la lista in blocchi normali / admin / root (voci consecutive stesso livello). */
export function splitSidebarReserveBlocks<T extends { adminOnly?: boolean; rootOnly?: boolean }>(
  items: T[],
): ({ level: null; items: T[] } | { level: "admin" | "root"; items: T[] })[] {
  const blocks: SidebarReserveBlock<T>[] = [];
  for (const item of items) {
    const level = sidebarReserveLevel(item);
    const last = blocks[blocks.length - 1];
    if (last && last.level === level && level !== null) {
      last.items.push(item);
    } else if (level === null) {
      blocks.push({ level: null, items: [item] });
    } else {
      blocks.push({ level, items: [item] });
    }
  }
  return blocks as ({ level: null; items: T[] } | { level: "admin" | "root"; items: T[] })[];
}
