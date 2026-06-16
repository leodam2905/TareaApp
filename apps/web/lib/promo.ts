import type { PromoCode } from "@prisma/client";

export interface PromoCheckResult {
  ok: boolean;
  error?: string;
  discountAmount: number;
}

/**
 * Single source of truth for whether a promo code may be redeemed by a given
 * user for a given price, and how much it discounts.
 *
 * Enforces: active, not expired, under maxUses, and ownership — a code with a
 * non-null ownerId may only be redeemed by that user (null = public/global).
 * Used at validate, booking-create, and checkout time so a code can't be
 * applied through one path while bypassing checks on another.
 */
export function assertPromoUsable(
  promo: Pick<PromoCode, "isActive" | "expiresAt" | "maxUses" | "usesCount" | "discountType" | "discountValue" | "ownerId">,
  userId: string,
  totalPrice: number
): PromoCheckResult {
  if (!promo.isActive) {
    return { ok: false, error: "This promo code is no longer active", discountAmount: 0 };
  }
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return { ok: false, error: "This promo code has expired", discountAmount: 0 };
  }
  if (promo.maxUses !== null && promo.usesCount >= promo.maxUses) {
    return { ok: false, error: "This promo code has reached its usage limit", discountAmount: 0 };
  }
  if (promo.ownerId && promo.ownerId !== userId) {
    // Don't reveal that the code exists for someone else — generic message.
    return { ok: false, error: "Invalid promo code", discountAmount: 0 };
  }

  const discountAmount =
    promo.discountType === "PERCENT"
      ? totalPrice * (promo.discountValue / 100)
      : Math.min(promo.discountValue, totalPrice);

  return { ok: true, discountAmount };
}
