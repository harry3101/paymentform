import { NextResponse } from "next/server";
import { PAYMENT_CONFIG } from "@/lib/config";
import {
  createLocalOrderId,
  savePaymentOrder,
  type PaymentOrder,
} from "@/lib/payment-store";
import {
  createRazorpayOrder,
  getRazorpayConfig,
} from "@/lib/razorpay";
import { isValidIndianPhone, normalizeIndianPhone } from "@/lib/upi";

/**
 * POST /api/payment/create
 * Creates a local payment record + Razorpay order.
 * Frontend then opens Razorpay Checkout (UPI). Success is verified
 * server-side via /api/payment/verify and/or webhook + status poll.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();

    if (!fullName || !email || !phone) {
      return NextResponse.json(
        { ok: false, error: "Name, email, and phone are required before payment." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Invalid email address." },
        { status: 400 }
      );
    }

    if (!isValidIndianPhone(phone)) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid 10-digit Indian mobile number." },
        { status: 400 }
      );
    }

    const { keyId, isConfigured } = getRazorpayConfig();
    if (!isConfigured) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.",
        },
        { status: 503 }
      );
    }

    const orderId = createLocalOrderId();
    const rzpOrder = await createRazorpayOrder({
      receipt: orderId,
      amountInr: PAYMENT_CONFIG.AMOUNT,
      notes: {
        orderId,
        fullName,
        email,
        phone: normalizeIndianPhone(phone),
        purpose: PAYMENT_CONFIG.TRANSACTION_NOTE,
      },
    });

    const now = new Date().toISOString();
    const record: PaymentOrder = {
      orderId,
      razorpayOrderId: rzpOrder.id,
      amount: PAYMENT_CONFIG.AMOUNT,
      currency: PAYMENT_CONFIG.CURRENCY,
      status: "created",
      paymentId: null,
      signature: null,
      student: {
        fullName,
        email,
        phone: normalizeIndianPhone(phone),
      },
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    };

    await savePaymentOrder(record);

    return NextResponse.json({
      ok: true,
      orderId,
      razorpayOrderId: rzpOrder.id,
      amount: PAYMENT_CONFIG.AMOUNT,
      amountPaise: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId,
      payeeName: PAYMENT_CONFIG.PAYEE_NAME,
      description: PAYMENT_CONFIG.TRANSACTION_NOTE,
      // Display-only settlement hint (funds settle to Razorpay merchant account)
      upiDisplayId: PAYMENT_CONFIG.UPI_ID,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create payment order";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
