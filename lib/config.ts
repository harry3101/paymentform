/**
 * ============================================================
 * PAYMENT CONFIG — edit these values to customize the form
 * ============================================================
 *
 * UPI_ID (VPA): where student payments are received
 * AMOUNT: participation fee in INR
 * PAYEE_NAME: shown in the UPI app as the payee
 * TRANSACTION_NOTE: appears in the UPI payment description
 *
 * Real gateway integration (later):
 * - Replace the UPI deep-link flow with Razorpay / PhonePe / Cashfree /
 *   PayU checkout and verify payment server-side via webhooks.
 * - Never trust client-side "payment success" alone in production.
 * - Store orderId + paymentId and confirm status from the gateway API.
 */

export const PAYMENT_CONFIG = {
  /** UPI Virtual Payment Address — payments received here */
  UPI_ID: "9599566502@ptsbi",

  /** Participation fee in Indian Rupees */
  AMOUNT: 499,

  /** Name shown to the student in their UPI app */
  PAYEE_NAME: "Student Participation",

  /** Note / description on the UPI transaction */
  TRANSACTION_NOTE: "Student Participation Fee",

  /** Currency code for UPI (always INR for Indian UPI) */
  CURRENCY: "INR",
} as const;

export const STORAGE_KEY = "student_participation_submissions";
export const PAYMENT_SESSION_KEY = "student_participation_payment";
