import { PAYMENT_CONFIG } from "./config";

/**
 * Builds a standard UPI deep-link / Intent URI.
 *
 * Format: upi://pay?pa=<VPA>&pn=<name>&am=<amount>&cu=INR&tn=<note>
 *
 * On Android this opens the UPI app chooser (GPay, PhonePe, Paytm, etc.).
 * On iOS, installed UPI apps that handle the scheme may open.
 * On desktop browsers the link usually cannot complete payment —
 * students should use their phone.
 */
export function buildUpiDeepLink(options?: {
  amount?: number;
  transactionRef?: string;
}): string {
  const amount = (options?.amount ?? PAYMENT_CONFIG.AMOUNT).toFixed(2);
  const params = new URLSearchParams({
    pa: PAYMENT_CONFIG.UPI_ID,
    pn: PAYEE_NAME_SAFE,
    am: amount,
    cu: PAYMENT_CONFIG.CURRENCY,
    tn: PAYMENT_CONFIG.TRANSACTION_NOTE,
  });

  if (options?.transactionRef) {
    params.set("tr", options.transactionRef);
  }

  return `upi://pay?${params.toString()}`;
}

/** Encode payee name safely for UPI query params */
const PAYEE_NAME_SAFE = PAYMENT_CONFIG.PAYEE_NAME;

/**
 * Indian mobile number validation.
 * Accepts: 9876543210, +919876543210, 919876543210, 09876543210
 */
export function isValidIndianPhone(value: string): boolean {
  const digits = value.replace(/[\s\-()]/g, "");
  const normalized = digits.replace(/^\+?91/, "").replace(/^0/, "");
  return /^[6-9]\d{9}$/.test(normalized);
}

export function normalizeIndianPhone(value: string): string {
  const digits = value.replace(/[\s\-()]/g, "");
  return digits.replace(/^\+?91/, "").replace(/^0/, "");
}

export function formatAmountINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
