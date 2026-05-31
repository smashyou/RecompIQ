// Inventory & expenses math (REGIMEN_GOALS_PRD §4.2/§5.5). Pure functions —
// derives spend + depletion from user-entered purchases and logged doses.
// NOTHING here prescribes a dose; it only does arithmetic on the user's numbers.

export interface Purchase {
  id: string;
  compoundId: string;
  vialMg: number;
  vialCount: number;
  priceUsd: number; // total paid for the purchase (vial_count vials)
  purchasedOn: string; // ISO date (YYYY-MM-DD)
}

/** Convert a dose value to mg; null when the unit isn't mass-based (iu/units/ml). */
export function doseToMg(value: number, unit: string): number | null {
  if (unit === "mg") return value;
  if (unit === "mcg") return value / 1000;
  return null;
}

export function purchaseMg(p: Purchase): number {
  return p.vialMg * p.vialCount;
}

export function costPerMg(p: Purchase): number {
  const mg = purchaseMg(p);
  return mg > 0 ? p.priceUsd / mg : 0;
}

export interface CompoundInventory {
  compoundId: string;
  purchasedMg: number;
  consumedMg: number;
  remainingMg: number;
  /** FIFO front: cost/mg of the oldest vial with product left (re-buy price if depleted). */
  currentCostPerMg: number | null;
  /** currentCostPerMg × active dose (null if no mass dose set). */
  costOfNextDoseUsd: number | null;
  /** remainingMg ÷ active dose (null if no mass dose set). */
  remainingDoses: number | null;
  /** Weighted average across the provided purchases (Σspend ÷ Σmg). */
  avgCostPerMg: number | null;
  avgCostPerDoseUsd: number | null;
  totalSpendUsd: number;
}

/**
 * FIFO depletion + weighted average for ONE compound.
 * @param consumedMg total mg consumed (from logged taken/partial doses)
 * @param activeDoseMg the user's current dose in mg (null if unset / non-mass)
 */
export function compoundInventory(
  compoundId: string,
  purchases: Purchase[],
  consumedMg: number,
  activeDoseMg: number | null,
): CompoundInventory {
  const sorted = [...purchases].sort((a, b) => a.purchasedOn.localeCompare(b.purchasedOn));
  const purchasedMg = sorted.reduce((s, p) => s + purchaseMg(p), 0);
  const totalSpendUsd = sorted.reduce((s, p) => s + p.priceUsd, 0);
  const remainingMg = Math.max(0, purchasedMg - consumedMg);

  // FIFO: walk oldest→newest, deplete consumedMg; front = first purchase with mg left.
  let toConsume = consumedMg;
  let currentCostPerMg: number | null = null;
  for (const p of sorted) {
    const mg = purchaseMg(p);
    if (toConsume >= mg) {
      toConsume -= mg;
      continue;
    }
    currentCostPerMg = costPerMg(p);
    break;
  }
  // Fully depleted → value the next dose at the most recent (re-buy) price.
  if (currentCostPerMg === null && sorted.length > 0) {
    currentCostPerMg = costPerMg(sorted[sorted.length - 1]!);
  }

  const avgCostPerMg = purchasedMg > 0 ? totalSpendUsd / purchasedMg : null;
  const hasDose = activeDoseMg !== null && activeDoseMg > 0;

  return {
    compoundId,
    purchasedMg,
    consumedMg,
    remainingMg,
    currentCostPerMg,
    costOfNextDoseUsd:
      currentCostPerMg !== null && hasDose ? currentCostPerMg * (activeDoseMg as number) : null,
    remainingDoses: hasDose ? remainingMg / (activeDoseMg as number) : null,
    avgCostPerMg,
    avgCostPerDoseUsd:
      avgCostPerMg !== null && hasDose ? avgCostPerMg * (activeDoseMg as number) : null,
    totalSpendUsd,
  };
}

export interface SpendByCompound {
  compoundId: string;
  spendUsd: number;
  mg: number;
  avgCostPerMg: number | null;
}

export interface SpendSummary {
  totalUsd: number;
  byCompound: SpendByCompound[];
  costPerLbLostUsd: number | null;
}

/** Filter purchases to an inclusive [from, to] ISO-date range (undefined = open end). */
export function filterByRange(purchases: Purchase[], from?: string, to?: string): Purchase[] {
  return purchases.filter((p) => (!from || p.purchasedOn >= from) && (!to || p.purchasedOn <= to));
}

/** Weighted-average + breakdown over a set of purchases (already range-filtered). */
export function spendSummary(purchases: Purchase[], weightLostLb: number | null): SpendSummary {
  const totalUsd = purchases.reduce((s, p) => s + p.priceUsd, 0);
  const byMap = new Map<string, { spend: number; mg: number }>();
  for (const p of purchases) {
    const cur = byMap.get(p.compoundId) ?? { spend: 0, mg: 0 };
    cur.spend += p.priceUsd;
    cur.mg += purchaseMg(p);
    byMap.set(p.compoundId, cur);
  }
  const byCompound: SpendByCompound[] = Array.from(byMap.entries())
    .map(([compoundId, v]) => ({
      compoundId,
      spendUsd: v.spend,
      mg: v.mg,
      avgCostPerMg: v.mg > 0 ? v.spend / v.mg : null,
    }))
    .sort((a, b) => b.spendUsd - a.spendUsd);
  const costPerLbLostUsd = weightLostLb && weightLostLb > 0 ? totalUsd / weightLostLb : null;
  return { totalUsd, byCompound, costPerLbLostUsd };
}
