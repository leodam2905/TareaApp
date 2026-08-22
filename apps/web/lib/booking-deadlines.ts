// `bookings.responseDeadline` carries two different clocks over a booking's
// life: how long the pro has to accept while PENDING, then how long the
// customer has to pay once ACCEPTED. Both are 2 hours — keep them defined
// here so the two halves can never drift apart again.
export const RESPONSE_WINDOW_MS = 2 * 60 * 60 * 1000;
export const RESPONSE_WINDOW_HOURS = RESPONSE_WINDOW_MS / (60 * 60 * 1000);

export function responseDeadlineFromNow(): Date {
  return new Date(Date.now() + RESPONSE_WINDOW_MS);
}
