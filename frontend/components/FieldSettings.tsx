"use client";

import { useEffect, useState } from "react";
import { createField, deleteField, updateField } from "@/lib/api";
import { FieldType, IndustryKey, IndustryMeta } from "@/lib/types";

export default function FieldSettings({
  industries,
  onRefresh,
}: {
  industries: Record<IndustryKey, IndustryMeta>;
  onRefresh: () => Promise<void>;
}) {
  const [industry, setIndustry] = useState<IndustryKey>(Object.keys(industries)[0] as IndustryKey);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!industries[industry]) {
      const first = Object.keys(industries)[0] as IndustryKey | undefined;
      if (first) setIndustry(first);
    }
  }, [industries, industry]);

  async function refresh() {
    setMessage(null);
    await onRefresh();
  }

  async function handleAdd() {
    if (!label.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await createField(industry, { label, type, key: key || undefined });
      setLabel("");
      setKey("");
      setType("text");
      await refresh();
      setMessage("Field added. The live frontend schema has been updated.");
    } catch (e: any) {
      setMessage(e.message || "Could not add field.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(field: any) {
    setBusy(true);
    setMessage(null);
    try {
      await updateField(industry, field.id, { label: field.label, type: field.type });
      await refresh();
      setMessage("Field updated.");
    } catch (e: any) {
      setMessage(e.message || "Could not update field.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(field: any) {
    if (!window.confirm(`Hide “${field.label}” from ${industries[industry].label}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteField(industry, field.id);
      await refresh();
      setMessage("Field removed from the live schema.");
    } catch (e: any) {
      setMessage(e.message || "Could not remove field.");
    } finally {
      setBusy(false);
    }
  }

  const fields = industries[industry]?.fields || [];

  return (
    <div className="bg-white rounded-2xl shadow-card border border-line/50 p-6 sm:p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Live schema</p>
          <h2 className="font-display font-semibold text-2xl text-ink">Field Settings</h2>
          <p className="text-inksoft text-sm mt-1 max-w-2xl">Add, rename, or change fields without code changes. The next PDF extraction uses the current schema automatically.</p>
        </div>
        <select value={industry} onChange={(e) => setIndustry(e.target.value as IndustryKey)} className="border border-line rounded-xl px-3 py-2.5 text-sm bg-white">
          {Object.entries(industries).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_0.8fr_1fr_auto] gap-3 mb-6">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Field label (e.g. Claim Amount)" className="border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        <select value={type} onChange={(e) => setType(e.target.value as FieldType)} className="border border-line rounded-xl px-3 py-2.5 text-sm bg-white">
          <option value="text">Text</option><option value="date">Date</option><option value="number">Number</option>
        </select>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Optional key" className="border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        <button disabled={busy || !label.trim()} onClick={handleAdd} className="btn-gradient rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50">Add Field</button>
      </div>

      {message && <div className="mb-5 rounded-xl border border-primary/20 bg-primarysoft px-4 py-3 text-sm text-ink">{message}</div>}

      <div className="space-y-3">
        {fields.map((field) => {
          const editable = { ...field };
          return (
            <div key={field.id || field.key} className="grid grid-cols-1 md:grid-cols-[1fr_180px_140px_auto] gap-3 items-center border border-line rounded-xl p-3">
              <input defaultValue={field.label} onChange={(e) => { editable.label = e.target.value; (e.currentTarget as any)._value = e.target.value; }} className="border border-line rounded-lg px-3 py-2 text-sm" />
<select
  defaultValue={field.type}
  onChange={(e) => {
    editable.type = e.target.value as FieldType;
  }}
  className="border border-line rounded-lg px-3 py-2 text-sm bg-white"
>                <option value="text">Text</option><option value="date">Date</option><option value="number">Number</option>
              </select>
              <span className="font-mono text-xs text-inksoft truncate">{field.key}</span>
              <div className="flex gap-2 justify-end">
                <button disabled={busy} onClick={(e) => {
                  const row = e.currentTarget.closest("div.grid");
                  const labelInput = row?.querySelector("input") as HTMLInputElement | null;
                  const typeInput = row?.querySelector("select") as HTMLSelectElement | null;
                  handleUpdate({ ...field, label: labelInput?.value || field.label, type: typeInput?.value || field.type });
                }} className="border border-line rounded-lg px-3 py-2 text-xs font-semibold hover:border-primary hover:text-primary">Save</button>
                <button disabled={busy} onClick={() => handleDelete(field)} className="border border-red-200 text-red-600 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-red-50">Hide</button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-inksoft mt-5">No login is required in this MVP, so field changes are shared globally. Use authentication before exposing schema management publicly.</p>
    </div>
  );
}
