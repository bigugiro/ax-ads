/** Formatadores pt-BR para o painel (moeda, número, percentual, ROAS). */

const moeda0 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const moeda2 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** R$ sem centavos (valores altos de gasto/receita). */
export function fmtMoeda(n: number): string {
  return moeda0.format(n);
}

/** R$ com centavos (CAC/CPA, ticket). `null` → travessão. */
export function fmtMoedaExata(n: number | null): string {
  return n === null ? '—' : moeda2.format(n);
}

export function fmtInteiro(n: number): string {
  return inteiro.format(n);
}

/** Razão 0..1 → percentual. Ex.: 0.0234 → "2,34%". */
export function fmtPct(razao: number, casas = 2): string {
  return `${(razao * 100).toFixed(casas).replace('.', ',')}%`;
}

/** ROAS como múltiplo. `null` → travessão. Ex.: 3.4521 → "3,45×". */
export function fmtRoas(r: number | null): string {
  return r === null ? '—' : `${r.toFixed(2).replace('.', ',')}×`;
}

/** Variação assinada para o badge de delta. `null` → sem base de comparação. */
export function fmtVariacao(v: number | null): string | null {
  if (v === null) return null;
  const sinal = v > 0 ? '+' : '';
  return `${sinal}${(v * 100).toFixed(1).replace('.', ',')}%`;
}
