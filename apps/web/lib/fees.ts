// Tarea's entire take, charged to the CUSTOMER only.
//
// The pro used to pay 10% and the customer 15%. Same money, but split across
// both sides — which meant a pro's payout was a deduction from a number they
// were shown, and the customer's "15%" understated what the platform actually
// kept. One fee, one side, one number.
//
// Materials are NOT in the base: they pass through at cost with no commission,
// matching how TaskRabbit treats reimbursements. The fee applies to labour.
// 27.78%, not a round 25%, because it is what the old 15%-customer + 10%-pro
// split actually took: 1.15 / 0.90 - 1. Collapsing the two sides into one
// number was a compliance change (the pro must set a rate we do not deduct
// from); it was never meant to cut the take rate, and 25% quietly did, by
// about 10% of revenue per job. Still below Fiverr's combined ~25.5% and far
// below Rover's 25% pro-side + 11% customer-side in California.
export const CUSTOMER_FEE_RATE = 0.2778;
// Zero: the pro keeps their full rate. Kept as a named constant rather than
// deleted so handymanNet() and every payout path still read as intentional
// arithmetic, and so restoring a pro-side fee is one number rather than a
// refactor.
export const HANDYMAN_FEE_RATE = 0;

// The rate as customers must SEE it. Every fee percentage shown to a customer
// — the Stripe Checkout line item, the Terms, the ICA — derives from here.
// Three of those used to be hardcoded "15%" strings left over from the old
// split, so Checkout printed "Service Fee (15%)" beside a 27.78% amount. A
// percentage the customer reads must be the percentage the card is charged.
export const FEE_PCT = `${+(CUSTOMER_FEE_RATE * 100).toFixed(2)}%`;

export const customerTotal = (price: number) => price * (1 + CUSTOMER_FEE_RATE);
export const handymanNet = (price: number) => price * (1 - HANDYMAN_FEE_RATE);
export const platformRevenue = (price: number) => price * (CUSTOMER_FEE_RATE + HANDYMAN_FEE_RATE);
