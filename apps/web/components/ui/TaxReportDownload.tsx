"use client";

import { useState } from "react";
import { FileDown, Loader2, Receipt } from "lucide-react";

export default function TaxReportDownload() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => currentYear - i);
  const [year, setYear] = useState(currentYear);
  const [downloading, setDownloading] = useState(false);
  const [summary, setSummary] = useState<{
    jobCount: number;
    grossEarnings: number;
    netEarnings: number;
    platformFees: number;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadSummary = async (y: number) => {
    setSummary(null);
    setLoaded(false);
    const res = await fetch(`/api/handyman/tax-report?year=${y}`);
    if (res.ok) {
      const data = await res.json();
      setSummary({
        jobCount: data.jobCount,
        grossEarnings: data.grossEarnings,
        netEarnings: data.netEarnings,
        platformFees: data.platformFees,
      });
      setLoaded(true);
    }
  };

  const handleYearChange = (y: number) => {
    setYear(y);
    setLoaded(false);
    setSummary(null);
  };

  const downloadCSV = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/handyman/tax-report?year=${year}&format=csv`);
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tarea-earnings-${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Receipt className="w-5 h-5 text-violet-400" />
        <div>
          <h2 className="text-lg font-bold text-white">Annual Tax Report</h2>
          <p className="text-slate-400 text-sm">Download your earnings for tax / 1099 filing</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-slate-400 text-sm">Tax year</label>
          <select
            value={year}
            onChange={e => handleYearChange(Number(e.target.value))}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-tarea-sky"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {!loaded ? (
          <button
            onClick={() => loadSummary(year)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500/20 border border-violet-500/30 text-violet-400 rounded-xl text-sm font-semibold hover:bg-violet-500/30 transition-all"
          >
            Preview {year}
          </button>
        ) : (
          <button
            onClick={downloadCSV}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-tarea-sky text-tarea-ink rounded-xl text-sm font-bold hover:bg-sky-300 transition-all disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {downloading ? "Downloading…" : "Download CSV"}
          </button>
        )}
      </div>

      {loaded && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/10">
          {[
            { label: "Jobs Completed", value: String(summary.jobCount), color: "text-white" },
            { label: "Gross Earnings", value: fmt(summary.grossEarnings), color: "text-emerald-400" },
            { label: "Platform Fees", value: fmt(summary.platformFees), color: "text-red-400" },
            { label: "Your Net Pay", value: fmt(summary.netEarnings), color: "text-tarea-sky" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/5 rounded-xl p-3">
              <p className="text-slate-400 text-xs mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
          {summary.netEarnings >= 600 && (
            <div className="col-span-2 md:col-span-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <p className="text-amber-400 text-xs font-semibold">
                ⚠ You earned over $600 in {year} — you may receive a 1099-NEC from Tarea. Keep the downloaded CSV for your records.
              </p>
            </div>
          )}
        </div>
      )}

      {loaded && summary && summary.jobCount === 0 && (
        <p className="text-slate-500 text-sm text-center py-2">No completed jobs in {year}.</p>
      )}
    </div>
  );
}
