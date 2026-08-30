"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight, X, Check, DollarSign, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

const CATEGORIES = [
  { key: "PLUMBING",         emoji: "🔧", label: "Plumbing"         },
  { key: "ELECTRICAL",       emoji: "⚡", label: "Electrical"       },
  { key: "CARPENTRY",        emoji: "🔨", label: "Carpentry"        },
  { key: "PAINTING",         emoji: "🎨", label: "Painting"         },
  { key: "CLEANING",         emoji: "🧹", label: "Cleaning"         },
  { key: "HVAC",             emoji: "❄️", label: "HVAC"             },
  { key: "ROOFING",          emoji: "🏠", label: "Roofing"          },
  { key: "LANDSCAPING",      emoji: "🌿", label: "Landscaping"      },
  { key: "MOVING",           emoji: "📦", label: "Moving"           },
  { key: "APPLIANCE_REPAIR", emoji: "🔌", label: "Appliance Repair" },
  { key: "GENERAL",          emoji: "🛠️", label: "General"          },
];

type Service = {
  id: string;
  title: string;
  description: string;
  category: string;
  hourlyRate: number | null;
  duration: number;
  isActive: boolean;
};

const EMPTY_FORM = { title: "", description: "", category: "PLUMBING", hourlyRate: "", duration: "" };

export default function HandymanServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services?mine=1&limit=100")
      .then(r => r.json())
      .then(d => setServices(Array.isArray(d.services) ? d.services : []))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      title: s.title,
      description: s.description,
      category: s.category,
      hourlyRate: s.hourlyRate != null ? String(s.hourlyRate) : "",
      duration: String(s.duration),
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); };

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error("Title and description required"); return; }
    const rate = parseFloat(form.hourlyRate);
    const dur = parseInt(form.duration);
    if (isNaN(rate) || rate <= 0) { toast.error("Enter your hourly rate for this category"); return; }
    if (isNaN(dur) || dur <= 0) { toast.error("Enter a valid duration"); return; }

    setSaving(true);
    const body = { title: form.title.trim(), description: form.description.trim(), category: form.category, hourlyRate: rate, duration: dur };

    try {
      if (editing) {
        const res = await fetch(`/api/services/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const updated = await res.json();
        setServices(prev => prev.map(s => s.id === editing.id ? { ...s, ...updated } : s));
        toast.success("Service updated");
      } else {
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const created = await res.json();
        setServices(prev => [created, ...prev]);
        toast.success("Service added");
      }
      closeForm();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  };

  const toggleActive = async (s: Service) => {
    const prev = [...services];
    setServices(ss => ss.map(x => x.id === s.id ? { ...x, isActive: !x.isActive } : x));
    const res = await fetch(`/api/services/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    if (!res.ok) { setServices(prev); toast.error("Failed to update"); }
    else toast.success(s.isActive ? "Service paused" : "Service activated");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this service? This cannot be undone.")) return;
    setDeleting(id);
    const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
    if (res.ok) {
      setServices(prev => prev.filter(s => s.id !== id));
      toast.success("Service deleted");
    } else {
      toast.error("Could not delete service");
    }
    setDeleting(null);
  };

  const field = "w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">My Services</h1>
          <p className="text-slate-400 mt-1">Manage the services you offer to customers</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-tarea-sky text-tarea-ink font-bold px-4 py-2.5 rounded-xl hover:bg-sky-300 transition-all">
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white/5 border border-tarea-sky/30 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">{editing ? "Edit Service" : "New Service"}</h2>
              <button onClick={closeForm} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5">Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value)}
                className={field + " cursor-pointer"}>
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5">Title</label>
              <input value={form.title} onChange={e => set("title", e.target.value)}
                placeholder="e.g. Emergency Pipe Repair" className={field} />
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="Describe what's included in this service…" rows={3}
                className={field + " resize-none"} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-tarea-sky" /> Your rate ($/hr)
                </label>
                <input type="number" min="0" value={form.hourlyRate} onChange={e => set("hourlyRate", e.target.value)}
                  placeholder="75" className={field} />
                <p className="text-slate-500 text-xs mt-1">One rate for this category. Customers see it before they book.</p>
              </div>
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-tarea-sky" /> Duration (min)
                </label>
                <input type="number" min="0" value={form.duration} onChange={e => set("duration", e.target.value)}
                  placeholder="60" className={field} />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 bg-tarea-sky text-tarea-ink font-bold px-5 py-2.5 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Saving…" : "Save Service"}
              </button>
              <button onClick={closeForm} className="px-5 py-2.5 rounded-xl border border-white/20 text-slate-300 hover:text-white hover:border-white/40 transition-all text-sm font-medium">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Services list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-tarea-sky animate-spin" /></div>
      ) : services.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-16 text-center space-y-3">
          <p className="text-2xl">🛠️</p>
          <p className="text-white font-semibold">No services yet</p>
          <p className="text-slate-400 text-sm">Add your first service so customers can book you.</p>
          <button onClick={openNew} className="btn-secondary mt-2">Add Service</button>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((s, i) => {
            const cat = CATEGORIES.find(c => c.key === s.category);
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div className={`p-5 border rounded-2xl transition-all ${s.isActive ? "bg-white/5 border-white/10" : "bg-white/2 border-white/5 opacity-60"}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-tarea-sky/10 border border-tarea-sky/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                      {cat?.emoji || "🛠️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white font-bold">{s.title}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{cat?.label}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => toggleActive(s)} title={s.isActive ? "Pause" : "Activate"}
                            className="text-slate-400 hover:text-tarea-sky transition-colors">
                            {s.isActive
                              ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                              : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button onClick={() => openEdit(s)} title="Edit"
                            className="text-slate-400 hover:text-tarea-sky transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => remove(s.id)} disabled={deleting === s.id} title="Delete"
                            className="text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50">
                            {deleting === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm mt-1.5 line-clamp-2">{s.description}</p>
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        <span className="text-tarea-sky font-semibold">{s.hourlyRate != null ? `${formatCurrency(s.hourlyRate)}/hr` : "Rate not set"}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.duration} min</span>
                        <span className={s.isActive ? "text-emerald-400" : "text-slate-500"}>{s.isActive ? "Active" : "Paused"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
