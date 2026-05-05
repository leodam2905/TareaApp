"use client";

import { useEffect, useState } from "react";
import { Plus, ToggleLeft, ToggleRight, Trash2, Tag } from "lucide-react";
import toast from "react-hot-toast";

type PromoCode = {
  id: string;
  code: string;
  discountType: "PERCENT" | "FLAT";
  discountValue: number;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

const emptyForm = {
  code: "",
  discountType: "PERCENT" as "PERCENT" | "FLAT",
  discountValue: "",
  maxUses: "",
  expiresAt: "",
};

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/promo-codes")
      .then(r => r.json())
      .then(data => { setCodes(data); setLoading(false); });
  }, []);

  const toggleActive = async (id: string, current: boolean) => {
    const res = await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    if (res.ok) {
      setCodes(prev => prev.map(c => c.id === id ? { ...c, isActive: !current } : c));
      toast.success(current ? "Code deactivated" : "Code activated");
    } else {
      toast.error("Action failed");
    }
  };

  const deleteCode = async (id: string, code: string) => {
    if (!confirm(`Delete promo code "${code}"?`)) return;
    const res = await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCodes(prev => prev.filter(c => c.id !== id));
      toast.success("Promo code deleted");
    } else {
      toast.error("Delete failed");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
      }),
    });
    const body = await res.json();
    if (res.ok) {
      toast.success("Promo code created!");
      setCodes(prev => [body, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
    } else {
      toast.error(body.error || "Failed to create code");
    }
    setSaving(false);
  };

  const formatExpiry = (dateStr: string | null) => {
    if (!dateStr) return "No expiry";
    return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Tag className="w-7 h-7 text-tarea-sky" />
            Promo Codes
          </h1>
          <p className="text-slate-400 mt-1">Create and manage discount codes for customers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-tarea-sky text-tarea-ink font-semibold px-4 py-2.5 rounded-xl hover:bg-sky-300 transition-all"
        >
          <Plus className="w-4 h-4" /> Create Code
        </button>
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">New Promo Code</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Code</label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="SAVE20"
                  className="input"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Discount Type</label>
                  <select
                    value={form.discountType}
                    onChange={e => setForm(f => ({ ...f, discountType: e.target.value as "PERCENT" | "FLAT" }))}
                    className="input"
                  >
                    <option value="PERCENT">Percent (%)</option>
                    <option value="FLAT">Flat ($)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Value</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.discountValue}
                    onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                    placeholder={form.discountType === "PERCENT" ? "20" : "10"}
                    className="input"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Max Uses (optional)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxUses}
                    onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                    placeholder="Unlimited"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Expires At (optional)</label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-tarea-sky text-tarea-ink font-semibold hover:bg-sky-300 transition-all text-sm disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-400">
          {codes.filter(c => c.isActive).length} active · {codes.filter(c => !c.isActive).length} inactive
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-400">
          {codes.reduce((sum, c) => sum + c.usesCount, 0)} total uses
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {["Code", "Type", "Value", "Uses", "Expires", "Status", "Actions"].map(h => (
                <th key={h} className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider px-5 py-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500 py-10">Loading...</td>
              </tr>
            )}
            {!loading && codes.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500 py-10">No promo codes yet — click Create Code to add one</td>
              </tr>
            )}
            {!loading && codes.map(c => (
              <tr key={c.id} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-4">
                  <span className="text-white font-mono font-bold text-sm">{c.code}</span>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.discountType === "PERCENT" ? "bg-purple-500/20 text-purple-300" : "bg-green-500/20 text-green-300"}`}>
                    {c.discountType}
                  </span>
                </td>
                <td className="px-5 py-4 text-white text-sm font-semibold">
                  {c.discountType === "PERCENT" ? `${c.discountValue}%` : `$${c.discountValue.toFixed(2)}`}
                </td>
                <td className="px-5 py-4 text-slate-300 text-sm">
                  {c.usesCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ""}
                </td>
                <td className="px-5 py-4 text-slate-300 text-sm">{formatExpiry(c.expiresAt)}</td>
                <td className="px-5 py-4">
                  <span className={c.isActive ? "badge-green" : "badge-red"}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(c.id, c.isActive)}
                      className={`p-2 rounded-lg transition-all ${c.isActive ? "text-red-400 hover:bg-red-500/10" : "text-green-400 hover:bg-green-500/10"}`}
                      title={c.isActive ? "Deactivate" : "Activate"}
                    >
                      {c.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => deleteCode(c.id, c.code)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
