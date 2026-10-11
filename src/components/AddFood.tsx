import { useCallback, useState } from 'react';
import { BackIcon, ScanIcon } from './Icons';
import { Scanner } from './Scanner';
import { db } from '../db';
import type { Basis, Food } from '../types';
import { createFood, saveFood } from '../store';
import { lookupBarcode } from '../lib/off';
import { uid } from '../lib/id';

export type AddMode = 'scan' | 'quick' | 'manual';
export type AddResult = { food: Food; action: 'log' | 'save' | 'existing' };

interface Props {
  mode: AddMode;
  initialName?: string;
  editFood?: Food;
  /** Confirm-sheet route: a single button that saves and hands the food back. */
  pickOnly?: boolean;
  onDone: (r: AddResult | null) => void;
}

interface PortionRow {
  id?: string;
  label: string;
  amount: string;
}

export function AddFood({ mode: initialMode, initialName, editFood, pickOnly, onDone }: Props) {
  const [mode, setMode] = useState<AddMode>(editFood ? 'manual' : initialMode);
  const [scanning, setScanning] = useState(initialMode === 'scan' && !editFood);
  const [banner, setBanner] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState(editFood?.name ?? initialName ?? '');
  const [brand, setBrand] = useState(editFood?.brand ?? '');
  const [barcode, setBarcode] = useState(editFood?.barcode ?? '');
  const [kcal, setKcal] = useState(editFood ? String(editFood.kcal) : '');
  const [protein, setProtein] = useState(editFood ? String(editFood.protein) : '');
  const [basis, setBasis] = useState<Basis>(editFood?.basis ?? 'per100g');
  const [qtyLabel, setQtyLabel] = useState('1 serving');
  const [portions, setPortions] = useState<PortionRow[]>(
    editFood ? editFood.portions.map((p) => ({ id: p.id, label: p.label, amount: String(p.amount) })) : []
  );
  const [aliases, setAliases] = useState(editFood?.aliases.join(', ') ?? '');
  const [source, setSource] = useState<Food['source']>(editFood?.source ?? 'manual');

  const onScan = useCallback(async (code: string) => {
    setScanning(false);
    setBarcode(code);
    const cached = await db.foods.where('barcode').equals(code).first();
    if (cached && !cached.archived) {
      onDone({ food: cached, action: 'existing' });
      return;
    }
    setBusy(true);
    setBanner({ text: 'Looking up Open Food Facts…' });
    const res = await lookupBarcode(code);
    setBusy(false);
    setMode('manual');
    if (res.status === 'found') {
      const p = res.product;
      setName(p.name);
      setBrand(p.brand ?? '');
      setBasis(p.basis);
      setKcal(p.kcal === null ? '' : String(p.kcal));
      setProtein(p.protein === null ? '' : String(p.protein));
      const unit = p.basis === 'per100ml' ? 'ml' : 'g';
      const rows: PortionRow[] = [];
      if (p.serving) rows.push({ label: p.serving.label, amount: String(p.serving.amount) });
      rows.push({ label: `100${unit}`, amount: '100' });
      setPortions(rows);
      setSource('off');
      setBanner({ text: p.kcal === null || p.protein === null ? 'Found, but some values are missing. Check the label.' : 'Found on Open Food Facts. Check it against the label, then save.' });
    } else if (res.status === 'notfound') {
      setSource('manual');
      setBanner({ text: 'Not on Open Food Facts. Enter it from the label, the barcode is saved.', err: true });
    } else {
      setSource('manual');
      setBanner({ text: "Couldn't reach Open Food Facts, enter it manually. The barcode is saved.", err: true });
    }
  }, [onDone]);

  const k = parseFloat(kcal);
  const p = parseFloat(protein);
  const valid = name.trim().length > 0 && k >= 0 && p >= 0 && !isNaN(k) && !isNaN(p);

  const submit = async (action: 'log' | 'save') => {
    if (!valid) return;
    const isQuick = mode === 'quick' && !editFood;
    const b: Basis = isQuick ? 'perItem' : basis;
    const rows = isQuick
      ? [{ label: qtyLabel.trim() || '1 serving', amount: '1' }]
      : portions.filter((r) => r.label.trim() && parseFloat(r.amount) > 0);
    const aliasList = aliases.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
    if (editFood) {
      const ps = rows.map((r) => ({ id: r.id ?? uid(), label: r.label.trim(), amount: parseFloat(r.amount) }));
      if (!ps.length) ps.push({ id: uid(), label: b === 'perItem' ? '1 item' : b === 'per100ml' ? '100ml' : '100g', amount: b === 'perItem' ? 1 : 100 });
      const food: Food = {
        ...editFood,
        name: name.trim(),
        brand: brand.trim() || undefined,
        barcode: barcode || undefined,
        basis: b,
        kcal: k,
        protein: Math.round(p * 10) / 10,
        portions: ps,
        defaultPortionId: ps.some((x) => x.id === editFood.defaultPortionId) ? editFood.defaultPortionId : ps[0].id,
        aliases: aliasList
      };
      await saveFood(food);
      onDone({ food, action: 'save' });
      return;
    }
    const food = await createFood({
      name,
      brand,
      barcode,
      basis: b,
      kcal: k,
      protein: Math.round(p * 10) / 10,
      portions: rows.map((r) => ({ label: r.label.trim(), amount: parseFloat(r.amount) })),
      source: isQuick ? 'manual' : source,
      aliases: aliasList
    });
    onDone({ food, action });
  };

  const unitWord = basis === 'perItem' ? 'item' : basis === 'per100ml' ? '100ml' : '100g';

  return (
    <div className="overlay">
      <div className="overlay-inner">
        <div className="topbar">
          <button className="icon-btn" onClick={() => onDone(null)} aria-label="Back"><BackIcon /></button>
          <h1>{editFood ? 'Edit food' : 'Add food'}</h1>
          <span style={{ width: 40 }} />
        </div>

        {!editFood && (
          <div className="seg">
            <button className={scanning || mode === 'scan' ? 'on' : ''} onClick={() => { setMode('scan'); setScanning(true); setBanner(null); }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ScanIcon /> Scan</span>
            </button>
            <button className={!scanning && mode === 'quick' ? 'on' : ''} onClick={() => { setMode('quick'); setScanning(false); }}>Quick add</button>
            <button className={!scanning && mode === 'manual' ? 'on' : ''} onClick={() => { setMode('manual'); setScanning(false); }}>Detailed</button>
          </div>
        )}

        {scanning ? (
          <Scanner onDetected={onScan} onCancel={() => { setScanning(false); setMode('quick'); }} />
        ) : mode === 'scan' && busy ? (
          <div className="empty">Looking up…</div>
        ) : (
          <>
            {banner && <div className={'banner' + (banner.err ? ' err' : '')}>{banner.text}</div>}
            <div className="field">
              <label>Name</label>
              <input value={name} autoFocus={!name} placeholder="e.g. Chicken wrap" onChange={(e) => setName(e.target.value)} />
            </div>

            {mode === 'manual' && (
              <>
                <div className="field">
                  <label>Brand (optional)</label>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div className="seg">
                  {(['per100g', 'per100ml', 'perItem'] as Basis[]).map((x) => (
                    <button key={x} className={basis === x ? 'on' : ''} onClick={() => setBasis(x)}>
                      {x === 'per100g' ? 'Per 100g' : x === 'per100ml' ? 'Per 100ml' : 'Per item'}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="field-row">
              <div className="field">
                <label>Calories {mode === 'manual' || editFood ? `per ${unitWord}` : ''}</label>
                <input inputMode="decimal" value={kcal} placeholder="kcal" onChange={(e) => setKcal(e.target.value)} />
              </div>
              <div className="field">
                <label>Protein (g) {mode === 'manual' || editFood ? `per ${unitWord}` : ''}</label>
                <input inputMode="decimal" value={protein} placeholder="g" onChange={(e) => setProtein(e.target.value)} />
              </div>
            </div>

            {mode === 'quick' && !editFood && (
              <div className="field">
                <label>Quantity</label>
                <input value={qtyLabel} placeholder="e.g. 1 pack" onChange={(e) => setQtyLabel(e.target.value)} />
              </div>
            )}

            {mode === 'manual' && (
              <div className="field">
                <label>Portions (optional)</label>
                {portions.map((r, i) => (
                  <div className="field-row" key={i} style={{ marginBottom: 6 }}>
                    <input value={r.label} placeholder="Label, e.g. 1 pot" onChange={(e) => setPortions(portions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <input
                      inputMode="decimal"
                      value={r.amount}
                      placeholder={basis === 'perItem' ? '× items' : basis === 'per100ml' ? 'ml' : 'grams'}
                      onChange={(e) => setPortions(portions.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                    />
                    <button className="x" style={{ flex: '0 0 36px' }} onClick={() => setPortions(portions.filter((_, j) => j !== i))} aria-label="Remove portion">×</button>
                  </div>
                ))}
                <button className="link" onClick={() => setPortions([...portions, { label: '', amount: '' }])}>+ Add portion</button>
                {portions.length === 0 && <div className="tiny muted">With no portions, a {basis === 'perItem' ? '1 item' : basis === 'per100ml' ? '100ml' : '100g'} portion is created.</div>}
              </div>
            )}

            {editFood && (
              <div className="field">
                <label>Voice aliases (comma separated)</label>
                <input value={aliases} onChange={(e) => setAliases(e.target.value)} />
              </div>
            )}

            {barcode && <div className="tiny muted" style={{ marginBottom: 10 }}>Barcode {barcode}</div>}

            {editFood ? (
              <>
                <button className="btn primary block" disabled={!valid} onClick={() => submit('save')}>Save changes</button>
                <div className="tiny muted" style={{ marginTop: 8 }}>Past log entries keep the values they were logged with.</div>
                <div className="spacer" />
                <button
                  className="btn danger block"
                  onClick={async () => {
                    await saveFood({ ...editFood, archived: !editFood.archived });
                    onDone({ food: editFood, action: 'save' });
                  }}
                >
                  {editFood.archived ? 'Unarchive' : 'Archive (hide from lists)'}
                </button>
              </>
            ) : pickOnly ? (
              <button className="btn primary block" disabled={!valid} onClick={() => submit('save')}>Save and use</button>
            ) : (
              <div className="btn-row">
                <button className="btn" disabled={!valid} onClick={() => submit('save')}>Save to library only</button>
                <button className="btn primary" disabled={!valid} onClick={() => submit('log')}>Save and log</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
