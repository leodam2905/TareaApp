import CustomerDiagnose from "../(customer)/customer/diagnose/page";

// Public diagnose.
//
// The tool itself never needed an account — /api/ai/diagnose is public and
// rate-limited by IP. Gating the PAGE meant a visitor who clicked "Diagnose my
// issue" hit a login wall before seeing anything Tarea can do, which is the
// wrong order: ask for the estimate first, ask for the account when they want
// to act on it. "Post this job" still points at /customer/post-job, so the sign
// up prompt lands exactly there — and middleware now carries ?next= so they
// return to posting the job they diagnosed.
//
// Re-exported rather than copied: one implementation, two routes. The <main>
// wrapper is required for day mode — see the note in app/browse/page.tsx.
// day-only: every other public page is pinned to the day palette, so without
// this Browse was the only one following the system theme -- dark while the
// rest of the site was light. Pinned on the PUBLIC wrapper, not the shared
// page component, so /customer/* keeps its dark mode.
export default function PublicDiagnosePage() {
  return (
    <main className="day-only min-h-screen">
      <div className="mx-auto w-full max-w-6xl p-4 lg:p-8">
        <CustomerDiagnose />
      </div>
    </main>
  );
}
