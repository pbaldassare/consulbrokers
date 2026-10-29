/** Resend vuole un indirizzo per elemento. In anagrafica spesso sono "a@x.it; b@y.it". */
export function resendAddressList(value: string | string[] | null | undefined): string[] {
  if (value == null) return [];
  const chunks = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const chunk of chunks) {
    for (const piece of String(chunk).split(/[;,]/)) {
      const addr = piece.trim();
      if (addr) out.push(addr);
    }
  }
  return out;
}
