// When money reaches a pro's bank.
//
// Tarea transfers a pro's earnings into their connected account the moment a
// job completes, so the balance is theirs immediately — but the second hop,
// Stripe -> their bank, runs on the connected account's own payout schedule.
//
// DAILY, which is also Stripe's default for US Express accounts. It does not
// mean a deposit every day: Stripe pays out each business day on which cleared
// funds exist, so a pro with three jobs in a week gets three deposits, each
// about two business days after the job, and a pro with none gets nothing.
//
// Weekly-on-Monday was tried first, for one tidy deposit covering the week. It
// was the wrong trade: it added up to six days on top of the settlement wait a
// pro already cannot avoid — a Tuesday job would sit until the following
// Monday — in exchange for a cleaner bank statement nobody asked for. For
// somebody self-employed, sooner beats tidier.
//
// This does not affect access to the money. Earnings land in the connected
// balance at completion; the schedule only governs the free automatic transfer
// out to the bank.
export const PAYOUT_SCHEDULE = {
  interval: "daily",
} as const;
