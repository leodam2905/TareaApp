// 15% fee charged to customer on top of service price
// 10% fee deducted from handyman payout
// Tarea's entire take, charged to the CUSTOMER only.
//
// The pro used to pay 10% and the customer 15%. Same money, but split across
// both sides — which meant a pro's payout was a deduction from a number they
// were shown, and the customer's "15%" understated what the platform actually
// kept. One fee, one side, one number.
//
// Materials are NOT in the base: they pass through at cost with no commission,
// matching how TaskRabbit treats reimbursements. The fee applies to labour.
export const CUSTOMER_FEE_RATE = 0.25;
// Zero: the pro keeps their full rate. Kept as a named constant rather than
// deleted so handymanNet() and every payout path still read as intentional
// arithmetic, and so restoring a pro-side fee is one number rather than a
// refactor.
export const HANDYMAN_FEE_RATE = 0;

export const customerTotal = (price: number) => price * (1 + CUSTOMER_FEE_RATE);
export const handymanNet = (price: number) => price * (1 - HANDYMAN_FEE_RATE);
export const platformRevenue = (price: number) => price * (CUSTOMER_FEE_RATE + HANDYMAN_FEE_RATE);
