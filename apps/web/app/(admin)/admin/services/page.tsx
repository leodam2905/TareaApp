"use client";

import { useEffect, useState } from "react";
import { ToggleLeft, ToggleRight, Search, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency, SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";

type Service = {
  id: string; title: string; category: string;
  minPrice: number; maxPrice: number; isActive: boolean;
  handyman: { user: { name: string; email: string } };
};


const CATEGORIES = [
  "PLUMBING","ELECTRICAL","CARPENTRY","PAINTING",
  "CLEANING","HVAC","ROOFING","LANDSCAPING",
  "MOVING","APPLIANCE_REPAIR","GENERAL",
];

const emptyForm = {
  title: "", description: "",
  category: "GENERAL", minPrice: "", maxPrice: "", duration: "60",
};

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/services").then(r => r.json()).then(s => {
      setServices(s);
      setLoading(false);
    });
  }, []);

  const toggle = async (id: string, current: boolean) => {
    const res = await fetch(`/api/admin/services/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    if (res.ok) {
      setServices(prev => prev.map(s => s.id === id ? { ...s, isActive: !current } : s));
      toast.success(current ? "Service paused" : "Service activated");
    } else toast.error("Action failed");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/services", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json();
    if (res.ok) {
      toast.success("Service created and visible to all handymen!");
      setForm(emptyForm);
      setShowForm(false);
      fetch("/api/admin/services").then(r => r.json()).then(setServices);
    } else {
      toast.error(body.error || "Failed to create service");
    }
    setSaving(false);
  };

  const filtered = services.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.handyman.user.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Services</h1>
          <p className="text-slate-400 mt-1">Manage all handyman service listings</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-tarea-sky text-tarea-ink font-semibold px-4 py-2.5 rounded-xl hover:bg-sky-300 transition-all">
          <Plus className="w-4 h-4" /> New Service
        </button>
      </div>

      {/* Create service modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-tarea-dark border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">New Service</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="bg-tarea-sky/10 border border-tarea-sky/30 rounded-xl px-4 py-3 text-tarea-sky text-sm">
                📢 This service will be added to <strong>all handymen</strong> and they will be notified.
              </div>

              {/* Title */}
              <div>
                <label className="label">Service Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Emergency Plumbing Repair" className="input" required />
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the service..." className="input resize-none h-20" required />
              </div>

              {/* Category */}
              <div>
                <label className="label">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="input">
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>

              {/* Price range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Min Price ($)</label>
                  <input type="number" min="0" value={form.minPrice}
                    onChange={e => setForm(f => ({ ...f, minPrice: e.target.value }))}
                    placeholder="50" className="input" required />
                </div>
                <div>
                  <label className="label">Max Price ($)</label>
                  <input type="number" min="0" value={form.maxPrice}
                    onChange={e => setForm(f => ({ ...f, maxPrice: e.target.value }))}
                    placeholder="200" className="input" required />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="label">Duration (minutes)</label>
                <input type="number" min="15" step="15" value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                  placeholder="60" className="input" required />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-tarea-sky text-tarea-ink font-semibold hover:bg-sky-300 transition-all text-sm disabled:opacity-50">
                  {saving ? "Creating..." : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search + stats */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or handyman..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-tarea-sky" />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-400">
          {services.filter(s => s.isActive).length} active · {services.filter(s => !s.isActive).length} paused
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {["Service", "Handyman", "Category", "Price Range", "Status", "Toggle"].map(h => (
                <th key={h} className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider px-5 py-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && <tr><td colSpan={6} className="text-center text-slate-500 py-10">Loading...</td></tr>}
            {!loading && filtered.map(s => (
              <tr key={s.id} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-4">
                  <p className="text-white text-sm font-medium">{s.title}</p>
                </td>
                <td className="px-5 py-4">
                  {s.handyman ? (
                    <>
                      <p className="text-white text-sm">{s.handyman.user.name}</p>
                      <p className="text-slate-500 text-xs">{s.handyman.user.email}</p>
                    </>
                  ) : (
                    <span className="badge-sky">📢 All Handymen</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className="text-slate-300 text-sm flex items-center gap-2">
                    <CategoryIcon catKey={s.category} className="w-4 h-4 flex-shrink-0" />
                    {SERVICE_CATEGORY_LABELS[s.category] || s.category}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-slate-300">
                  {formatCurrency(s.minPrice)} – {formatCurrency(s.maxPrice)}
                </td>
                <td className="px-5 py-4">
                  <span className={s.isActive ? "badge-green" : "badge-red"}>
                    {s.isActive ? "Active" : "Paused"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <button onClick={() => toggle(s.id, s.isActive)}
                    className={`p-2 rounded-lg transition-all ${s.isActive ? "text-red-400 hover:bg-red-500/10" : "text-green-400 hover:bg-green-500/10"}`}>
                    {s.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-500 py-10">No services yet — click New Service to add one</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
