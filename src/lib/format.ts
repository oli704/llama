// Display helpers for LLM-produced values.

// "€1,400–€2,400" from ("EUR", 1400, 2400); falls back to "XYZ 1,400–2,400" for a
// currency code Intl doesn't know.
export function formatMoneyRange(
  currency: string | null,
  minOrNull: number | null,
  maxOrNull: number | null,
): string {
  const min = minOrNull ?? maxOrNull;
  const max = maxOrNull ?? minOrNull;
  if (min == null || max == null) return "Not available";
  const code = (currency ?? "").trim().toUpperCase();
  try {
    const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: code || "EUR", maximumFractionDigits: 0 });
    return min === max ? fmt.format(min) : `${fmt.format(min)}–${fmt.format(max)}`;
  } catch {
    const n = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
    return `${code} ${n.format(min)}${min === max ? "" : `–${n.format(max)}`}`.trim();
  }
}

export function formatMoney(currency: string | null, amount: number): string {
  return formatMoneyRange(currency, amount, amount);
}

// "TODDLER" -> "Toddler" for the kid age bands the LLM keys its notes by.
export function formatAgeBand(band: string): string {
  const lower = band.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
