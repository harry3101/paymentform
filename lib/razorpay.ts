import crypto from "crypto";
import { PAYMENT_CONFIG } from "./config";

/**
 * Razorpay credentials — set these in environment variables (Render / .env.local).
 * Never expose RAZORPAY_KEY_SECRET to the browser.
 *
 * Dashboard: https://dashboard.razorpay.com/app/keys
 * Use Test keys while developing; Live keys in production.
 */
export function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";

  return {
    keyId,
    keySecret,
    webhookSecret,
    isConfigured: Boolean(keyId && keySecret),
  };
}

export function amountToPaise(amountInr: number = PAYMENT_CONFIG.AMOUNT): number {
  return Math.round(amountInr * 100);
}

export async function createRazorpayOrder(options: {
  receipt: string;
  amountInr?: number;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  const { keyId, keySecret, isConfigured } = getRazorpayConfig();
  if (!isConfigured) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  const amount = amountToPaise(options.amountInr ?? PAYMENT_CONFIG.AMOUNT);
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: PAYMENT_CONFIG.CURRENCY,
      receipt: options.receipt.slice(0, 40),
      notes: options.notes ?? {},
    }),
  });

  const data = (await response.json()) as {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { description?: string };
  };

  if (!response.ok || !data.id) {
    throw new Error(
      data.error?.description || "Failed to create Razorpay order"
    );
  }

  return {
    id: data.id,
    amount: data.amount ?? amount,
    currency: data.currency ?? PAYMENT_CONFIG.CURRENCY,
  };
}

/**
 * Verifies checkout success payload using HMAC SHA256.
 * Docs: https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/#step-5-verify-signature
 */
export function verifyCheckoutSignature(options: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret, isConfigured } = getRazorpayConfig();
  if (!isConfigured) return false;

  const body = `${options.orderId}|${options.paymentId}`;
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(options.signature)
    );
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const { webhookSecret } = getRazorpayConfig();
  if (!webhookSecret) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

/** Fetch latest order status from Razorpay API (source of truth). */
export async function fetchRazorpayOrderStatus(
  razorpayOrderId: string
): Promise<"created" | "attempted" | "paid"> {
  const { keyId, keySecret, isConfigured } = getRazorpayConfig();
  if (!isConfigured) {
    throw new Error("Razorpay is not configured");
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(
    `https://api.razorpay.com/v1/orders/${razorpayOrderId}`,
    {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    }
  );

  const data = (await response.json()) as {
    status?: string;
    error?: { description?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.description || "Failed to fetch order status");
  }

  const status = (data.status || "created") as
    | "created"
    | "attempted"
    | "paid";
  return status;
}

/** List payments for an order — used when polling after UPI return. */
export async function fetchOrderPayments(razorpayOrderId: string): Promise<
  Array<{ id: string; status: string }>
> {
  const { keyId, keySecret, isConfigured } = getRazorpayConfig();
  if (!isConfigured) return [];

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(
    `https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`,
    {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    }
  );

  if (!response.ok) return [];

  const data = (await response.json()) as {
    items?: Array<{ id: string; status: string }>;
  };

  return data.items ?? [];
}
