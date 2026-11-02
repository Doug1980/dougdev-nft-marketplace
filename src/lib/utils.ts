export { cn } from 'cn'

/** "0x1234…abcd": keeps the start and end of long wallet addresses or hashes. */
export const shortAddress = (address: string) => (address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address)
