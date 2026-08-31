"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

// Fix the address on a held job, then publish it.
//
// The address fields are pre-filled with what the customer typed, because the
// fault is nearly always a single wrong character in it and retyping the whole
// thing invites a second mistake. Publishing is not a status toggle: the server
// geocodes the corrected text and refuses to publish if it still does not
// resolve, so a job can never go live without a location.
export default function PublishDraft({
  jobId,
  address,
  city,
}: {
  jobId: string;
  address: string;
  city: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [addr, setAddr] = useState(address);
  const [town, setTown] = useState(city);
  const [busy, setBusy] = useState(false);

  async function publish() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/job-requests/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, city: town }),
      });
      const data = await res.json();
      if (res.ok && data.published) {
        toast.success(
          data.notified > 0
            ? `Published — ${data.notified} pro${data.notified === 1 ? "" : "s"} notified`
            : "Published, but no pro matched this job",
        );
        setOpen(false);
        router.refresh();
      } else {
        // The address was still saved, so say that rather than implying nothing
        // happened — the next attempt starts from the corrected text.
        toast.error(data.error ?? "Could not publish");
        router.refresh();
      }
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
      >
        Fix address & publish
      </button>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <input
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        placeholder="Street address"
        aria-label="Street address"
        className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-600 min-w-[16rem]"
      />
      <input
        value={town}
        onChange={(e) => setTown(e.target.value)}
        placeholder="City"
        aria-label="City"
        className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-600 w-40"
      />
      <button
        onClick={publish}
        disabled={busy || !addr.trim() || !town.trim()}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
      >
        {busy ? "Checking address…" : "Publish"}
      </button>
      <button
        onClick={() => setOpen(false)}
        disabled={busy}
        className="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
