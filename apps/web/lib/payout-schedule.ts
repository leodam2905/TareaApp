// When money reaches a pro's bank.
//
// Tarea transfers a pro's earnings into their connected account the moment a
// job completes, so the balance is theirs immediately — but the second hop,
// Stripe -> their bank, runs on the connected account's own payout schedule.
// Left unset, Stripe defaults US Express accounts to DAILY, which meant a pro's
// bank account saw a trickle of small deposits at unpredictable times.
//
// Weekly on Monday instead: one predictable deposit covering the week's work,
// which is what a self-employed tradesperson can actually plan around, and it
// lines up with the Monday sweep in /api/cron/weekly-payouts so a pro sees one
// payout rather than two arriving on different days.
//
// This does NOT delay their access to the money. Earnings land in the connected
// balance at completion, and instant cashout draws on that balance any day of
// the week — Monday is when the free, automatic bank transfer runs.
export const PAYOUT_SCHEDULE = {
  interval: "weekly",
  weekly_anchor: "monday",
} as const;
