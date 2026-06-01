"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { Card, Overline } from "@/components/kit";

interface CompoundLite {
  id: string;
  slug: string;
  name: string;
  typical_vial_mg: number | null;
}

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

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export function InventoryManager({ purchases }: { purchases: PurchaseRow[] }) {
  const router = useRouter();
  const toast = useFireToast();
  const [catalog, setCatalog] = useState<CompoundLite[]>([]);
  const [search, setSearch] = useState("");
  const [compoundId, setCompoundId] = useState<string | null>(null);
  const [compoundName, setCompoundName] = useState("");
  const [vialMg, setVialMg] = useState("");
  const [vialCount, setVialCount] = useState("1");
  const [price, setPrice] = useState("");
  const [vendor, setVendor] = useState("");
  const [purchasedOn, setPurchasedOn] = useState(today());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/compounds")
      .then((r) => r.json())
      .then((b) => b.data && setCatalog(b.data as CompoundLite[]))
      .catch(() => {});
  }, []);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [search, catalog]);

  function pick(c: CompoundLite) {
    setCompoundId(c.id);
    setCompoundName(c.name);
    setSearch("");
    if (c.typical_vial_mg) setVialMg(String(c.typical_vial_mg));
  }

  async function save() {
    if (!compoundId) return toast.error("Pick a compound.");
    if (!(Number(vialMg) > 0)) return toast.error("Enter the vial size in mg.");
    if (!(Number(price) >= 0) || price === "") return toast.error("Enter the price.");
    setBusy(true);
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compound_id: compoundId,
        vial_mg: Number(vialMg),
        vial_count: Number(vialCount) || 1,
        price_usd: Number(price),
        vendor: vendor.trim() || null,
        purchased_on: purchasedOn,
      }),
    });
    setBusy(false);
    if (res.status === 401) return router.replace("/signin?next=/peptides/inventory");
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      return toast.error(b.error?.message ?? "Could not save");
    }
    toast.success(`Logged ${compoundName}`);
    setCompoundId(null);
    setCompoundName("");
    setVialMg("");
    setVialCount("1");
    setPrice("");
    setVendor("");
    setPurchasedOn(today());
    router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete this ${name} purchase?`)) return;
    const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Could not delete");
    toast.success("Purchase deleted");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card title="Log a purchase">
        <div className="space-y-3">
          {!compoundId ? (
            <div className="space-y-2">
              <Label className="text-2xs uppercase">Compound</Label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search compounds" className="pl-9" />
              </div>
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  className="block w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-left font-[family-name:var(--font-sans)] text-sm text-[var(--fg)] hover:border-[var(--primary-line)]"
                >
                  + {c.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="font-[family-name:var(--font-sans)] text-sm font-medium text-[var(--fg)]">
                {compoundName}
              </span>
              <button type="button" onClick={() => setCompoundId(null)} className="font-[family-name:var(--font-sans)] text-2xs text-[var(--primary)] hover:underline">
                change
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-2xs uppercase">Vial (mg)</Label>
              <Input type="number" step="0.1" min={0} value={vialMg} onChange={(e) => setVialMg(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-2xs uppercase">Vials</Label>
              <Input type="number" step="1" min={1} value={vialCount} onChange={(e) => setVialCount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-2xs uppercase">Total price</Label>
              <Input type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-2xs uppercase">Vendor</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="optional" />
            </div>
            <div className="space-y-1">
              <Label className="text-2xs uppercase">Purchased</Label>
              <Input type="date" value={purchasedOn} onChange={(e) => setPurchasedOn(e.target.value)} />
            </div>
          </div>
          <Button onClick={save} disabled={busy} className="w-full gap-2">
            <Plus size={16} /> {busy ? "Saving…" : "Log purchase"}
          </Button>
        </div>
      </Card>

      <section className="space-y-2">
        <Overline>Purchase history</Overline>
        {purchases.length === 0 ? (
          <p className="rounded-[var(--r-md)] border border-dashed border-[var(--border)] bg-[var(--surface-1)] p-6 text-center font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
            No purchases logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)]">
            {purchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-[family-name:var(--font-sans)] text-sm font-medium text-[var(--fg)]">
                    {p.compound_name}
                  </p>
                  <p className="mt-0.5 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
                    {p.vial_count}× {p.vial_mg} mg
                    {p.vendor ? ` · ${p.vendor}` : ""} · {new Date(p.purchased_on).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-[var(--fg)]">
                  {usd(p.price_usd)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(p.id, p.compound_name)}
                  aria-label="Delete"
                  className="grid h-7 w-7 place-items-center rounded-[var(--r-sm)] text-[var(--fg-subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
