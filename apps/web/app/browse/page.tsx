import CustomerBrowse from "../(customer)/customer/browse/page";

// Public browse. Same reasoning as /diagnose: /api/handyman/browse is already
// public, and looking at pros is how someone decides whether to sign up. The
// account is required at the point of booking, not the point of looking.
//
// Wrapped in <main> deliberately, and it is load-bearing rather than semantic:
// the page component styles itself with dark inline classes (text-white,
// bg-white/5), and globals.css restores day mode with rules SCOPED TO `main`
// (`html:not(.dark) main .text-white { ... }`). The (customer) layout supplies
// that element; the root layout does not, so re-exporting the page alone
// rendered it dark in day mode. No lg:ml-64 here -- that offset exists for the
// customer sidebar, which this route has no sidebar to clear.
// day-only: every other public page is pinned to the day palette, so without
// this Browse was the only one following the system theme -- dark while the
// rest of the site was light. Pinned on the PUBLIC wrapper, not the shared
// page component, so /customer/* keeps its dark mode.
export default function PublicBrowsePage() {
  return (
    <main className="day-only min-h-screen">
      <div className="mx-auto w-full max-w-6xl p-4 lg:p-8">
        <CustomerBrowse />
      </div>
    </main>
  );
}
