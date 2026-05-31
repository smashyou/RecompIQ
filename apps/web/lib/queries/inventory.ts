import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  compoundInventory,
  doseToMg,
  filterByRange,
  spendSummary,
  type Purchase,
  type CompoundInventory,
  type SpendSummary,
} from "@peptide/peptides";
import { loadActiveRegimen } from "@/lib/queries/regimen";

export interface PurchaseRow {
  id: string;
  compound_id: string;
  compound_slug: string | null;
  compound_name: string;
  vial_mg: number;
  vial_count: number;
  price_usd: number;
  vendor: string | null;
  purchased_on: string;
  notes: string | null;
}

export interface CompoundInventoryView extends CompoundInventory {
  slug: string | null;
  name: string;
  activeDoseMg: number | null;
  doseLabel: string | null;
}

export interface InventoryView {
  purchases: PurchaseRow[];
  compounds: CompoundInventoryView[];
  summary: SpendSummary; // for the selected range
  range: { from?: string; to?: string };
  weightLostLb: number | null;
}

interface Range {
  from?: string;
  to?: string;
}

export async function loadInventory(userId: string, range: Range = {}): Promise<InventoryView> {
  const supabase = await createSupabaseServerClient();

  const [purchasesRes, dosesRes, weightsRes, regimen] = await Promise.all([
    supabase
      .from("peptide_purchases")
      .select("id,compound_id,vial_mg,vial_count,price_usd,vendor,purchased_on,notes, compounds(slug,name)")
      .eq("user_id", userId)
      .order("purchased_on", { ascending: false }),
    supabase
      .from("peptide_doses")
      .select("compound_id,dose_value,dose_unit,adherence")
      .eq("user_id", userId)
      .in("adherence", ["taken", "partial"]),
    supabase
      .from("weights")
      .select("logged_at,value_lb")
      .eq("user_id", userId)
      .order("logged_at", { ascending: true }),
    loadActiveRegimen(userId),
  ]);

  const rawPurchases = (purchasesRes.data ?? []) as Array<{
    id: string;
    compound_id: string;
    vial_mg: number | string;
    vial_count: number;
    price_usd: number | string;
    vendor: string | null;
    purchased_on: string;
    notes: string | null;
    compounds: { slug: string; name: string } | { slug: string; name: string }[] | null;
  }>;

  const nameOf = (c: { slug: string; name: string } | { slug: string; name: string }[] | null) =>
    Array.isArray(c) ? c[0] : c;

  const purchases: PurchaseRow[] = rawPurchases.map((p) => {
    const c = nameOf(p.compounds);
    return {
      id: p.id,
      compound_id: p.compound_id,
      compound_slug: c?.slug ?? null,
      compound_name: c?.name ?? "Unknown",
      vial_mg: Number(p.vial_mg),
      vial_count: p.vial_count,
      price_usd: Number(p.price_usd),
      vendor: p.vendor,
      purchased_on: p.purchased_on,
      notes: p.notes,
    };
  });

  // Consumed mg per compound (mass units only).
  const consumedMg = new Map<string, number>();
  for (const d of (dosesRes.data ?? []) as Array<{ compound_id: string; dose_value: number | string; dose_unit: string }>) {
    const mg = doseToMg(Number(d.dose_value), d.dose_unit);
    if (mg === null) continue;
    consumedMg.set(d.compound_id, (consumedMg.get(d.compound_id) ?? 0) + mg);
  }

  // Active dose per compound (mg) from the current regimen items.
  const activeDose = new Map<string, { mg: number | null; label: string | null }>();
  for (const it of regimen?.currentItems ?? []) {
    if (activeDose.has(it.compound_id)) continue;
    const mg = it.dose_value !== null && it.dose_unit ? doseToMg(it.dose_value, it.dose_unit) : null;
    const label = it.dose_value !== null && it.dose_unit ? `${it.dose_value} ${it.dose_unit}` : null;
    activeDose.set(it.compound_id, { mg, label });
  }

  // Engine input: group purchases by compound.
  const enginePurchases: Purchase[] = purchases.map((p) => ({
    id: p.id,
    compoundId: p.compound_id,
    vialMg: p.vial_mg,
    vialCount: p.vial_count,
    priceUsd: p.price_usd,
    purchasedOn: p.purchased_on,
  }));

  const compoundIds = Array.from(new Set(enginePurchases.map((p) => p.compoundId)));
  const meta = new Map(purchases.map((p) => [p.compound_id, { slug: p.compound_slug, name: p.compound_name }]));

  const compounds: CompoundInventoryView[] = compoundIds
    .map((cid) => {
      const ps = enginePurchases.filter((p) => p.compoundId === cid);
      const dose = activeDose.get(cid) ?? { mg: null, label: null };
      const inv = compoundInventory(cid, ps, consumedMg.get(cid) ?? 0, dose.mg);
      const m = meta.get(cid);
      return {
        ...inv,
        slug: m?.slug ?? null,
        name: m?.name ?? "Unknown",
        activeDoseMg: dose.mg,
        doseLabel: dose.label,
      };
    })
    .sort((a, b) => b.totalSpendUsd - a.totalSpendUsd);

  // Weight lost over the selected range (or all-time).
  const weights = (weightsRes.data ?? []).map((w) => ({
    on: (w.logged_at as string).slice(0, 10),
    lb: Number(w.value_lb),
  }));
  const inRange = weights.filter(
    (w) => (!range.from || w.on >= range.from) && (!range.to || w.on <= range.to),
  );
  const weightLostLb =
    inRange.length >= 2 ? inRange[0]!.lb - inRange[inRange.length - 1]!.lb : null;

  const summary = spendSummary(
    filterByRange(enginePurchases, range.from, range.to),
    weightLostLb,
  );

  return { purchases, compounds, summary, range, weightLostLb };
}

/** Lightweight spend figures for the dashboard snapshot (last 30 days + all-time). */
export async function loadSpendSnapshot(
  userId: string,
): Promise<{ last30Usd: number; allTimeUsd: number; topCompound: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("peptide_purchases")
    .select("price_usd,purchased_on, compounds(name)")
    .eq("user_id", userId);
  const rows = (data ?? []) as Array<{
    price_usd: number | string;
    purchased_on: string;
    compounds: { name: string } | { name: string }[] | null;
  }>;
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  let last30 = 0;
  let allTime = 0;
  const byName = new Map<string, number>();
  for (const r of rows) {
    const price = Number(r.price_usd);
    allTime += price;
    if (r.purchased_on >= cutoff) last30 += price;
    const c = Array.isArray(r.compounds) ? r.compounds[0] : r.compounds;
    if (c?.name) byName.set(c.name, (byName.get(c.name) ?? 0) + price);
  }
  const top = Array.from(byName.entries()).sort((a, b) => b[1] - a[1])[0];
  return { last30Usd: last30, allTimeUsd: allTime, topCompound: top?.[0] ?? null };
}
