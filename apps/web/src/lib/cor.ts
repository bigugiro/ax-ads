/** Converte hex (#RRGGBB) pro formato "R G B" usado nas CSS vars da marca
 *  (BRAND.md §6 — canais separados p/ opacidade via `rgb(var(--brand) / a)`). */
export function hexParaRgbTriplet(hex: string): string | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return null;
  const valor = match[1]!;
  const r = parseInt(valor.slice(0, 2), 16);
  const g = parseInt(valor.slice(2, 4), 16);
  const b = parseInt(valor.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}
