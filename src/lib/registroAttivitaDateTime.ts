/** Combina data (Date) e ora HH:mm[:ss] in ISO UTC per filtri timestamp registro. */
export function combineRegistroDateTime(
  date: Date | undefined,
  time: string,
  bound: "da" | "a",
): string | null {
  if (!date) return null;
  const d = new Date(date);
  const t = time.trim();
  if (t) {
    const parts = t.split(":").map((x) => parseInt(x, 10));
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const s = parts[2] ?? 0;
    d.setHours(h, m, s, bound === "a" && parts.length < 3 ? 999 : 0);
  } else if (bound === "da") {
    d.setHours(0, 0, 0, 0);
  } else {
    d.setHours(23, 59, 59, 999);
  }
  return d.toISOString();
}

export function formatTimeForInput(date: Date | undefined): string {
  if (!date) return "";
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
