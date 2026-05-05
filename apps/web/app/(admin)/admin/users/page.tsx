"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, UserCheck, UserX, Search } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";

type User = {
  id: string; name: string; email: string; role: string;
  isActive: boolean; isVerified: boolean; createdAt: string; phone?: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users").then(r => r.json()).then(data => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  const patch = async (id: string, body: object) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u));
    } else toast.error("Action failed");
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "ALL" || u.role === filter;
    return matchSearch && matchFilter;
  });

  const roleColor: Record<string, string> = {
    CUSTOMER: "badge-sky", HANDYMAN: "badge-yellow", ADMIN: "badge-red",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Users</h1>
        <p className="text-slate-400 mt-1">Manage all platform users</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-tarea-sky"
          />
        </div>
        {["ALL", "CUSTOMER", "HANDYMAN", "ADMIN"].map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === r ? "bg-tarea-sky text-tarea-ink" : "bg-white/5 text-slate-400 hover:text-white"}`}>
            {r}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {["User", "Role", "Status", "Joined", "Actions"].map(h => (
                <th key={h} className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider px-5 py-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={5} className="text-center text-slate-500 py-10">Loading...</td></tr>
            )}
            {!loading && filtered.map(u => (
              <tr key={u.id} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-tarea-sky/20 rounded-full flex items-center justify-center text-tarea-sky font-bold text-sm">
                      {u.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{u.name}</p>
                      <p className="text-slate-400 text-xs">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={roleColor[u.role] || "badge"}>{u.role}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <span className={u.isActive ? "badge-green" : "badge-red"}>{u.isActive ? "Active" : "Suspended"}</span>
                    {u.isVerified && <span className="badge-sky">Verified</span>}
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-400 text-sm">{formatDate(u.createdAt)}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => { patch(u.id, { isActive: !u.isActive }); toast.success(u.isActive ? "User suspended" : "User reactivated"); }}
                      title={u.isActive ? "Suspend" : "Reactivate"}
                      className={`p-2 rounded-lg transition-all ${u.isActive ? "text-red-400 hover:bg-red-500/10" : "text-green-400 hover:bg-green-500/10"}`}>
                      {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { patch(u.id, { isVerified: !u.isVerified }); toast.success(u.isVerified ? "Verification removed" : "User verified"); }}
                      title={u.isVerified ? "Remove verification" : "Verify"}
                      className={`p-2 rounded-lg transition-all ${u.isVerified ? "text-slate-400 hover:bg-white/5" : "text-tarea-sky hover:bg-tarea-sky/10"}`}>
                      {u.isVerified ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-500 py-10">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
