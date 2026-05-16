// 15% fee charged to customer on top of service price
// 10% fee deducted from handyman payout
export const CUSTOMER_FEE_RATE = 0.15;
export const HANDYMAN_FEE_RATE = 0.10;

export const customerTotal = (price: number) => price * (1 + CUSTOMER_FEE_RATE);
export const handymanNet = (price: number) => price * (1 - HANDYMAN_FEE_RATE);
export const platformRevenue = (price: number) => price * (CUSTOMER_FEE_RATE + HANDYMAN_FEE_RATE);
