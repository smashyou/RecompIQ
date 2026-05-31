// Tiny className joiner (clsx-lite) for NativeWind className strings.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
