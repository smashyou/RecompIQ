import {
  compoundInventory,
  doseToMg,
  filterByRange,
  spendSummary,
  type Purchase,
  type CompoundInventory,
  type SpendSummary,
} from "@peptide/peptides/inventory";
import { supabase } from "@/lib/supabase";
import { loadActiveRegimen } from "@/lib/regimen";

export interface PurchaseRow {
  id: string;
  compound_id: string;
  compound_name: string;
  vial_mg: number;
  vial_count: number;
  price_usd: number;
  vendor: string | null;
  purchased_on: string;
}

export interface CompoundInventoryView extends CompoundInventory {
  name: string;
  doseLabel: string | null;
}

export interface InventoryView {
  purchases: PurchaseRow[];
  compounds: CompoundInventoryView[];
  summary: SpendSummary;
  weightLostLb: number | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export async function loadInventory(
  userId: string,
  range: { from?: string; to?: string } = {},
): Promise<InventoryView> {
  const [purchasesRes, dosesRes, weightsRes, regimen] = await Promise.all([
    supabase
      .from("peptide_purchases")
      .select("id,compound_id,vial_mg,vial_count,price_usd,vendor,purchased_on, compounds(name)")
      .eq("user_id", userId)
      .order("purchased_on", { ascending: false }),
    supabase
      .from("peptide_doses")
      .select("compound_id,dose_value,dose_unit,adherence")
      .eq("user_id", userId)
      .in("adherence", ["taken", "partial"]),
    supabase.from("weights").select("logged_at,value_lb").eq("user_id", userId).order("logged_at", { ascending: true }),
    loadActiveRegimen(userId),
  ]);

  const purchases: PurchaseRow[] = ((purchasesRes.data ?? []) as any[]).map((p) => {
    const c = one<any>(p.compounds);
    return {
      id: p.id,
      compound_id: p.compound_id,
      compound_name: c?.name ?? "Unknown",
      vial_mg: Number(p.vial_mg),
      vial_count: p.vial_count,
      price_usd: Number(p.price_usd),
      vendor: p.vendor,
      purchased_on: p.purchased_on,
    };
  });

  const consumedMg = new Map<string, number>();
  for (const d of (dosesRes.data ?? []) as any[]) {
    const mg = doseToMg(Number(d.dose_value), d.dose_unit);
    if (mg === null) continue;
    consumedMg.set(d.compound_id, (consumedMg.get(d.compound_id) ?? 0) + mg);
  }

  const activeDose = new Map<string, { mg: number | null; label: string | null }>();
  for (const it of regimen?.currentItems ?? []) {
    if (activeDose.has(it.compound_id)) continue;
    const mg = it.dose_value !== null && it.dose_unit ? doseToMg(it.dose_value, it.dose_unit) : null;
    const label = it.dose_value !== null && it.dose_unit ? `${it.dose_value} ${it.dose_unit}` : null;
    activeDose.set(it.compound_id, { mg, label });
  }

  const enginePurchases: Purchase[] = purchases.map((p) => ({
    id: p.id,
    compoundId: p.compound_id,
    vialMg: p.vial_mg,
    vialCount: p.vial_count,
    priceUsd: p.price_usd,
    purchasedOn: p.purchased_on,
  }));

  const nameById = new Map(purchases.map((p) => [p.compound_id, p.compound_name]));
  const compounds: CompoundInventoryView[] = Array.from(new Set(enginePurchases.map((p) => p.compoundId)))
    .map((cid) => {
      const ps = enginePurchases.filter((p) => p.compoundId === cid);
      const dose = activeDose.get(cid) ?? { mg: null, label: null };
      const inv = compoundInventory(cid, ps, consumedMg.get(cid) ?? 0, dose.mg);
      return { ...inv, name: nameById.get(cid) ?? "Unknown", doseLabel: dose.label };
    })
    .sort((a, b) => b.totalSpendUsd - a.totalSpendUsd);

  const weights = ((weightsRes.data ?? []) as any[]).map((w) => ({
    on: String(w.logged_at).slice(0, 10),
    lb: Number(w.value_lb),
  }));
  const inRange = weights.filter((w) => (!range.from || w.on >= range.from) && (!range.to || w.on <= range.to));
  const weightLostLb = inRange.length >= 2 ? inRange[0].lb - inRange[inRange.length - 1].lb : null;

  const summary = spendSummary(filterByRange(enginePurchases, range.from, range.to), weightLostLb);
  return { purchases, compounds, summary, weightLostLb };
}

export async function loadSpendSnapshot(
  userId: string,
): Promise<{ last30Usd: number; allTimeUsd: number }> {
  const { data } = await supabase
    .from("peptide_purchases")
    .select("price_usd,purchased_on")
    .eq("user_id", userId);
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  let last30 = 0;
  let allTime = 0;
  for (const r of (data ?? []) as any[]) {
    const price = Number(r.price_usd);
    allTime += price;
    if (r.purchased_on >= cutoff) last30 += price;
  }
  return { last30Usd: last30, allTimeUsd: allTime };
}
