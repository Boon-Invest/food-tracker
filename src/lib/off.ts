// Open Food Facts lookup (production server, keyless).
export interface OffResult {
  name: string;
  brand?: string;
  basis: 'per100g' | 'per100ml';
  kcal: number | null;
  protein: number | null;
  serving?: { label: string; amount: number };
}

export type OffOutcome = { status: 'found'; product: OffResult } | { status: 'notfound' } | { status: 'offline' };

const FIELDS = 'product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,quantity,product_quantity_unit';

export function mapOffProduct(p: Record<string, unknown>): OffResult {
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    const x = typeof v === 'string' ? parseFloat(v) : (v as number);
    return typeof x === 'number' && isFinite(x) ? x : null;
  };
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj !== null) kcal = kj / 4.184;
  }
  const protein = num(n['proteins_100g']);
  const qtyText = `${p.quantity ?? ''} ${p.product_quantity_unit ?? ''}`.toLowerCase();
  const basis: 'per100g' | 'per100ml' = /\b(ml|cl|l|litre|liter)\b|\d(ml|cl|l)\b/.test(qtyText) ? 'per100ml' : 'per100g';
  const servingQty = num(p.serving_quantity);
  const servingSize = typeof p.serving_size === 'string' ? p.serving_size.trim() : '';
  const brand = typeof p.brands === 'string' ? p.brands.split(',')[0].trim() : undefined;
  const name = String(p.product_name_en || p.product_name || '').trim();
  return {
    name,
    brand: brand || undefined,
    basis,
    kcal: kcal === null ? null : Math.round(kcal),
    protein: protein === null ? null : Math.round(protein * 10) / 10,
    serving: servingQty && servingQty > 0 ? { label: servingSize || `1 serving (${servingQty}${basis === 'per100ml' ? 'ml' : 'g'})`, amount: servingQty } : undefined
  };
}

export async function lookupBarcode(barcode: string, timeoutMs = 8000): Promise<OffOutcome> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      signal: ctrl.signal
    });
    if (res.status === 404) return { status: 'notfound' };
    if (!res.ok) return { status: 'offline' };
    const data = await res.json();
    if (data.status !== 1 || !data.product) return { status: 'notfound' };
    return { status: 'found', product: mapOffProduct(data.product) };
  } catch {
    return { status: 'offline' };
  } finally {
    clearTimeout(t);
  }
}
