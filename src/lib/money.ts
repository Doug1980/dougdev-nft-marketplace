import Big from 'big.js'

/** Decimal-safe ETH arithmetic. Values are strings in and strings out; never JS numbers. */
Big.DP = 18
Big.RM = Big.roundHalfUp

export type Eth = string

export const eth = {
  add: (...values: Eth[]): Eth => values.reduce((acc, v) => acc.plus(v), new Big(0)).toFixed(),
  sub: (a: Eth, b: Eth): Eth => new Big(a).minus(b).toFixed(),
  mul: (a: Eth, factor: number | string): Eth => new Big(a).times(factor).toFixed(),
  /** Percentage rounded to 6 decimals (half up). */
  pct: (a: Eth, percent: number): Eth => new Big(a).times(percent).div(100).round(6, Big.roundHalfUp).toFixed(),
  cmp: (a: Eth, b: Eth): number => new Big(a).cmp(b),
  eq: (a: Eth, b: Eth): boolean => new Big(a).eq(b),
  isZero: (a: Eth): boolean => new Big(a).eq(0),
  normalize: (a: Eth): Eth => new Big(a).toFixed(),
}

/** At least 2 decimals, up to 6, without dropping significant digits: "0.016" -> "0.016 ETH". */
export function formatEth(value: Eth, { suffix = true }: { suffix?: boolean } = {}): string {
  const big = new Big(value)
  let str = big.toFixed(6).replace(/0+$/, '')
  const [, decimals = ''] = str.split('.')
  if (decimals.length < 2) str = big.toFixed(2)
  return suffix ? `${str} ETH` : str
}

/** Layout format for discounts: "(-) 00.00" when zero. */
export function formatDiscount(value: Eth): string {
  return eth.isZero(value) ? '(-) 00.00' : `(-) ${formatEth(value, { suffix: false })}`
}

/** pt-BR comma format used by the price filter: "12,30". */
export function formatEthBr(value: Eth): string {
  return new Big(value).toFixed(2).replace('.', ',')
}
