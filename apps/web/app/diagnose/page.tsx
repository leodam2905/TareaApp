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
export default function PublicDiagnosePage() {
  return (
    <main className="p-4 lg:p-8">
      <CustomerDiagnose />
    </main>
  );
}
